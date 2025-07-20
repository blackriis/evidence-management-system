import Redis from 'ioredis';

// Redis client singleton
let redis: Redis | null = null;

export function getRedisClient(): Redis | null {
  if (!process.env.REDIS_URL) {
    console.warn('Redis URL not configured, caching disabled');
    return null;
  }

  if (!redis) {
    try {
      redis = new Redis(process.env.REDIS_URL, {
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        // Connection pool settings
        family: 4,
        keepAlive: true,
        // Reconnection settings
        reconnectOnError: (err) => {
          const targetError = 'READONLY';
          return err.message.includes(targetError);
        },
      });

      redis.on('error', (err) => {
        console.error('Redis connection error:', err);
      });

      redis.on('connect', () => {
        console.log('Redis connected successfully');
      });

    } catch (error) {
      console.error('Failed to initialize Redis client:', error);
      return null;
    }
  }

  return redis;
}

// Cache key generators
export const CacheKeys = {
  // User-related caches
  userSession: (userId: string) => `user:session:${userId}`,
  userPermissions: (userId: string) => `user:permissions:${userId}`,
  userPreferences: (userId: string) => `user:preferences:${userId}`,
  
  // Evidence-related caches
  evidenceList: (userId: string, filters: string) => `evidence:list:${userId}:${filters}`,
  evidenceDetails: (evidenceId: string) => `evidence:details:${evidenceId}`,
  evidenceVersions: (evidenceId: string) => `evidence:versions:${evidenceId}`,
  
  // Evaluation caches
  evaluationList: (evaluatorId: string) => `evaluation:list:${evaluatorId}`,
  evaluationStats: (userId: string, yearId: string) => `evaluation:stats:${userId}:${yearId}`,
  
  // Dashboard and metrics
  dashboardMetrics: (userId: string, role: string, yearId: string) => `dashboard:metrics:${userId}:${role}:${yearId}`,
  kpiMetrics: (yearId: string) => `kpi:metrics:${yearId}`,
  riskMetrics: (yearId: string) => `risk:metrics:${yearId}`,
  
  // Indicator tree
  indicatorTree: () => `indicator:tree`,
  indicatorHierarchy: (levelId: string) => `indicator:hierarchy:${levelId}`,
  
  // Academic year data
  academicYears: () => `academic:years`,
  activeYear: () => `academic:year:active`,
  
  // API response caches
  apiResponse: (endpoint: string, params: string) => `api:${endpoint}:${params}`,
};

// Cache TTL values (in seconds)
export const CacheTTL = {
  SHORT: 5 * 60,        // 5 minutes - for frequently changing data
  MEDIUM: 30 * 60,      // 30 minutes - for moderately stable data
  LONG: 2 * 60 * 60,    // 2 hours - for stable data
  VERY_LONG: 24 * 60 * 60, // 24 hours - for rarely changing data
  
  // Specific TTLs
  USER_SESSION: 30 * 60,     // 30 minutes
  USER_PERMISSIONS: 60 * 60,  // 1 hour
  DASHBOARD_METRICS: 10 * 60, // 10 minutes
  INDICATOR_TREE: 2 * 60 * 60, // 2 hours
  ACADEMIC_YEARS: 60 * 60,    // 1 hour
  API_RESPONSE: 5 * 60,       // 5 minutes
};

// Generic cache operations
export class CacheManager {
  private redis: Redis | null;

  constructor() {
    this.redis = getRedisClient();
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.redis) return null;

    try {
      const value = await this.redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  async set(key: string, value: any, ttl: number = CacheTTL.MEDIUM): Promise<boolean> {
    if (!this.redis) return false;

    try {
      await this.redis.setex(key, ttl, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error);
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    if (!this.redis) return false;

    try {
      await this.redis.del(key);
      return true;
    } catch (error) {
      console.error(`Cache delete error for key ${key}:`, error);
      return false;
    }
  }

  async delPattern(pattern: string): Promise<boolean> {
    if (!this.redis) return false;

    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
      return true;
    } catch (error) {
      console.error(`Cache delete pattern error for pattern ${pattern}:`, error);
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.redis) return false;

    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      console.error(`Cache exists error for key ${key}:`, error);
      return false;
    }
  }

  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    if (!this.redis || keys.length === 0) return [];

