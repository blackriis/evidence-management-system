import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";

// Define route access rules
const routeAccessRules = {
  "/admin": [UserRole.ADMIN],
  "/dashboard/executive": [UserRole.EXECUTIVE, UserRole.ADMIN],
  "/dashboard/teacher": [UserRole.TEACHER, UserRole.ADMIN],
  "/evaluation/iqa": [UserRole.IQA_EVALUATOR, UserRole.ADMIN],
  "/evaluation/eqa": [UserRole.EQA_EVALUATOR, UserRole.ADMIN],
  "/evidence/upload": [UserRole.TEACHER, UserRole.ADMIN],
  "/evidence/manage": [UserRole.TEACHER, UserRole.ADMIN],
  "/reports": [UserRole.EXECUTIVE, UserRole.ADMIN],
  "/users": [UserRole.ADMIN],
  "/settings": [UserRole.ADMIN],
} as const;

// Public routes that don't require authentication
const publicRoutes = [
  "/",
  "/auth/signin",
  "/auth/signout", 
  "/auth/error",
  "/unauthorized",
  "/api/auth",
];

function isPublicRoute(pathname: string): boolean {
  return publicRoutes.some(route => 
    pathname === route || pathname.startsWith(`${route}/`)
  );
}

function checkRouteAccess(pathname: string, userRole: UserRole): boolean {
  // Check if route requires specific role
  for (const [routePrefix, allowedRoles] of Object.entries(routeAccessRules)) {
    if (pathname.startsWith(routePrefix)) {
      return allowedRoles.includes(userRole);
    }
  }
  
  // Default: allow access if no specific rule found
  return true;
}

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const { pathname } = req.nextUrl;

    // Allow public routes
    if (isPublicRoute(pathname)) {
      return NextResponse.next();
    }

    // If no token, redirect to signin
    if (!token) {
      const signInUrl = new URL("/auth/signin", req.url);
      signInUrl.searchParams.set("callbackUrl", req.url);
      return NextResponse.redirect(signInUrl);
    }

    const userRole = token.role as UserRole;

    // Check route access permissions
    if (!checkRouteAccess(pathname, userRole)) {
      console.warn(`Access denied: User ${token.email} (${userRole}) attempted to access ${pathname}`);
      return NextResponse.redirect(new URL("/unauthorized", req.url));
    }

    // Add security headers
    const response = NextResponse.next();
    
    // Security headers for authenticated routes
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    response.headers.set(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;"
    );

    return response;
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Allow access to public routes without token
        if (isPublicRoute(req.nextUrl.pathname)) {
          return true;
        }
        // Require token for protected routes
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (NextAuth.js routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!api/auth|_next/static|_next/image|favicon.ico|public).*)",
  ],
};