import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { UserRole } from "@/lib/user-role";
import { SecurityHeaders, CSRFProtection } from "@/lib/security-headers";
import { rateLimiter, RATE_LIMIT_CONFIGS } from "@/lib/rate-limiter";

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
  async function middleware(req) {
    const token = req.nextauth.token;
    const { pathname } = req.nextUrl;

    // Apply rate limiting for API routes
    if (pathname.startsWith('/api/')) {
      let rateLimitConfig = RATE_LIMIT_CONFIGS.API;
      
      // Apply specific rate limits based on endpoint
      if (pathname.startsWith('/api/auth/')) {
        rateLimitConfig = RATE_LIMIT_CONFIGS.AUTH;
      } else if (pathname.startsWith('/api/upload')) {
        rateLimitConfig = RATE_LIMIT_CONFIGS.UPLOAD;
      } else if (pathname.startsWith('/api/admin/')) {
        rateLimitConfig = RATE_LIMIT_CONFIGS.ADMIN;
      } else if (pathname.includes('/export')) {
        rateLimitConfig = RATE_LIMIT_CONFIGS.EXPORT;
      }

      const rateLimitResult = await rateLimiter.checkRateLimit(req, rateLimitConfig);
      if (!rateLimitResult.allowed) {
        return NextResponse.json(
          {
            error: "Too many requests",
            message: "Rate limit exceeded. Please try again later.",
            retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000),
          },
          { 
            status: 429,
            headers: {
              'X-RateLimit-Limit': rateLimitConfig.maxRequests.toString(),
              'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
              'X-RateLimit-Reset': Math.ceil(rateLimitResult.resetTime / 1000).toString(),
              'Retry-After': Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString(),
            }
          }
        );
      }
    }

    // CSRF Protection for state-changing requests (disabled in development)
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && pathname.startsWith('/api/') && process.env.NODE_ENV === 'production') {
      const csrfResponse = await CSRFProtection.middleware()(req);
      if (csrfResponse) {
        return csrfResponse;
      }
    }

    // Allow public routes
    if (isPublicRoute(pathname)) {
      const response = NextResponse.next();
      
      // Apply security headers even to public routes
      SecurityHeaders.applyHeaders(response, {
        contentSecurityPolicy: {
          directives: {
            'default-src': ["'self'"],
            'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            'style-src': ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            'font-src': ["'self'", "https://fonts.gstatic.com"],
            'img-src': ["'self'", "data:", "https:"],
            'connect-src': ["'self'"],
          }
        }
      });

      // Add CSRF token for authenticated users
      if (token) {
        const csrfToken = CSRFProtection.generateToken();
        CSRFProtection.addTokenToCookie(response, csrfToken);
      }

      return response;
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

    // Create response with enhanced security headers
    const response = NextResponse.next();
    
    // Apply comprehensive security headers
    SecurityHeaders.applyHeaders(response, {
      contentSecurityPolicy: {
        directives: {
          'default-src': ["'self'"],
          'script-src': [
            "'self'",
            "'unsafe-inline'", // Required for Next.js
            "'unsafe-eval'", // Required for Next.js development
            "https://vercel.live",
          ],
          'style-src': [
            "'self'",
            "'unsafe-inline'", // Required for Tailwind CSS
            "https://fonts.googleapis.com",
          ],
          'img-src': ["'self'", "data:", "https:", "blob:"],
          'font-src': ["'self'", "data:", "https://fonts.gstatic.com"],
          'connect-src': [
            "'self'",
            "https://api.resend.com",
            "https://notify-api.line.me",
            process.env.NODE_ENV === 'development' ? "ws://localhost:*" : "",
          ].filter(Boolean),
          'frame-src': ["'none'"],
          'object-src': ["'none'"],
          'base-uri': ["'self'"],
          'form-action': ["'self'"],
          'frame-ancestors': ["'none'"],
        }
      },
      strictTransportSecurity: process.env.NODE_ENV === 'production' && process.env.HTTPS_ENABLED === 'true' ? {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
      } : undefined,
      permissionsPolicy: {
        camera: [],
        microphone: [],
        geolocation: [],
        payment: [],
        usb: [],
        magnetometer: [],
        gyroscope: [],
        accelerometer: [],
      }
    });

    // Add CSRF token to authenticated responses
    const csrfToken = CSRFProtection.generateToken();
    CSRFProtection.addTokenToCookie(response, csrfToken);

    // Add rate limit headers to response
    if (pathname.startsWith('/api/')) {
      const rateLimitConfig = RATE_LIMIT_CONFIGS.API;
      const rateLimitResult = await rateLimiter.checkRateLimit(req, rateLimitConfig);
      
      response.headers.set('X-RateLimit-Limit', rateLimitConfig.maxRequests.toString());
      response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
      response.headers.set('X-RateLimit-Reset', Math.ceil(rateLimitResult.resetTime / 1000).toString());
    }

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