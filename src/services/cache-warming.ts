import { cache, CacheKeys, CacheTTL } from '../lib/cache';
import { db } from '../lib/db';
import { APICacheWarming } from '../lib/api-cache';
import { FilesCacheWarming } from '../lib/cdn-cache';

// Cache warming service for application startup
export class CacheWarmingService {
  private isWarming = false;

  // Main cache warming orchestrator
  async warmCriticalCaches(): Promise<void> {
    if (this.isWarming) {
      console.log('Cache warming already in progress');
      return;
    }

    this.isWarming = true;
    console.log('Starting cache warming process...');

    try {
      await Promise.allSettled([
        this.warmStaticData(),
        this.warmUserData(),
        this.warmFileData(),
        this.warmAPIResponses(),
      ]);

      console.log('Cache warming completed successfully');
    } catch (error) {
      console.error('Cache warming failed:', error);
    } finally {
      this.isWarming = false;
    }
  }

  // Warm static/rarely changing data
  private async warmStaticData(): Promise<void> {
    console.log('Warming static data caches...');

    try {
      // Academic years
      const academicYears = await db.academicYear.findMany({
        orderBy: { startDate: 'desc' },
      });
      await cache.set(CacheKeys.academicYears(), academicYears, CacheTTL.LONG);

      // Active academic year
      const activeYear = academicYears.find(year => year.isActive);
      if (activeYear) {
        await cache.set(CacheKeys.activeYear(), activeYear, CacheTTL.LONG);
      }

      // Indicator tree structure
      const indicatorTree = await this.buildIndicatorTree();
      await cache.set(CacheKeys.indicatorTree(), indicatorTree, CacheTTL.LONG);

      console.log('Static data caches warmed successfully');
    } catch (error) {
      console.error('Failed to warm static data caches:', error);
    }
  }

  // Warm user-specific data for active users
  private async warmUserData(): Promise<void> {
    console.log('Warming user data caches...');

    try {
      // Get active users (logged in within last 7 days)
      const activeUsers = await db.user.findMany({
        where: {
          isActive: true,
          // Add a lastLoginAt field to your User model for better filtering
        },
        select: {
          id: true,
          role: true,
        },
        take: 100, // Limit to most active users
      });

      // Warm user permissions cache
      const permissionPromises = activeUsers.map(async (user) => {
        const permissions = await this.getUserPermissions(user.id, user.role);
        await cache.set(CacheKeys.userPermissions(user.id), permissions, CacheTTL.LONG);
      });

      await Promise.allSettled(permissionPromises);

      console.log(`User data caches warmed for ${activeUsers.length} users`);
    } catch (error) {
      console.error('Failed to warm user data caches:', error);
    }
  }

  // Warm file-related data
  private async warmFileData(): Promise<void> {
    console.log('Warming file data caches...');

    try {
      // Warm recent evidence files
      await FilesCacheWarming.warmRecentEvidence(50);
      
      // Warm dashboard thumbnails
      await FilesCacheWarming.warmDashboardThumbnails();

      console.log('File data caches warmed successfully');
    } catch (error) {
      console.error('Failed to warm file data caches:', error);
    }
  }

  // Warm API response caches
  private async warmAPIResponses(): Promise<void> {
    console.log('Warming API response caches...');

    try {
      // Warm indicator tree API
      await APICacheWarming.warmIndicatorTree();
      
      // Warm academic years API
      await APICacheWarming.warmAcademicYears();

      console.log('API response caches warmed successfully');
    } catch (error) {
      console.error('Failed to warm API response caches:', error);
    }
  }

  // Helper method to build indicator tree
  private async buildIndicatorTree() {
    const educationLevels = await db.educationLevel.findMany({
      include: {
        standards: {
          include: {
            indicators: {
              include: {
                subIndicators: {
                  select: {
                    id: true,
                    name: true,
                    code: true,
                    ownerId: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { code: 'asc' },
    });

    return educationLevels;
  }

  // Helper method to get user permissions
  private async getUserPermissions(userId: string, role: string) {
    // This would typically involve complex permission logic
    // For now, return basic role-based permissions
    const basePermissions = {
      canUpload: ['TEACHER', 'ADMIN'].includes(role),
      canEvaluate: ['IQA_EVALUATOR', 'EQA_EVALUATOR', 'ADMIN'].includes(role),
      canManageUsers: ['ADMIN'].includes(role),
      canViewDashboard: ['EXECUTIVE', 'ADMIN'].includes(role),
      canExport: ['EXECUTIVE', 'ADMIN'].includes(role),
    };

    // Add scope-specific permissions if needed
    if (role === 'IQA_EVALUATOR' || role === 'EQA_EVALUATOR') {
      const assignments = await db.evaluatorAssignment.findMany({
        where: { evaluatorId: userId },
        select: { subIndicatorId: true },
      });
      
      return {
        ...basePermissions,
        assignedScopes: assignments.map(a => a.subIndicatorId),
      };
    }

    return basePermissions;
  }

  // Selective cache warming for specific data types
  async warmUserCache(userId: string): Promise<void> {
    try {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true },
      });

      if (!user) return;

      // Warm user permissions
      const permissions = await this.getUserPermissions(user.id, user.role);
      await cache.set(CacheKeys.userPermissions(user.id), permissions, CacheTTL.LONG);

      // Warm user-specific evidence list
      await FilesCacheWarming.warmUserEvidence(user.id);

      console.log(`Cache warmed for user ${userId}`);
    } catch (error) {
      console.error(`Failed to warm cache for user ${userId}:`, error);
    }
  }

  async warmAcademicYearCache(): Promise<void> {
    try {
      await this.warmStaticData();
      await APICacheWarming.warmAcademicYears();
      console.log('Academic year cache warmed');
    } catch (error) {
      console.error('Failed to warm academic year cache:', error);
    }
  }

  // Cache health monitoring
  async getCacheHealth(): Promise<{
    redis: boolean;
    keyCount: number;
    memoryUsage?: string;
  }> {
    try {
      const isHealthy = await cache.healthCheck();
      
      if (!isHealthy) {
        return { redis: false, keyCount: 0 };
      }

      // Get cache statistics
      const redis = cache['redis'];
      if (redis) {
        const info = await redis.info('memory');
        const keyCount = await redis.dbsize();
        
        // Parse memory usage from info string
        const memoryMatch = info.match(/used_memory_human:([^\r\n]+)/);
        const memoryUsage = memoryMatch ? memoryMatch[1] : 'unknown';

        return {
          redis: true,
          keyCount,
          memoryUsage,
        };
      }

      return { redis: true, keyCount: 0 };
    } catch (error) {
      console.error('Failed to get cache health:', error);
      return { redis: false, keyCount: 0 };
    }
  }
}

// Export singleton instance
export const cacheWarmingService = new CacheWarmingService();

// Scheduled cache warming (can be called by cron jobs)
export async function scheduledCacheWarming(): Promise<void> {
  console.log('Running scheduled cache warming...');
  await cacheWarmingService.warmCriticalCaches();
}

// Cache warming on application startup
export async function startupCacheWarming(): Promise<void> {
  // Don't block application startup, run in background
  setTimeout(async () => {
    await cacheWarmingService.warmCriticalCaches();
  }, 5000); // Wait 5 seconds after startup
}