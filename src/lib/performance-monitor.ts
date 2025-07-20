import { cache, CacheKeys, CacheTTL } from './cache';

// Performance metrics collection
export interface PerformanceMetric {
  timestamp: number;
  endpoint: string;
  method: string;
  duration: number;
  statusCode: number;
  userId?: string;
  userAgent?: string;
  ip?: string;
  memoryUsage?: NodeJS.MemoryUsage;
  error?: string;
}

// Database query performance tracking
export interface DatabaseMetric {
  timestamp: number;
  query: string;
  duration: number;
  rowCount?: number;
  error?: string;
}

// System health metrics
export interface SystemMetric {
  timestamp: number;
  cpuUsage: number;
  memoryUsage: NodeJS.MemoryUsage;
  activeConnections: number;
  cacheHitRate: number;
  diskUsage?: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private dbMetrics: DatabaseMetric[] = [];
  private systemMetrics: SystemMetric[] = [];
  private maxMetricsInMemory = 1000;
  private alertThresholds = {
    responseTime: 2000, // 2 seconds
    errorRate: 0.05, // 5%
    memoryUsage: 0.8, // 80%
    cpuUsage: 0.8, // 80%
  };

  // Record API performance metric
  recordAPIMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);
    
    // Keep only recent metrics in memory
    if (this.metrics.length > this.maxMetricsInMemory) {
      this.metrics = this.metrics.slice(-this.maxMetricsInMemory);
    }

    // Check for performance alerts
    this.checkPerformanceAlerts(metric);

    // Store in cache for dashboard
    this.updatePerformanceCache();
  }

  // Record database query metric
  recordDBMetric(metric: DatabaseMetric): void {
    this.dbMetrics.push(metric);
    
    if (this.dbMetrics.length > this.maxMetricsInMemory) {
      this.dbMetrics = this.dbMetrics.slice(-this.maxMetricsInMemory);
    }

    // Alert on slow queries
    if (metric.duration > 1000) { // 1 second
      console.warn(`Slow database query detected: ${metric.duration}ms`, {
        query: metric.query.substring(0, 100),
        duration: metric.duration,
      });
    }
  }

  // Record system health metric
  recordSystemMetric(metric: SystemMetric): void {
    this.systemMetrics.push(metric);
    
    if (this.systemMetrics.length > this.maxMetricsInMemory) {
      this.systemMetrics = this.systemMetrics.slice(-this.maxMetricsInMemory);
    }

    // Check system health alerts
    this.checkSystemAlerts(metric);
  }

  // Get performance statistics
  getPerformanceStats(timeWindow: number = 3600000): { // 1 hour default
    api: any;
    database: any;
    system: any;
  } {
    const now = Date.now();
    const cutoff = now - timeWindow;

    // API metrics
    const recentAPIMetrics = this.metrics.filter(m => m.timestamp > cutoff);
    const apiStats = this.calculateAPIStats(recentAPIMetrics);

    // Database metrics
    const recentDBMetrics = this.dbMetrics.filter(m => m.timestamp > cutoff);
    const dbStats = this.calculateDBStats(recentDBMetrics);

    // System metrics
    const recentSystemMetrics = this.systemMetrics.filter(m => m.timestamp > cutoff);
    const systemStats = this.calculateSystemStats(recentSystemMetrics);

    return {
      api: apiStats,
      database: dbStats,
      system: systemStats,
    };
  }

  // Calculate API statistics
  private calculateAPIStats(metrics: PerformanceMetric[]) {
    if (metrics.length === 0) {
      return {
        totalRequests: 0,
        averageResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        errorRate: 0,
        requestsPerMinute: 0,
      };
    }

    const durations = metrics.map(m => m.duration).sort((a, b) => a - b);
    const errors = metrics.filter(m => m.statusCode >= 400);
    const timeSpan = Math.max(metrics[metrics.length - 1].timestamp - metrics[0].timestamp, 60000);

    return {
      totalRequests: metrics.length,
      averageResponseTime: durations.reduce((a, b) => a + b, 0) / durations.length,
      p95ResponseTime: durations[Math.floor(durations.length * 0.95)] || 0,
      p99ResponseTime: durations[Math.floor(durations.length * 0.99)] || 0,
      errorRate: errors.length / metrics.length,
      requestsPerMinute: (metrics.length / timeSpan) * 60000,
      topEndpoints: this.getTopEndpoints(metrics),
      slowestEndpoints: this.getSlowestEndpoints(metrics),
    };
  }

  // Calculate database statistics
  private calculateDBStats(metrics: DatabaseMetric[]) {
    if (metrics.length === 0) {
      return {
        totalQueries: 0,
        averageQueryTime: 0,
        slowQueries: 0,
        queriesPerMinute: 0,
      };
    }

    const durations = metrics.map(m => m.duration).sort((a, b) => a - b);
    const slowQueries = metrics.filter(m => m.duration > 1000);
    const timeSpan = Math.max(metrics[metrics.length - 1].timestamp - metrics[0].timestamp, 60000);

    return {
      totalQueries: metrics.length,
      averageQueryTime: durations.reduce((a, b) => a + b, 0) / durations.length,
      slowQueries: slowQueries.length,
      queriesPerMinute: (metrics.length / timeSpan) * 60000,
      slowestQueries: this.getSlowestQueries(metrics),
    };
  }

  // Calculate system statistics
  private calculateSystemStats(metrics: SystemMetric[]) {
    if (metrics.length === 0) {
      return {
        averageCpuUsage: 0,
        averageMemoryUsage: 0,
        averageCacheHitRate: 0,
        peakMemoryUsage: 0,
      };
    }

    return {
      averageCpuUsage: metrics.reduce((a, m) => a + m.cpuUsage, 0) / metrics.length,
      averageMemoryUsage: metrics.reduce((a, m) => a + (m.memoryUsage.used / m.memoryUsage.total), 0) / metrics.length,
      averageCacheHitRate: metrics.reduce((a, m) => a + m.cacheHitRate, 0) / metrics.length,
      peakMemoryUsage: Math.max(...metrics.map(m => m.memoryUsage.used)),
      currentConnections: metrics[metrics.length - 1]?.activeConnections || 0,
    };
  }

  // Get top endpoints by request count
  private getTopEndpoints(metrics: PerformanceMetric[]) {
    const endpointCounts = metrics.reduce((acc, metric) => {
      const key = `${metric.method} ${metric.endpoint}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(endpointCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([endpoint, count]) => ({ endpoint, count }));
  }

  // Get slowest endpoints
  private getSlowestEndpoints(metrics: PerformanceMetric[]) {
    const endpointTimes = metrics.reduce((acc, metric) => {
      const key = `${metric.method} ${metric.endpoint}`;
      if (!acc[key]) {
        acc[key] = { total: 0, count: 0, max: 0 };
      }
      acc[key].total += metric.duration;
      acc[key].count += 1;
      acc[key].max = Math.max(acc[key].max, metric.duration);
      return acc;
    }, {} as Record<string, { total: number; count: number; max: number }>);

    return Object.entries(endpointTimes)
      .map(([endpoint, stats]) => ({
        endpoint,
        averageTime: stats.total / stats.count,
        maxTime: stats.max,
        count: stats.count,
      }))
      .sort((a, b) => b.averageTime - a.averageTime)
      .slice(0, 10);
  }

  // Get slowest database queries
  private getSlowestQueries(metrics: DatabaseMetric[]) {
    return metrics
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10)
      .map(metric => ({
        query: metric.query.substring(0, 100) + (metric.query.length > 100 ? '...' : ''),
        duration: metric.duration,
        timestamp: metric.timestamp,
      }));
  }

  // Check for performance alerts
  private checkPerformanceAlerts(metric: PerformanceMetric): void {
    // Response time alert
    if (metric.duration > this.alertThresholds.responseTime) {
      console.warn(`Slow API response detected: ${metric.duration}ms`, {
        endpoint: metric.endpoint,
        method: metric.method,
        userId: metric.userId,
      });
    }

    // Error rate alert (check recent error rate)
    const recentMetrics = this.metrics.slice(-100); // Last 100 requests
    const errorRate = recentMetrics.filter(m => m.statusCode >= 400).length / recentMetrics.length;
    
    if (errorRate > this.alertThresholds.errorRate) {
      console.error(`High error rate detected: ${(errorRate * 100).toFixed(2)}%`);
    }
  }

  // Check for system health alerts
  private checkSystemAlerts(metric: SystemMetric): void {
    // Memory usage alert
    const memoryUsagePercent = metric.memoryUsage.used / metric.memoryUsage.total;
    if (memoryUsagePercent > this.alertThresholds.memoryUsage) {
      console.warn(`High memory usage detected: ${(memoryUsagePercent * 100).toFixed(2)}%`);
    }

    // CPU usage alert
    if (metric.cpuUsage > this.alertThresholds.cpuUsage) {
      console.warn(`High CPU usage detected: ${(metric.cpuUsage * 100).toFixed(2)}%`);
    }

    // Low cache hit rate alert
    if (metric.cacheHitRate < 0.5) { // Less than 50%
      console.warn(`Low cache hit rate detected: ${(metric.cacheHitRate * 100).toFixed(2)}%`);
    }
  }

  // Update performance cache for dashboard
  private async updatePerformanceCache(): Promise<void> {
    try {
      const stats = this.getPerformanceStats();
      await cache.set('performance:stats', stats, CacheTTL.SHORT);
    } catch (error) {
      console.error('Failed to update performance cache:', error);
    }
  }

  // Get cached performance stats
  async getCachedStats() {
    return await cache.get('performance:stats') || this.getPerformanceStats();
  }

  // Clear metrics (for testing or maintenance)
  clearMetrics(): void {
    this.metrics = [];
    this.dbMetrics = [];
    this.systemMetrics = [];
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Middleware wrapper for API performance monitoring
export function withPerformanceMonitoring(
  handler: (req: any, res: any) => Promise<any>
) {
  return async (req: any, res: any) => {
    const startTime = Date.now();
    const startMemory = process.memoryUsage();

    try {
      const result = await handler(req, res);
      
      // Record successful request
      performanceMonitor.recordAPIMetric({
        timestamp: Date.now(),
        endpoint: req.url || req.nextUrl?.pathname || 'unknown',
        method: req.method || 'GET',
        duration: Date.now() - startTime,
        statusCode: res.status || 200,
        userId: req.headers?.['x-user-id'],
        userAgent: req.headers?.['user-agent'],
        ip: req.headers?.['x-forwarded-for'] || req.headers?.['x-real-ip'],
        memoryUsage: process.memoryUsage(),
      });

      return result;
    } catch (error) {
      // Record failed request
      performanceMonitor.recordAPIMetric({
        timestamp: Date.now(),
        endpoint: req.url || req.nextUrl?.pathname || 'unknown',
        method: req.method || 'GET',
        duration: Date.now() - startTime,
        statusCode: 500,
        userId: req.headers?.['x-user-id'],
        userAgent: req.headers?.['user-agent'],
        ip: req.headers?.['x-forwarded-for'] || req.headers?.['x-real-ip'],
        memoryUsage: process.memoryUsage(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  };
}

// Database query monitoring wrapper
export function withDatabaseMonitoring<T>(
  queryName: string,
  queryFn: () => Promise<T>
): Promise<T> {
  return new Promise(async (resolve, reject) => {
    const startTime = Date.now();

    try {
      const result = await queryFn();
      
      performanceMonitor.recordDBMetric({
        timestamp: Date.now(),
        query: queryName,
        duration: Date.now() - startTime,
        rowCount: Array.isArray(result) ? result.length : undefined,
      });

      resolve(result);
    } catch (error) {
      performanceMonitor.recordDBMetric({
        timestamp: Date.now(),
        query: queryName,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      reject(error);
    }
  });
}

// System health monitoring
export async function collectSystemMetrics(): Promise<void> {
  try {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    // Calculate CPU usage percentage (simplified)
    const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000 / 1000; // Convert to seconds, then to percentage

    // Get cache hit rate (if available)
    const cacheStats = await cache.get('cache:stats') || { hits: 0, misses: 0 };
    const cacheHitRate = cacheStats.hits + cacheStats.misses > 0 
      ? cacheStats.hits / (cacheStats.hits + cacheStats.misses) 
      : 0;

    performanceMonitor.recordSystemMetric({
      timestamp: Date.now(),
      cpuUsage: Math.min(cpuPercent, 1), // Cap at 100%
      memoryUsage: {
        ...memoryUsage,
        total: memoryUsage.heapTotal + memoryUsage.external,
        used: memoryUsage.heapUsed,
      },
      activeConnections: 0, // Would need to implement connection tracking
      cacheHitRate,
    });
  } catch (error) {
    console.error('Failed to collect system metrics:', error);
  }
}

// Start system monitoring (call this on app startup)
export function startSystemMonitoring(intervalMs: number = 60000): NodeJS.Timeout {
  return setInterval(collectSystemMetrics, intervalMs);
}