    try {
      const values = await this.redis.mget(...keys);
      return values.map(value => value ? JSON.parse(value) : null);
    } catch (error) {
      console.error(`Cache mget error for keys ${keys.join(', ')}:`, error);
      return keys.map(() => null);
    }
  }

  async mset(keyValuePairs: Array<{key: string, value: any, ttl?: number}>): Promise<boolean> {
    if (!this.redis || keyValuePairs.length === 0) return false;

    try {
      const pipeline = this.redis.pipeline();
      
      keyValuePairs.forEach(({key, value, ttl = CacheTTL.MEDIUM}) => {
        pipeline.setex(key, ttl, JSON.stringify(value));
      });

      await pipeline.exec();
      return true;
    } catch (error) {
      console.error('Cache mset error:', error);
      return false;
    }
  }

  // Cache warming utilities
  async warmCache(key: string, dataFetcher: () => Promise<any>, ttl: number = CacheTTL.MEDIUM): Promise<any> {
    try {
      // Try to get from cache first
      const cached = await this.get(key);
      if (cached !== null) {
        return cached;
      }

      // Fetch fresh data
      const data = await dataFetcher();
      
      // Store in cache
      await this.set(key, data, ttl);
      
      return data;
    } catch (error) {
      console.error(`Cache warm error for key ${key}:`, error);
      // Return fresh data even if caching fails
      return await dataFetcher();
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    if (!this.redis) return false;

    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch (error) {
      console.error('Redis health check failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const cache = new CacheManager();

// Cache invalidation helpers
export const CacheInvalidation = {
  // Invalidate user-related caches
  async invalidateUser(userId: string): Promise<void> {
    await cache.delPattern(`user:*:${userId}`);
    await cache.delPattern(`evidence:list:${userId}:*`);
    await cache.delPattern(`evaluation:*:${userId}*`);
    await cache.delPattern(`dashboard:metrics:${userId}:*`);
  },

  // Invalidate evidence-related caches
  async invalidateEvidence(evidenceId: string, userId?: string): Promise<void> {
    await cache.del(CacheKeys.evidenceDetails(evidenceId));
    await cache.del(CacheKeys.evidenceVersions(evidenceId));
    
    if (userId) {
      await cache.delPattern(`evidence:list:${userId}:*`);
      await cache.delPattern(`dashboard:metrics:${userId}:*`);
    }
    
    // Invalidate general metrics
    await cache.delPattern('kpi:metrics:*');
    await cache.delPattern('risk:metrics:*');
  },

  // Invalidate evaluation caches
  async invalidateEvaluation(evaluatorId: string, yearId?: string): Promise<void> {
    await cache.del(CacheKeys.evaluationList(evaluatorId));
    await cache.delPattern(`dashboard:metrics:${evaluatorId}:*`);
    
    if (yearId) {
      await cache.del(CacheKeys.kpiMetrics(yearId));
      await cache.del(CacheKeys.riskMetrics(yearId));
    }
  },

  // Invalidate indicator tree
  async invalidateIndicatorTree(): Promise<void> {
    await cache.del(CacheKeys.indicatorTree());
    await cache.delPattern('indicator:hierarchy:*');
  },

  // Invalidate academic year data
  async invalidateAcademicYears(): Promise<void> {
    await cache.del(CacheKeys.academicYears());
    await cache.del(CacheKeys.activeYear());
    await cache.delPattern('dashboard:metrics:*');
    await cache.delPattern('kpi:metrics:*');
  },
};