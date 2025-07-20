import { NextRequest, NextResponse } from 'next/server';
import { cache, CacheKeys, CacheTTL } from './cache';
import crypto from 'crypto';

// Cache configuration for different API endpoints
export const APICacheConfig = {
  // Evidence endpoints
  '/api/evidence': { ttl: CacheTTL.SHORT, varyBy: ['userId', 'filters'] },
  '/api/evidence/[id]': { ttl: CacheTTL.MEDIUM, varyBy: ['id'] },
  
  // Evaluation endpoints
  '/api/evaluations': { ttl: CacheTTL.SHORT, varyBy: ['userId', 'filters'] },
  
  // Dashboard endpoints
  '/api/dashboard/metrics': { ttl: CacheTTL.SHORT, varyBy: ['userId', 'role', 'yearId'] },
  '/api/dashboard/activities': { ttl: CacheTTL.SHORT, varyBy: ['userId', 'limit'] },
  '/api/dashboard/risks': { ttl: CacheTTL.MEDIUM, varyBy: ['yearId'] },
  
  // Indicator tree (rarely changes)
  '/api/indicator-tree': { ttl: CacheTTL.LONG, varyBy: [] },
  
  // Academic years
  '/api/academic-years': { ttl: CacheTTL.LONG, varyBy: [] },
  
  // User stats
  '/api/users/stats': { ttl: CacheTTL.MEDIUM, varyBy: ['yearId'] },
};

// Generate cache key for API request
function generateCacheKey(
  endpoint: string, 
  searchParams: URLSearchParams,
  userId?: string,
  additionalParams: Record<string, any> = {}
): string {
  const config = APICacheConfig[endpoint as keyof typeof APICacheConfig];
  
  if (!config) {
    // Default cache key for unconfigured endpoints
    const paramsString = searchParams.toString();
    const hash = crypto.createHash('md5').update(paramsString).digest('hex');
    return CacheKeys.apiResponse(endpoint, hash);
  }

  // Build cache key based on configuration
  const keyParts: string[] = [endpoint];
  
  config.varyBy.forEach(param => {
    if (param === 'userId' && userId) {
      keyParts.push(`user:${userId}`);
    } else if (searchParams.has(param)) {
      keyParts.push(`${param}:${searchParams.get(param)}`);
    } else if (additionalParams[param]) {
      keyParts.push(`${param}:${additionalParams[param]}`);
    }
  });

  const keyString = keyParts.join(':');
  const hash = crypto.createHash('md5').update(keyString).digest('hex');
  
  return CacheKeys.apiResponse(endpoint, hash);
}

// API response caching wrapper
export function withAPICache(
  handler: (req: NextRequest, context?: any) => Promise<NextResponse>,
  options: {
    ttl?: number;
    varyBy?: string[];
    skipCache?: (req: NextRequest) => boolean;
    keyGenerator?: (req: NextRequest, userId?: string) => string;
  } = {}
) {
  return async (req: NextRequest, context?: any): Promise<NextResponse> => {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      return handler(req, context);
    }

    // Skip cache if condition is met
    if (options.skipCache && options.skipCache(req)) {
      return handler(req, context);
    }

    try {
      // Extract user ID from request (assuming it's in headers or context)
      const userId = req.headers.get('x-user-id') || context?.params?.userId;
      
      // Generate cache key
      const cacheKey = options.keyGenerator 
        ? options.keyGenerator(req, userId)
        : generateCacheKey(
            req.nextUrl.pathname,
            req.nextUrl.searchParams,
            userId,
            context?.params || {}
          );

      // Try to get from cache
      const cachedResponse = await cache.get<{
        data: any;
        headers: Record<string, string>;
        status: number;
      }>(cacheKey);

      if (cachedResponse) {
        // Return cached response
        const response = NextResponse.json(cachedResponse.data, {
          status: cachedResponse.status,
        });

        // Add cache headers
        response.headers.set('X-Cache', 'HIT');
        response.headers.set('X-Cache-Key', cacheKey);
        
        // Restore original headers
        Object.entries(cachedResponse.headers).forEach(([key, value]) => {
          response.headers.set(key, value);
        });

        return response;
      }

      // Execute handler
      const response = await handler(req, context);
      
      // Only cache successful responses
      if (response.status >= 200 && response.status < 300) {
        const responseData = await response.clone().json();
        
        // Determine TTL
        const endpoint = req.nextUrl.pathname;
        const config = APICacheConfig[endpoint as keyof typeof APICacheConfig];
        const ttl = options.ttl || config?.ttl || CacheTTL.MEDIUM;

        // Cache the response
        await cache.set(cacheKey, {
          data: responseData,
          headers: Object.fromEntries(response.headers.entries()),
          status: response.status,
        }, ttl);

        // Add cache headers
        response.headers.set('X-Cache', 'MISS');
        response.headers.set('X-Cache-Key', cacheKey);
      }

      return response;

    } catch (error) {
      console.error('API cache error:', error);
      // Return original response if caching fails
      return handler(req, context);
    }
  };
}

