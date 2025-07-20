import { db } from '@/lib/db';
import { AuditLogger } from '@/lib/audit-logger';

export class AuditRetentionService {
  /**
   * Default retention period in days (7 years)
   */
  private static readonly DEFAULT_RETENTION_DAYS = 2555; // ~7 years

  /**
   * Clean up audit logs older than the specified retention period
   */
  static async cleanupOldLogs(retentionDays: number = this.DEFAULT_RETENTION_DAYS): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const result = await db.auditLog.deleteMany({
        where: {
          timestamp: {
            lt: cutoffDate,
          },
        },
      });

      // Log the cleanup action (system action, no user)
      await AuditLogger.log({
        action: 'DELETE',
        resource: 'audit_logs',
        metadata: {
          retentionDays,
          cutoffDate: cutoffDate.toISOString(),
          deletedCount: result.count,
          automated: true,
        },
      });

      console.log(`Cleaned up ${result.count} audit log entries older than ${retentionDays} days`);
      return result.count;
    } catch (error) {
      console.error('Error cleaning up audit logs:', error);
      throw error;
    }
  }

  /**
   * Get audit log statistics
   */
  static async getRetentionStats(): Promise<{
    total: number;
    oldestEntry: Date | null;
    newestEntry: Date | null;
    sizeByAction: Array<{ action: string; count: number }>;
    sizeByResource: Array<{ resource: string; count: number }>;
  }> {
    try {
      const [
        total,
        oldestEntry,
        newestEntry,
        sizeByAction,
        sizeByResource,
      ] = await Promise.all([
        db.auditLog.count(),
        db.auditLog.findFirst({
          orderBy: { timestamp: 'asc' },
          select: { timestamp: true },
        }),
        db.auditLog.findFirst({
          orderBy: { timestamp: 'desc' },
          select: { timestamp: true },
        }),
        db.auditLog.groupBy({
          by: ['action'],
          _count: { id: true },
          orderBy: { _count: { id: 'desc' } },
        }),
        db.auditLog.groupBy({
          by: ['resource'],
          _count: { id: true },
          orderBy: { _count: { id: 'desc' } },
        }),
      ]);

      return {
        total,
        oldestEntry: oldestEntry?.timestamp || null,
        newestEntry: newestEntry?.timestamp || null,
        sizeByAction: sizeByAction.map(item => ({
          action: item.action,
          count: item._count.id,
        })),
        sizeByResource: sizeByResource.map(item => ({
          resource: item.resource,
          count: item._count.id,
        })),
      };
    } catch (error) {
      console.error('Error getting audit log statistics:', error);
      throw error;
    }
  }

  /**
   * Archive old audit logs to a separate table or export before deletion
   * This is a placeholder for future implementation
   */
  static async archiveOldLogs(retentionDays: number = this.DEFAULT_RETENTION_DAYS): Promise<void> {
    // This could be implemented to:
    // 1. Export old logs to a file storage system
    // 2. Move them to an archive table
    // 3. Compress and store them for long-term retention
    
    console.log(`Archive functionality not yet implemented for logs older than ${retentionDays} days`);
  }

  /**
   * Schedule automatic cleanup (to be called by a cron job or scheduler)
   */
  static async scheduleCleanup(): Promise<void> {
    try {
      const deletedCount = await this.cleanupOldLogs();
      
      if (deletedCount > 0) {
        console.log(`Scheduled cleanup completed: ${deletedCount} audit logs deleted`);
      }
    } catch (error) {
      console.error('Scheduled audit log cleanup failed:', error);
      
      // Log the failure
      await AuditLogger.log({
        action: 'SYSTEM_CONFIG',
        resource: 'audit_logs',
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
          operation: 'scheduled_cleanup',
          automated: true,
        },
      });
    }
  }
}