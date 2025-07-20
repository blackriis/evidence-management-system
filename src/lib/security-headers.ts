import { NextRequest, NextResponse } from "next/server";
// Web Crypto API for edge runtime compatibility
const getRandomBytes = (size: number): Uint8Array => {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    // Use Web Crypto API in edge runtime
    return crypto.getRandomValues(new Uint8Array(size));
  } else {
    // Fallback for environments without crypto
    const array = new Uint8Array(size);
    for (let i = 0; i < size; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    return array;
  }
};

export interface SecurityHeadersConfig {
  contentSecurityPolicy?: {
    directives?: Record<string, string | string[]>;
    reportOnly?: boolean;
  };
  frameOptions?: 'DENY' | 'SAMEORIGIN' | string;
  contentTypeOptions?: boolean;
  referrerPolicy?: string;
  strictTransportSecurity?: {
    maxAge?: number;
    includeSubDomains?: boolean;
    preload?: boolean;
  };
  permissionsPolicy?: Record<string, string | string[]>;
  crossOriginEmbedderPolicy?: 'require-corp' | 'credentialless';
  crossOriginOpenerPolicy?: 'same-origin' | 'same-origin-allow-popups' | 'unsafe-none';
  crossOriginResourcePolicy?: 'same-site' | 'same-origin' | 'cross-origin';
}

export class SecurityHeaders {
  private static readonly DEFAULT_CSP_DIRECTIVES = {
    'default-src': ["'self'"],
    'script-src': [
      "'self'",
      "'unsafe-inline'", // Required for Next.js
      "'unsafe-eval'", // Required for Next.js development
      'https://vercel.live',
    ],
    'style-src': [
      "'self'",
      "'unsafe-inline'", // Required for Tailwind CSS
      'https://fonts.googleapis.com',
    ],
    'img-src': [
      "'self'",
      'data:',
      'https:',
      'blob:',
    ],
    'font-src': [
      "'self'",
      'data:',
      'https://fonts.gstatic.com',
    ],
    'connect-src': [
      "'self'",
      'https://api.resend.com',
      'https://notify-api.line.me',
      process.env.NODE_ENV === 'development' ? 'ws://localhost:*' : '',
    ].filter(Boolean),
    'frame-src': ["'none'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
    'upgrade-insecure-requests': [],
  };

  /**
   * Apply security headers to a response
   */
  static applyHeaders(
    response: NextResponse,
    config: SecurityHeadersConfig = {}
  ): NextResponse {
    // Content Security Policy
    if (config.contentSecurityPolicy !== false) {
      const cspDirectives = {
        ...this.DEFAULT_CSP_DIRECTIVES,
        ...config.contentSecurityPolicy?.directives,
      };

      const cspString = Object.entries(cspDirectives)
        .map(([directive, values]) => {
          if (Array.isArray(values) && values.length > 0) {
            return `${directive} ${values.join(' ')}`;
          } else if (typeof values === 'string') {
            return `${directive} ${values}`;
          } else if (values.length === 0) {
            return directive;
          }
          return '';
        })
        .filter(Boolean)
        .join('; ');

      const headerName = config.contentSecurityPolicy?.reportOnly
        ? 'Content-Security-Policy-Report-Only'
        : 'Content-Security-Policy';

      response.headers.set(headerName, cspString);
    }

    // X-Frame-Options
    response.headers.set(
      'X-Frame-Options',
      config.frameOptions || 'DENY'
    );

    // X-Content-Type-Options
    if (config.contentTypeOptions !== false) {
      response.headers.set('X-Content-Type-Options', 'nosniff');
    }

    // Referrer-Policy
    response.headers.set(
      'Referrer-Policy',
      config.referrerPolicy || 'strict-origin-when-cross-origin'
    );

    // Strict-Transport-Security (HTTPS only)
    const hsts = config.strictTransportSecurity;
    if (hsts !== false) {
      const maxAge = hsts?.maxAge || 31536000; // 1 year
      const includeSubDomains = hsts?.includeSubDomains !== false;
      const preload = hsts?.preload === true;

      let hstsValue = `max-age=${maxAge}`;
      if (includeSubDomains) hstsValue += '; includeSubDomains';
      if (preload) hstsValue += '; preload';

      response.headers.set('Strict-Transport-Security', hstsValue);
    }

    // Permissions-Policy (updated syntax)
    if (config.permissionsPolicy) {
      const permissionsString = Object.entries(config.permissionsPolicy)
        .map(([directive, values]) => {
          if (Array.isArray(values) && values.length === 0) {
            // Empty array means deny all
            return `${directive}=()`;
          }
          const valueString = Array.isArray(values) ? values.join(' ') : values;
          return `${directive}=(${valueString})`;
        })
        .join(', ');

      response.headers.set('Permissions-Policy', permissionsString);
    } else {
      // Default restrictive permissions policy with correct syntax
      response.headers.set(
        'Permissions-Policy',
        'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()'
      );
    }

    // Cross-Origin-Embedder-Policy
    if (config.crossOriginEmbedderPolicy) {
      response.headers.set(
        'Cross-Origin-Embedder-Policy',
        config.crossOriginEmbedderPolicy
      );
    }

    // Cross-Origin-Opener-Policy
    response.headers.set(
      'Cross-Origin-Opener-Policy',
      config.crossOriginOpenerPolicy || 'same-origin'
    );

    // Cross-Origin-Resource-Policy
    response.headers.set(
      'Cross-Origin-Resource-Policy',
      config.crossOriginResourcePolicy || 'same-origin'
    );

    // Additional security headers
    response.headers.set('X-DNS-Prefetch-Control', 'off');
    response.headers.set('X-Download-Options', 'noopen');
    response.headers.set('X-Permitted-Cross-Domain-Policies', 'none');

    return response;
  }

  /**
   * Generate a nonce for CSP
   */
  static generateNonce(): string {
    const bytes = getRandomBytes(16);
    return btoa(String.fromCharCode(...bytes));
  }

  /**
   * Create CSP with nonce for inline scripts
   */
  static createCSPWithNonce(nonce: string, additionalDirectives: Record<string, string[]> = {}): string {
    const directives = {
      ...this.DEFAULT_CSP_DIRECTIVES,
      'script-src': [
        "'self'",
        `'nonce-${nonce}'`,
        'https://vercel.live',
      ],
      ...additionalDirectives,
    };

    return Object.entries(directives)
      .map(([directive, values]) => {
        if (Array.isArray(values) && values.length > 0) {
          return `${directive} ${values.join(' ')}`;
        } else if (values.length === 0) {
          return directive;
        }
        return '';
      })
      .filter(Boolean)
      .join('; ');
  }
}

/**
 * CSRF Protection Implementation
 */
export class CSRFProtection {
  private static readonly CSRF_TOKEN_LENGTH = 32;
  private static readonly CSRF_HEADER_NAME = 'x-csrf-token';
  private static readonly CSRF_COOKIE_NAME = 'csrf-token';