// Cache invalidation for API responses
export const APICacheInvalidation = {
  // Invalidate evidence-related API caches
  async invalidateEvidenceAPIs(userId?: string): Promise<void> {
    await cache.delPattern('api:/api/evidence:*');
    await cache.delPattern('api:/api/dashboard/metrics:*');
    await cache.delPattern('api:/api/dashboard/activities:*');
    
    if (userId) {
      await cache.delPattern(`api:/api/evidence:*user:${userId}*`);
    }
  },

  // Invalidate evaluation-related API caches
  async invalidateEvaluationAPIs(userId?: string): Promise<void> {
    await cache.delPattern('api:/api/evaluations:*');
    await cache.delPattern('api:/api/dashboard/metrics:*');
    await cache.delPattern('api:/api/dashboard/risks:*');
    
    if (userId) {
      await cache.delPattern(`api:/api/evaluations:*user:${userId}*`);
    }
  },

  // Invalidate dashboard API caches
  async invalidateDashboardAPIs(userId?: string): Promise<void> {
    await cache.delPattern('api:/api/dashboard/*');
    
    if (userId) {
      await cache.delPattern(`api:/api/dashboard/*user:${userId}*`);
    }
  },

  // Invalidate indicator tree API cache
  async invalidateIndicatorTreeAPI(): Promise<void> {
    await cache.delPattern('api:/api/indicator-tree:*');
  },

  // Invalidate academic year API caches
  async invalidateAcademicYearAPIs(): Promise<void> {
    await cache.delPattern('api:/api/academic-years:*');
    await cache.delPattern('api:/api/dashboard/metrics:*');
  },
};

// Utility to manually invalidate cache by pattern
export async function invalidateAPICache(pattern: string): Promise<void> {
  await cache.delPattern(`api:${pattern}`);
}

// Cache warming utilities for critical endpoints
export const APICacheWarming = {
  // Warm indicator tree cache (rarely changes, expensive to compute)
  async warmIndicatorTree(): Promise<void> {
    try {
      const response = await fetch(`${process.env.APP_URL}/api/indicator-tree`);
      if (response.ok) {
        console.log('Indicator tree cache warmed successfully');
      }
    } catch (error) {
      console.error('Failed to warm indicator tree cache:', error);
    }
  },

  // Warm academic years cache
  async warmAcademicYears(): Promise<void> {
    try {
      const response = await fetch(`${process.env.APP_URL}/api/academic-years`);
      if (response.ok) {
        console.log('Academic years cache warmed successfully');
      }
    } catch (error) {
      console.error('Failed to warm academic years cache:', error);
    }
  },

  // Warm dashboard metrics for active users
  async warmDashboardMetrics(userIds: string[]): Promise<void> {
    const warmingPromises = userIds.map(async (userId) => {
      try {
        const response = await fetch(
          `${process.env.APP_URL}/api/dashboard/metrics?userId=${userId}`,
          {
            headers: { 'x-user-id': userId }
          }
        );
        if (response.ok) {
          console.log(`Dashboard metrics cache warmed for user ${userId}`);
        }
      } catch (error) {
        console.error(`Failed to warm dashboard cache for user ${userId}:`, error);
      }
    });

    await Promise.allSettled(warmingPromises);
  },
};