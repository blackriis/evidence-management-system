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
        console.log("🔐 Auth attempt (MOCK MODE):", {
          email: credentials?.email,
          hasPassword: !!credentials?.password,
          nodeEnv: process.env.NODE_ENV
        });

        if (!credentials?.email) {
          console.error("❌ No email provided");
          return null;
        }

        // MOCK AUTHENTICATION - bypass database
        const mockUsers = {
          'admin@school.edu': { id: '1', name: 'System Administrator', role: 'ADMIN' },
          'teacher1@school.edu': { id: '2', name: 'Alice Johnson', role: 'TEACHER' },
          'iqa1@school.edu': { id: '3', name: 'Dr. Sarah Miller', role: 'IQA_EVALUATOR' },
          'eqa1@school.edu': { id: '4', name: 'Dr. Robert Taylor', role: 'EQA_EVALUATOR' },
          'executive1@school.edu': { id: '5', name: 'Principal John Executive', role: 'EXECUTIVE' },
        };

        const mockUser = mockUsers[credentials.email as keyof typeof mockUsers];
        
        if (mockUser) {
          console.log("✅ MOCK authentication successful for:", credentials.email);
          return {
            id: mockUser.id,
            email: credentials.email,
            name: mockUser.name,
            role: mockUser.role,
          };
        }

        // Fallback for any @school.edu email
        if (credentials.email.endsWith('@school.edu')) {
          console.log("✅ MOCK authentication (fallback) for:", credentials.email);
          return {
            id: Math.random().toString(),
            email: credentials.email,
            name: credentials.email.split('@')[0],
            role: 'TEACHER',
          };
        }

        console.error("❌ Mock authentication failed for:", credentials.email);
        return null;
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

      // Skip database refresh in MOCK mode
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
      console.log(`✅ MOCK User ${user.email} signed in with role ${user.role}`);
    },
    async signOut({ token }) {
      console.log(`👋 MOCK User ${token?.email} signed out`);
    },
  },
  debug: true, // Enable debug in production for troubleshooting
  secret: process.env.NEXTAUTH_SECRET,
};