  /**
   * Generate a CSRF token
   */
  static generateToken(): string {
    const bytes = getRandomBytes(this.CSRF_TOKEN_LENGTH);
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Verify CSRF token from request
   */
  static verifyToken(req: NextRequest, expectedToken: string): boolean {
    // Get token from header
    const headerToken = req.headers.get(this.CSRF_HEADER_NAME);
    
    // Get token from form data (for form submissions)
    const formToken: string | null = null;
    if (req.headers.get('content-type')?.includes('application/x-www-form-urlencoded')) {
      // This would need to be extracted from form data in the actual handler
      // For now, we'll rely on header-based CSRF protection
    }

    const providedToken = headerToken || formToken;

    if (!providedToken) {
      return false;
    }

    // Use timing-safe comparison to prevent timing attacks
    return this.timingSafeEqual(providedToken, expectedToken);
  }

  /**
   * Add CSRF token to response cookies
   */
  static addTokenToCookie(response: NextResponse, token: string): NextResponse {
    response.cookies.set(this.CSRF_COOKIE_NAME, token, {
      httpOnly: false, // Needs to be accessible to JavaScript for AJAX requests
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/',
    });

    return response;
  }

  /**
   * Get CSRF token from request cookies
   */
  static getTokenFromCookie(req: NextRequest): string | null {
    return req.cookies.get(this.CSRF_COOKIE_NAME)?.value || null;
  }

  /**
   * Timing-safe string comparison to prevent timing attacks
   */
  private static timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }

  /**
   * Middleware to protect against CSRF attacks
   */
  static middleware() {
    return async (req: NextRequest): Promise<NextResponse | null> => {
      // Skip CSRF protection for safe methods
      if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return null;
      }

      // Skip CSRF protection for API authentication routes
      if (req.nextUrl.pathname.startsWith('/api/auth/')) {
        return null;
      }

      const expectedToken = this.getTokenFromCookie(req);
      
      if (!expectedToken) {
        return NextResponse.json(
          { error: 'CSRF token missing' },
          { status: 403 }
        );
      }

      if (!this.verifyToken(req, expectedToken)) {
        return NextResponse.json(
          { error: 'Invalid CSRF token' },
          { status: 403 }
        );
      }

      return null; // Continue with request
    };
  }
}

/**
 * Higher-order function to apply security headers to API routes
 */
export function withSecurityHeaders(config: SecurityHeadersConfig = {}) {
  return function (handler: (req: NextRequest) => Promise<NextResponse>) {
    return async function (req: NextRequest): Promise<NextResponse> {
      const response = await handler(req);
      return SecurityHeaders.applyHeaders(response, config);
    };
  };
}

/**
 * Higher-order function to apply CSRF protection to API routes
 */
export function withCSRFProtection() {
  return function (handler: (req: NextRequest) => Promise<NextResponse>) {
    return async function (req: NextRequest): Promise<NextResponse> {
      const csrfResponse = await CSRFProtection.middleware()(req);
      if (csrfResponse) {
        return csrfResponse;
      }

      return handler(req);
    };
  };
}