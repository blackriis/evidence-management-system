import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withSecurityHeaders } from "@/lib/security-headers";

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  services: {
    database: {
      status: 'up' | 'down';
      responseTime?: number;
    };
    storage: {
      status: 'up' | 'down';
      responseTime?: number;
    };
    redis?: {
      status: 'up' | 'down';
      responseTime?: number;
    };
  };
  security: {
    rateLimiting: boolean;
    csrfProtection: boolean;
    securityHeaders: boolean;
    auditLogging: boolean;
  };
  metrics?: {
    activeUsers?: number;
    totalEvidence?: number;
    recentSecurityEvents?: number;
  };
}

async function healthHandler(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  const result: HealthCheckResult = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    services: {
      database: { status: 'down' },
      storage: { status: 'down' },
    },
    security: {
      rateLimiting: true,
      csrfProtection: true,
      securityHeaders: true,
      auditLogging: true,
    },
  };

  try {
    // Check database connectivity
    const dbStart = Date.now();
    await db.$queryRaw`SELECT 1`;
    result.services.database = {
      status: 'up',
      responseTime: Date.now() - dbStart,
    };

    // Redis check disabled for edge runtime compatibility
    if (process.env.REDIS_URL) {
      result.services.redis = { status: 'down' };
      result.status = 'degraded';
      console.log('Redis check disabled for edge runtime compatibility');
    }

    // Storage check (simplified - just check if environment variables are set)
    if (process.env.S3_ENDPOINT || process.env.AWS_S3_BUCKET_NAME) {
      result.services.storage.status = 'up';
      result.services.storage.responseTime = 0; // Placeholder
    }

    // Get basic metrics (only for admin users or internal monitoring)
    const isInternalCheck = request.headers.get('x-internal-health-check') === 'true';
    if (isInternalCheck) {
      try {
        const [activeUsersCount, totalEvidenceCount, recentSecurityEvents] = await Promise.all([
          db.user.count({ where: { isActive: true } }),
          db.evidence.count({ where: { deletedAt: null } }),
          db.auditLog.count({
            where: {
              action: {
                in: ['SECURITY_VIOLATION', 'RATE_LIMIT_EXCEEDED', 'CSRF_VIOLATION', 'MALWARE_DETECTED', 'UNAUTHORIZED_ACCESS']
              },
              timestamp: {
                gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
              }
            }
          })
        ]);

        result.metrics = {
          activeUsers: activeUsersCount,
          totalEvidence: totalEvidenceCount,
          recentSecurityEvents: recentSecurityEvents,
        };

        // Alert if there are recent security events
        if (recentSecurityEvents > 10) {
          result.status = 'degraded';
        }
      } catch (error) {
        console.warn('Failed to fetch health metrics:', error);
      }
    }

    // Determine overall status
    const servicesDown = Object.values(result.services).filter(service => service.status === 'down').length;
    if (servicesDown > 0) {
      result.status = servicesDown === Object.keys(result.services).length ? 'unhealthy' : 'degraded';
    }

  } catch (error) {
    console.error('Health check failed:', error);
    result.status = 'unhealthy';
    result.services.database.status = 'down';
  }

  // Return appropriate HTTP status code
  const statusCode = result.status === 'healthy' ? 200 : result.status === 'degraded' ? 200 : 503;

  const response = NextResponse.json(result, { status: statusCode });
  
  // Add cache headers
  response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');

  return response;
}

// Apply security headers
export const GET = withSecurityHeaders({
  contentSecurityPolicy: {
    directives: {
      'default-src': ["'none'"],
      'script-src': ["'none'"],
      'style-src': ["'none'"],
      'img-src': ["'none'"],
      'connect-src': ["'none'"],
      'font-src': ["'none'"],
      'object-src': ["'none'"],
      'media-src': ["'none'"],
      'frame-src': ["'none'"],
    }
  }
})(healthHandler);