import { NextRequest, NextResponse } from 'next/server';
import { performanceMonitor } from '@/lib/performance-monitor';
import { checkDatabaseHealth, getDatabaseMetrics } from '@/lib/db';
import { cache } from '@/lib/cache';

// GET /api/performance/metrics
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const timeWindow = parseInt(searchParams.get('timeWindow') || '3600000'); // 1 hour default
    const includeSystem = searchParams.get('includeSystem') === 'true';

    // Get performance statistics
    const stats = performanceMonitor.getPerformanceStats(timeWindow);

    // Add database health information
    const dbHealth = await checkDatabaseHealth();
    const dbMetrics = await getDatabaseMetrics();

    // Add cache health information
    const cacheHealth = await cache.healthCheck();

    const response = {
      timestamp: Date.now(),
      timeWindow,
      performance: stats,
      health: {
        database: dbHealth,
        cache: cacheHealth,
      },
      database: dbMetrics,
    };

    // Include system metrics if requested
    if (includeSystem) {
      response.system = {
        memory: process.memoryUsage(),
        uptime: process.uptime(),
        version: process.version,
        platform: process.platform,
        arch: process.arch,
      };
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Performance metrics API error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve performance metrics' },
      { status: 500 }
    );
  }
}

// POST /api/performance/metrics (for manual metric recording)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, metric } = body;

    switch (type) {
      case 'api':
        performanceMonitor.recordAPIMetric(metric);
        break;
      case 'database':
        performanceMonitor.recordDBMetric(metric);
        break;
      case 'system':
        performanceMonitor.recordSystemMetric(metric);
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid metric type' },
          { status: 400 }
        );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Performance metrics recording error:', error);
    return NextResponse.json(
      { error: 'Failed to record metric' },
      { status: 500 }
    );
  }
}