let Redis;
try {
  Redis = require('ioredis');
} catch (error) {
  console.warn('Redis not available, using fallback cache handler');
}

class CustomCacheHandler {
  constructor(options) {
    this.options = options;
    this.redis = null;
    this.initRedis();
  }

  initRedis() {
    if (!Redis || !process.env.REDIS_URL || process.env.DISABLE_REDIS_CACHE === 'true') {
      console.warn('Redis not available or disabled, using default Next.js cache');
      return;
    }

    try {
      this.redis = new Redis(process.env.REDIS_URL, {
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });

      this.redis.on('error', (err) => {
        console.error('Redis cache handler error:', err);
        this.redis = null; // Disable Redis on error
      });
    } catch (error) {
      console.error('Failed to initialize Redis cache handler:', error);
      this.redis = null;
    }
  }

  async get(key) {
    if (!this.redis) return null;

    try {
      const cached = await this.redis.get(`nextjs:${key}`);
      if (!cached) return null;

      const parsed = JSON.parse(cached);
      
      // Check if cache entry has expired
      if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
        await this.redis.del(`nextjs:${key}`);
        return null;
      }

      return {
        value: parsed.value,
        lastModified: parsed.lastModified,
      };
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  async set(key, data, ctx) {
    if (!this.redis) return;

    try {
      const cacheData = {
        value: data,
        lastModified: Date.now(),
        expiresAt: ctx?.revalidate ? Date.now() + (ctx.revalidate * 1000) : null,
      };

      const ttl = ctx?.revalidate || 3600; // Default 1 hour
      await this.redis.setex(`nextjs:${key}`, ttl, JSON.stringify(cacheData));
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error);
    }
  }

  async revalidateTag(tag) {
    if (!this.redis) return;

    try {
      // Find all keys with this tag and delete them
      const keys = await this.redis.keys(`nextjs:*${tag}*`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      console.error(`Cache revalidate tag error for tag ${tag}:`, error);
    }
  }
}

module.exports = CustomCacheHandler;