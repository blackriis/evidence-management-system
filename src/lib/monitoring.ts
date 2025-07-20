/**
 * Production Monitoring and Alerting System
 * Monitors system health, performance, and sends alerts
 */

import { logger } from './logger';
import { config, monitoringConfig } from './config';
import { prisma } from './db';

export interface SystemMetrics {
  timestamp: string;
  cpu: {
    usage: number;
    load: number[];
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  database: {
    connections: number;
    activeQueries: number;
    slowQueries: number;
  };
  storage: {
    used: number;
    available: number;
    percentage: number;
  };
  api: {
    requestsPerMinute: number;
    averageResponseTime: number;
    errorRate: number;
  };
  uploads: {
    activeUploads: number;
    failedUploads: number;
    totalSize: number;
  };
}

export interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: string;
  resolved: boolean;
  metadata?: Record<string, any>;
}

class MonitoringService {
  private metrics: SystemMetrics[] = [];
  private alerts: Alert[] = [];
  private isMonitoring: boolean = false;
  private monitoringInterval?: NodeJS.Timeout;

  constructor() {
    if (monitoringConfig.performanceMonitoring) {
      this.startMonitoring();
    }
  }

  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    logger.info('Starting system monitoring');

    // Collect metrics every 30 seconds
    this.monitoringInterval = setInterval(async () => {
      try {
        const metrics = await this.collectMetrics();
        this.metrics.push(metrics);
        
        // Keep only last 1000 metrics (about 8 hours at 30s intervals)
        if (this.metrics.length > 1000) {
          this.metrics = this.metrics.slice(-1000);
        }

        // Check for alerts
        await this.checkAlerts(metrics);
      } catch (error) {
        logger.error('Failed to collect metrics', error as Error);
      }
    }, monitoringConfig.healthCheck.interval);
  }

  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    this.isMonitoring = false;
    logger.info('Stopped system monitoring');
  }

  private async collectMetrics(): Promise<SystemMetrics> {
    const timestamp = new Date().toISOString();

    // CPU and Memory metrics (Node.js process)
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    // Database metrics
    const dbMetrics = await this.getDatabaseMetrics();

    // Storage metrics
    const storageMetrics = await this.getStorageMetrics();

    // API metrics (would need to be tracked separately)
    const apiMetrics = this.getApiMetrics();

    // Upload metrics
    const uploadMetrics = await this.getUploadMetrics();

    return {
      timestamp,
      cpu: {
        usage: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to seconds
        load: [0, 0, 0], // Would need OS-specific implementation
      },
      memory: {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal,
        percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
      },
      database: dbMetrics,
      storage: storageMetrics,
      api: apiMetrics,
      uploads: uploadMetrics,
    };
  }

  private async getDatabaseMetrics(): Promise<SystemMetrics['database']> {
    try {
      // Get database connection info
      const result = await prisma.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(*) as count FROM pg_stat_activity WHERE state = 'active'
      `;
      
      const activeConnections = Number(result[0]?.count || 0);

      // Get slow queries count (queries > 1 second)
      const slowQueries = await prisma.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(*) as count FROM pg_stat_statements 
        WHERE mean_time > 1000
      `;

      return {
        connections: activeConnections,
        activeQueries: activeConnections,
        slowQueries: Number(slowQueries[0]?.count || 0),
      };
    } catch (error) {
      logger.error('Failed to get database metrics', error as Error);
      return {
        connections: 0,
        activeQueries: 0,
        slowQueries: 0,
      };
    }
  }

  private async getStorageMetrics(): Promise<SystemMetrics['storage']> {
    try {
      // Get total evidence file sizes
      const result = await prisma.evidence.aggregate({
        _sum: {
          fileSize: true,
        },
        where: {
          deletedAt: null,
        },
      });

      const usedStorage = result._sum.fileSize || 0;
      const maxStorage = config.MAX_FILES_PER_USER_PER_YEAR * 1000; // Rough estimate

      return {
        used: usedStorage,
        available: maxStorage - usedStorage,
        percentage: (usedStorage / maxStorage) * 100,
      };
    } catch (error) {
      logger.error('Failed to get storage metrics', error as Error);
      return {
        used: 0,
        available: 0,
        percentage: 0,
      };
    }
  }

  private getApiMetrics(): SystemMetrics['api'] {
    // This would need to be implemented with actual request tracking
    // For now, return placeholder values
    return {
      requestsPerMinute: 0,
      averageResponseTime: 0,
      errorRate: 0,
    };
  }

  private async getUploadMetrics(): Promise<SystemMetrics['uploads']> {
    try {
      // Get recent upload statistics
      const recentUploads = await prisma.evidence.count({
        where: {
          uploadedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
        },
      });

      const totalSize = await prisma.evidence.aggregate({
        _sum: {
          fileSize: true,
        },
        where: {
          uploadedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
          deletedAt: null,
        },
      });

      return {
        activeUploads: 0, // Would need real-time tracking
        failedUploads: 0, // Would need error tracking
        totalSize: totalSize._sum.fileSize || 0,
      };
    } catch (error) {
      logger.error('Failed to get upload metrics', error as Error);
      return {
        activeUploads: 0,
        failedUploads: 0,
        totalSize: 0,
      };
    }
  }

  private async checkAlerts(metrics: SystemMetrics): Promise<void> {
    const alerts: Alert[] = [];

    // Memory usage alert
    if (metrics.memory.percentage > 90) {
      alerts.push({
        id: `memory-${Date.now()}`,
        type: 'critical',
        title: 'High Memory Usage',
        message: `Memory usage is at ${metrics.memory.percentage.toFixed(1)}%`,
        timestamp: metrics.timestamp,
        resolved: false,
        metadata: { memoryUsage: metrics.memory },
      });
    } else if (metrics.memory.percentage > 80) {
      alerts.push({
        id: `memory-${Date.now()}`,
        type: 'warning',
        title: 'Elevated Memory Usage',
        message: `Memory usage is at ${metrics.memory.percentage.toFixed(1)}%`,
        timestamp: metrics.timestamp,
        resolved: false,
        metadata: { memoryUsage: metrics.memory },
      });
    }

    // Storage usage alert
    if (metrics.storage.percentage > 90) {
      alerts.push({
        id: `storage-${Date.now()}`,
        type: 'critical',
        title: 'Storage Almost Full',
        message: `Storage usage is at ${metrics.storage.percentage.toFixed(1)}%`,
        timestamp: metrics.timestamp,
        resolved: false,
        metadata: { storageUsage: metrics.storage },
      });
    } else if (metrics.storage.percentage > 80) {
      alerts.push({
        id: `storage-${Date.now()}`,
        type: 'warning',
        title: 'High Storage Usage',
        message: `Storage usage is at ${metrics.storage.percentage.toFixed(1)}%`,
        timestamp: metrics.timestamp,
        resolved: false,
        metadata: { storageUsage: metrics.storage },
      });
    }

    // Database connection alert
    if (metrics.database.connections > 40) {
      alerts.push({
        id: `db-connections-${Date.now()}`,
        type: 'warning',
        title: 'High Database Connections',
        message: `Database has ${metrics.database.connections} active connections`,
        timestamp: metrics.timestamp,
        resolved: false,
        metadata: { databaseMetrics: metrics.database },
      });
    }

    // Slow queries alert
    if (metrics.database.slowQueries > 10) {
      alerts.push({
        id: `slow-queries-${Date.now()}`,
        type: 'warning',
        title: 'Multiple Slow Queries Detected',
        message: `${metrics.database.slowQueries} slow queries detected`,
        timestamp: metrics.timestamp,
        resolved: false,
        metadata: { databaseMetrics: metrics.database },
      });
    }

    // Process alerts
    for (const alert of alerts) {
      await this.processAlert(alert);
    }
  }

  private async processAlert(alert: Alert): Promise<void> {
    // Add to alerts array
    this.alerts.push(alert);

    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }

    // Log the alert
    if (alert.type === 'critical') {
      logger.error(`[ALERT] ${alert.title}: ${alert.message}`, undefined, alert.metadata);
    } else if (alert.type === 'warning') {
      logger.warn(`[ALERT] ${alert.title}: ${alert.message}`, alert.metadata);
    } else {
      logger.info(`[ALERT] ${alert.title}: ${alert.message}`, alert.metadata);
    }

    // Send notifications (email, Line, etc.)
    await this.sendAlertNotification(alert);
  }

  private async sendAlertNotification(alert: Alert): Promise<void> {
    try {
      // This would integrate with notification services
      // For now, just log that we would send a notification
      logger.info(`Would send ${alert.type} alert notification: ${alert.title}`);

      // Example integrations:
      // - Email to administrators
      // - Line Notify to operations team
      // - Slack/Discord webhooks
      // - SMS for critical alerts
    } catch (error) {
      logger.error('Failed to send alert notification', error as Error);
    }
  }

  // Public methods for accessing monitoring data
  getLatestMetrics(): SystemMetrics | null {
    return this.metrics[this.metrics.length - 1] || null;
  }

  getMetricsHistory(minutes: number = 60): SystemMetrics[] {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    return this.metrics.filter(m => new Date(m.timestamp) >= cutoff);
  }

  getActiveAlerts(): Alert[] {
    return this.alerts.filter(a => !a.resolved);
  }

  getAllAlerts(): Alert[] {
    return [...this.alerts];
  }

  resolveAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      logger.info(`Alert resolved: ${alert.title}`);
    }
  }

  // Health check endpoint data
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    services: Record<string, 'up' | 'down' | 'degraded'>;
    metrics?: SystemMetrics;
  }> {
    const timestamp = new Date().toISOString();
    const services: Record<string, 'up' | 'down' | 'degraded'> = {};

    // Check database
    try {
      await prisma.$queryRaw`SELECT 1`;
      services.database = 'up';
    } catch (error) {
      services.database = 'down';
      logger.error('Database health check failed', error as Error);
    }

    // Check Redis (if configured)
    services.redis = 'up'; // Would implement actual Redis check

    // Check file storage
    services.storage = 'up'; // Would implement actual storage check

    // Determine overall status
    const downServices = Object.values(services).filter(s => s === 'down').length;
    const degradedServices = Object.values(services).filter(s => s === 'degraded').length;

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (downServices > 0) {
      status = 'unhealthy';
    } else if (degradedServices > 0) {
      status = 'degraded';
    } else {
      status = 'healthy';
    }

    return {
      status,
      timestamp,
      services,
      metrics: this.getLatestMetrics() || undefined,
    };
  }
}

// Create singleton monitoring service
export const monitoring = new MonitoringService();

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, stopping monitoring');
  monitoring.stopMonitoring();
});

process.on('SIGINT', () => {
  logger.info('Received SIGINT, stopping monitoring');
  monitoring.stopMonitoring();
});

export default monitoring;