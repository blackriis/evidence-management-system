import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { UserRole } from "./user-role";
import { db } from "@/lib/db";
import { AuditLogger } from "@/lib/audit-logger";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        console.log("🔐 Auth attempt:", {
          email: credentials?.email,
          hasPassword: !!credentials?.password,
          nodeEnv: process.env.NODE_ENV
        });

        if (!credentials?.email || !credentials?.password) {
          console.error("❌ Missing email or password");
          return null;
        }

        try {
          // Find user in database
          const user = await db.user.findUnique({
            where: { 
              email: credentials.email,
              isActive: true 
            }
          });

          if (!user) {
            console.error("❌ User not found or inactive:", credentials.email);
            return null;
          }

          // In development mode, allow any password for existing users
          if (process.env.NODE_ENV === 'development') {
            console.log("✅ Development mode - bypassing password check for:", credentials.email);
            
            // Log authentication event
            await AuditLogger.log({
              action: 'USER_LOGIN',
              userId: user.id,
              details: { 
                email: user.email, 
                role: user.role,
                developmentMode: true 
              }
            });

            return {
              id: user.id,
              email: user.email,
              name: user.name,
              role: user.role,
            };
          }

          // In production, verify password
          const bcrypt = require('bcryptjs');
          if (!user.password) {
            console.error("❌ User has no password set:", credentials.email);
            return null;
          }

          const isValidPassword = await bcrypt.compare(credentials.password, user.password);
          if (!isValidPassword) {
            console.error("❌ Invalid password for:", credentials.email);
            return null;
          }

          // Log successful authentication
          await AuditLogger.log({
            action: 'USER_LOGIN',
            userId: user.id,
            details: { 
              email: user.email, 
              role: user.role 
            }
          });

          console.log("✅ Authentication successful for:", credentials.email);
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          };

        } catch (error) {
          console.error("❌ Authentication error:", error);
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
    updateAge: 60 * 60, // Update session every hour
  },
  jwt: {
    maxAge: 24 * 60 * 60, // 24 hours
    secret: process.env.NEXTAUTH_SECRET,
  },
  callbacks: {
    async jwt({ token, user, trigger }) {
      // Initial sign in
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.email = user.email;
        token.name = user.name;
        console.log("🔑 JWT token created for:", user.email);
      }

      // Refresh user data from database on update or periodically
      if (trigger === "update" || (!user && token.id)) {
        try {
          const dbUser = await db.user.findUnique({
            where: { 
              id: token.id as string,
              isActive: true 
            }
          });

          if (dbUser) {
            token.role = dbUser.role;
            token.email = dbUser.email;
            token.name = dbUser.name;
            console.log("🔄 JWT token refreshed from database for:", dbUser.email);
          } else {
            console.warn("⚠️ User not found during token refresh:", token.id);
            // Return null to force re-authentication
            return null;
          }
        } catch (error) {
          console.error("❌ Error refreshing JWT token:", error);
        }
      }

      console.log("🔄 JWT callback - token:", { 
        hasId: !!token.id, 
        email: token.email, 
        trigger 
      });

      return token;
    },
    async session({ session, token }) {
      console.log("🔐 Session callback:", { 
        hasToken: !!token, 
        tokenId: token?.id, 
        sessionEmail: session?.user?.email 
      });
      
      if (token && token.id) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        console.log("✅ Session created for:", session.user.email);
      }
      return session;
    },
    async signIn({ user, account, profile }) {
      // Additional sign-in validation can be added here
      return true;
    },
    async redirect({ url, baseUrl }) {
      // Allows relative callback URLs
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      // Allows callback URLs on the same origin
      else if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
    signOut: "/auth/signout",
  },
  events: {
    async signIn({ user }) {
      console.log(`✅ User ${user.email} signed in with role ${user.role}`);
    },
    async signOut({ token }) {
      console.log(`👋 User ${token?.email} signed out`);
      
      // Log signout event
      if (token?.id) {
        try {
          await AuditLogger.log({
            action: 'USER_LOGOUT',
            userId: token.id as string,
            details: { 
              email: token.email as string 
            }
          });
        } catch (error) {
          console.error("❌ Error logging signout:", error);
        }
      }
    },
  },
  debug: true, // Enable debug in production for troubleshooting
  secret: process.env.NEXTAUTH_SECRET,
};