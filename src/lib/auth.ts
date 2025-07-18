import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { UserRole } from "@prisma/client";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email) {
          throw new Error("Email is required");
        }

        try {
          // For development, we'll use a simple email-based authentication
          // In production, you would verify against hashed passwords
          const user = await db.user.findUnique({
            where: {
              email: credentials.email,
              isActive: true,
              deletedAt: null,
            },
          });

          if (!user) {
            throw new Error("Invalid credentials");
          }

          // In development, accept any password for existing users
          // In production, verify hashed password here
          if (process.env.NODE_ENV === "production" && !credentials.password) {
            throw new Error("Password is required");
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          };
        } catch (error) {
          console.error("Authentication error:", error);
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
      }

      // Refresh user data on session update
      if (trigger === "update" && token.id) {
        try {
          const refreshedUser = await db.user.findUnique({
            where: {
              id: token.id as string,
              isActive: true,
              deletedAt: null,
            },
          });

          if (refreshedUser) {
            token.role = refreshedUser.role;
            token.email = refreshedUser.email;
            token.name = refreshedUser.name;
          } else {
            // User was deactivated or deleted
            return {};
          }
        } catch (error) {
          console.error("Token refresh error:", error);
          return {};
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token && token.id) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
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
    async signIn({ user, account, profile, isNewUser }) {
      console.log(`User ${user.email} signed in with role ${user.role}`);
    },
    async signOut({ token }) {
      console.log(`User ${token?.email} signed out`);
    },
  },
  debug: process.env.NODE_ENV === "development",
  secret: process.env.NEXTAUTH_SECRET,
};