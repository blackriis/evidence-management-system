import { NextRequest, NextResponse } from "next/server";
// import { Redis } from "ioredis"; // Disabled Redis for edge runtime compatibility

// Rate limiting configuration
export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: NextRequest) => string;
  onLimitReached?: (req: NextRequest) => void;
}

// Default rate limit configurations for different endpoints
export const RATE_LIMIT_CONFIGS = {
  // Authentication endpoints - stricter limits
  AUTH: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 attempts per 15 minutes
  },
  
  // File upload endpoints - moderate limits
  UPLOAD: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 uploads per minute
  },
  
  // API endpoints - general limits
  API: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // 100 requests per minute
  },
  
  // Admin endpoints - moderate limits
  ADMIN: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 50, // 50 requests per minute
  },
  
  // Export endpoints - stricter limits due to resource intensity
  EXPORT: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 3, // 3 exports per 5 minutes
  },
} as const;

export class RateLimiter {
  private redis: any = null; // Disabled Redis for edge runtime compatibility
  private memoryStore: Map<string, { count: number; resetTime: number }> = new Map();

  constructor() {
    // Redis disabled for edge runtime compatibility
    // Using memory store for rate limiting
    console.log("Using memory store for rate limiting (Redis disabled for edge runtime)");
  }

  async checkRateLimit(
    req: NextRequest,
    config: RateLimitConfig
  ): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
    totalHits: number;
  }> {
    const key = config.keyGenerator ? config.keyGenerator(req) : this.getDefaultKey(req);
    const now = Date.now();
    const windowStart = now - config.windowMs;

    // Always use memory store (Redis disabled for edge runtime)
    return this.checkRateLimitMemory(key, config, now, windowStart);
  }

  private async checkRateLimitRedis(
    key: string,
    config: RateLimitConfig,
    now: number,
    windowStart: number
  ) {
    const pipeline = this.redis!.pipeline();
    
    // Remove old entries
    pipeline.zremrangebyscore(key, 0, windowStart);
    
    // Count current requests
    pipeline.zcard(key);
    
    // Add current request
    pipeline.zadd(key, now, `${now}-${Math.random()}`);
    
    // Set expiration
    pipeline.expire(key, Math.ceil(config.windowMs / 1000));
    
    const results = await pipeline.exec();
    const currentCount = (results?.[1]?.[1] as number) || 0;
    const totalHits = currentCount + 1;
    
    const allowed = totalHits <= config.maxRequests;
    const remaining = Math.max(0, config.maxRequests - totalHits);
    const resetTime = now + config.windowMs;

    if (!allowed && config.onLimitReached) {
      config.onLimitReached(req as NextRequest);
    }

    return {
      allowed,
      remaining,
      resetTime,
      totalHits,
    };
  }

  private checkRateLimitMemory(
    key: string,
    config: RateLimitConfig,
    now: number,
    windowStart: number
  ) {
    // Clean up old entries
    for (const [k, v] of this.memoryStore.entries()) {
      if (v.resetTime < now) {
        this.memoryStore.delete(k);
      }
    }

    const current = this.memoryStore.get(key);
    const resetTime = now + config.windowMs;

    if (!current || current.resetTime < now) {
      // New window
      this.memoryStore.set(key, { count: 1, resetTime });
      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetTime,
        totalHits: 1,
      };
    }

    // Increment count
    current.count++;
    const allowed = current.count <= config.maxRequests;
    const remaining = Math.max(0, config.maxRequests - current.count);

    if (!allowed && config.onLimitReached) {
      config.onLimitReached(req as NextRequest);
    }

    return {
      allowed,
      remaining,
      resetTime: current.resetTime,
      totalHits: current.count,
    };
  }

  private getDefaultKey(req: NextRequest): string {
    // Use IP address and user agent for rate limiting key
    const ip = this.getClientIP(req);
    const userAgent = req.headers.get("user-agent") || "unknown";
    const path = new URL(req.url).pathname;
    
    return `rate_limit:${ip}:${path}:${Buffer.from(userAgent).toString('base64').slice(0, 10)}`;
  }

  private getClientIP(req: NextRequest): string {
    // Check various headers for the real IP
    const forwarded = req.headers.get("x-forwarded-for");
    const realIP = req.headers.get("x-real-ip");
    const cfConnectingIP = req.headers.get("cf-connecting-ip");
    
    if (forwarded) {
      return forwarded.split(",")[0].trim();
    }
    
    if (realIP) {
      return realIP;
    }
    
    if (cfConnectingIP) {
      return cfConnectingIP;
    }
    
    return "unknown";
  }

  // Helper method to create rate limit response
  static createRateLimitResponse(result: {
    allowed: boolean;
    remaining: number;
    resetTime: number;
    totalHits: number;
  }): NextResponse {
    const response = NextResponse.json(
      {
        error: "Too many requests",
        message: "Rate limit exceeded. Please try again later.",
        retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
      },
      { status: 429 }
    );

    // Add rate limit headers
    response.headers.set("X-RateLimit-Limit", "100");
    response.headers.set("X-RateLimit-Remaining", result.remaining.toString());
    response.headers.set("X-RateLimit-Reset", Math.ceil(result.resetTime / 1000).toString());
    response.headers.set("Retry-After", Math.ceil((result.resetTime - Date.now()) / 1000).toString());

    return response;
  }
}

// Singleton instance
export const rateLimiter = new RateLimiter();

// Higher-order function to wrap API routes with rate limiting
export function withRateLimit(config: RateLimitConfig) {
  return function (handler: (req: NextRequest) => Promise<NextResponse>) {
    return async function (req: NextRequest): Promise<NextResponse> {
      const result = await rateLimiter.checkRateLimit(req, config);
      
      if (!result.allowed) {
        return RateLimiter.createRateLimitResponse(result);
      }

      // Add rate limit headers to successful responses
      const response = await handler(req);
      response.headers.set("X-RateLimit-Limit", config.maxRequests.toString());
      response.headers.set("X-RateLimit-Remaining", result.remaining.toString());
      response.headers.set("X-RateLimit-Reset", Math.ceil(result.resetTime / 1000).toString());

      return response;
    };
  };
}