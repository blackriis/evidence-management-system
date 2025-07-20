import { AuditRetentionService } from '../audit-retention';
import { db } from '@/lib/db';
import { AuditLogger } from '@/lib/audit-logger';

// Mock dependencies
jest.mock('@/lib/db', () => ({
  db: {
    auditLog: {
      deleteMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      groupBy: jest.fn(),
    },
  },
}));

jest.mock('@/lib/audit-logger', () => ({
  AuditLogger: {
    log: jest.fn(),
  },
}));

// Mock console methods to avoid test output noise
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

const mockDb = db as jest.Mocked<typeof db>;
const mockAuditLogger = AuditLogger as jest.Mocked<typeof AuditLogger>;

describe('AuditRetentionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock Date to ensure consistent testing
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-01T00:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
    mockConsoleLog.mockClear();
    mockConsoleError.mockClear();
  });

  describe('cleanupOldLogs', () => {
    it('should delete audit logs older than default retention period (7 years)', async () => {
      const mockDeleteResult = { count: 150 };
      mockDb.auditLog.deleteMany.mockResolvedValue(mockDeleteResult);
      mockAuditLogger.log.mockResolvedValue(undefined);

      const result = await AuditRetentionService.cleanupOldLogs();

      // Calculate expected cutoff date (7 years ago)
      const expectedCutoffDate = new Date('2024-01-01T00:00:00Z');
      expectedCutoffDate.setDate(expectedCutoffDate.getDate() - 2555);

      expect(mockDb.auditLog.deleteMany).toHaveBeenCalledWith({
        where: {
          timestamp: {
            lt: expectedCutoffDate,
          },
        },
      });

      expect(mockAuditLogger.log).toHaveBeenCalledWith({
        action: 'DELETE',
        resource: 'audit_logs',
        metadata: {
          retentionDays: 2555,
          cutoffDate: expectedCutoffDate.toISOString(),
          deletedCount: 150,
          automated: true,
        },
      });

      expect(result).toBe(150);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        'Cleaned up 150 audit log entries older than 2555 days'
      );
    });

    it('should delete audit logs older than custom retention period', async () => {
      const customRetentionDays = 365; // 1 year
      const mockDeleteResult = { count: 75 };
      mockDb.auditLog.deleteMany.mockResolvedValue(mockDeleteResult);
      mockAuditLogger.log.mockResolvedValue(undefined);

      const result = await AuditRetentionService.cleanupOldLogs(customRetentionDays);

      const expectedCutoffDate = new Date('2024-01-01T00:00:00Z');
      expectedCutoffDate.setDate(expectedCutoffDate.getDate() - customRetentionDays);

      expect(mockDb.auditLog.deleteMany).toHaveBeenCalledWith({
        where: {
          timestamp: {
            lt: expectedCutoffDate,
          },
        },
      });

      expect(mockAuditLogger.log).toHaveBeenCalledWith({
        action: 'DELETE',
        resource: 'audit_logs',
        metadata: {
          retentionDays: customRetentionDays,
          cutoffDate: expectedCutoffDate.toISOString(),
          deletedCount: 75,
          automated: true,
        },
      });

      expect(result).toBe(75);
    });

    it('should handle case when no logs are deleted', async () => {
      const mockDeleteResult = { count: 0 };
      mockDb.auditLog.deleteMany.mockResolvedValue(mockDeleteResult);
      mockAuditLogger.log.mockResolvedValue(undefined);

      const result = await AuditRetentionService.cleanupOldLogs();

      expect(result).toBe(0);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        'Cleaned up 0 audit log entries older than 2555 days'
      );
    });

    it('should handle database errors during deletion', async () => {
      const dbError = new Error('Database connection failed');
      mockDb.auditLog.deleteMany.mockRejectedValue(dbError);

      await expect(AuditRetentionService.cleanupOldLogs()).rejects.toThrow(dbError);

      expect(mockConsoleError).toHaveBeenCalledWith(
        'Error cleaning up audit logs:',
        dbError
      );
      expect(mockAuditLogger.log).not.toHaveBeenCalled();
    });

    it('should handle audit logging errors gracefully', async () => {
      const mockDeleteResult = { count: 50 };
      const auditError = new Error('Audit logging failed');
      
      mockDb.auditLog.deleteMany.mockResolvedValue(mockDeleteResult);
      mockAuditLogger.log.mockRejectedValue(auditError);

      await expect(AuditRetentionService.cleanupOldLogs()).rejects.toThrow(auditError);

      expect(mockDb.auditLog.deleteMany).toHaveBeenCalled();
      expect(mockConsoleError).toHaveBeenCalledWith(
        'Error cleaning up audit logs:',
        auditError
      );
    });
  });

  describe('getRetentionStats', () => {
    const mockStatsData = {
      total: 1000,
      oldestEntry: { timestamp: new Date('2020-01-01T00:00:00Z') },
      newestEntry: { timestamp: new Date('2024-01-01T00:00:00Z') },
      sizeByAction: [
        { action: 'CREATE', _count: { id: 500 } },
        { action: 'UPDATE', _count: { id: 300 } },
        { action: 'DELETE', _count: { id: 200 } },
      ],
      sizeByResource: [
        { resource: 'evidence', _count: { id: 600 } },
        { resource: 'users', _count: { id: 250 } },
        { resource: 'evaluations', _count: { id: 150 } },
      ],
    };

    it('should return comprehensive retention statistics', async () => {
      mockDb.auditLog.count.mockResolvedValue(mockStatsData.total);
      mockDb.auditLog.findFirst
        .mockResolvedValueOnce(mockStatsData.oldestEntry)
        .mockResolvedValueOnce(mockStatsData.newestEntry);
      mockDb.auditLog.groupBy
        .mockResolvedValueOnce(mockStatsData.sizeByAction)
        .mockResolvedValueOnce(mockStatsData.sizeByResource);

      const result = await AuditRetentionService.getRetentionStats();

      expect(result).toEqual({
        total: 1000,
        oldestEntry: new Date('2020-01-01T00:00:00Z'),
        newestEntry: new Date('2024-01-01T00:00:00Z'),
        sizeByAction: [
          { action: 'CREATE', count: 500 },
          { action: 'UPDATE', count: 300 },
          { action: 'DELETE', count: 200 },
        ],
        sizeByResource: [
          { resource: 'evidence', count: 600 },
          { resource: 'users', count: 250 },
          { resource: 'evaluations', count: 150 },
        ],
      });

      expect(mockDb.auditLog.count).toHaveBeenCalled();
      expect(mockDb.auditLog.findFirst).toHaveBeenCalledTimes(2);
      expect(mockDb.auditLog.findFirst).toHaveBeenCalledWith({
        orderBy: { timestamp: 'asc' },
        select: { timestamp: true },
      });
      expect(mockDb.auditLog.findFirst).toHaveBeenCalledWith({
        orderBy: { timestamp: 'desc' },
        select: { timestamp: true },
      });
      expect(mockDb.auditLog.groupBy).toHaveBeenCalledTimes(2);
    });

    it('should handle empty audit log table', async () => {
      mockDb.auditLog.count.mockResolvedValue(0);
      mockDb.auditLog.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      mockDb.auditLog.groupBy
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await AuditRetentionService.getRetentionStats();

      expect(result).toEqual({
        total: 0,
        oldestEntry: null,
        newestEntry: null,
        sizeByAction: [],
        sizeByResource: [],
      });
    });

    it('should handle database errors when getting statistics', async () => {
      const dbError = new Error('Statistics query failed');
      mockDb.auditLog.count.mockRejectedValue(dbError);

      await expect(AuditRetentionService.getRetentionStats()).rejects.toThrow(dbError);

      expect(mockConsoleError).toHaveBeenCalledWith(
        'Error getting audit log statistics:',
        dbError
      );
    });

    it('should handle partial data retrieval failures', async () => {
      mockDb.auditLog.count.mockResolvedValue(1000);
      mockDb.auditLog.findFirst.mockRejectedValue(new Error('Query failed'));

      await expect(AuditRetentionService.getRetentionStats()).rejects.toThrow(
        'Query failed'
      );
    });
  });

  describe('archiveOldLogs', () => {
    it('should log placeholder message for archive functionality', async () => {
      await AuditRetentionService.archiveOldLogs();

      expect(mockConsoleLog).toHaveBeenCalledWith(
        'Archive functionality not yet implemented for logs older than 2555 days'
      );
    });

    it('should accept custom retention days parameter', async () => {
      const customDays = 180;
      await AuditRetentionService.archiveOldLogs(customDays);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        `Archive functionality not yet implemented for logs older than ${customDays} days`
      );
    });
  });

  describe('scheduleCleanup', () => {
    it('should perform successful scheduled cleanup', async () => {
      const mockDeleteResult = { count: 100 };
      mockDb.auditLog.deleteMany.mockResolvedValue(mockDeleteResult);
      mockAuditLogger.log.mockResolvedValue(undefined);

      await AuditRetentionService.scheduleCleanup();

      expect(mockDb.auditLog.deleteMany).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith(
        'Scheduled cleanup completed: 100 audit logs deleted'
      );
    });

    it('should not log success message when no logs are deleted', async () => {
      const mockDeleteResult = { count: 0 };
      mockDb.auditLog.deleteMany.mockResolvedValue(mockDeleteResult);
      mockAuditLogger.log.mockResolvedValue(undefined);

      await AuditRetentionService.scheduleCleanup();

      expect(mockConsoleLog).not.toHaveBeenCalledWith(
        expect.stringContaining('Scheduled cleanup completed')
      );
    });

    it('should handle cleanup errors and log them', async () => {
      const cleanupError = new Error('Cleanup failed');
      mockDb.auditLog.deleteMany.mockRejectedValue(cleanupError);
      mockAuditLogger.log.mockResolvedValue(undefined);

      await AuditRetentionService.scheduleCleanup();

      expect(mockConsoleError).toHaveBeenCalledWith(
        'Scheduled audit log cleanup failed:',
        cleanupError
      );

      expect(mockAuditLogger.log).toHaveBeenCalledWith({
        action: 'SYSTEM_CONFIG',
        resource: 'audit_logs',
        metadata: {
          error: 'Cleanup failed',
          operation: 'scheduled_cleanup',
          automated: true,
        },
      });
    });

    it('should handle non-Error objects in cleanup failures', async () => {
      const unknownError = 'Unknown error string';
      mockDb.auditLog.deleteMany.mockRejectedValue(unknownError);
      mockAuditLogger.log.mockResolvedValue(undefined);

      await AuditRetentionService.scheduleCleanup();

      expect(mockAuditLogger.log).toHaveBeenCalledWith({
        action: 'SYSTEM_CONFIG',
        resource: 'audit_logs',
        metadata: {
          error: 'Unknown error',
          operation: 'scheduled_cleanup',
          automated: true,
        },
      });
    });

    it('should handle audit logging errors during error reporting', async () => {
      const cleanupError = new Error('Cleanup failed');
      const auditError = new Error('Audit log failed');
      
      mockDb.auditLog.deleteMany.mockRejectedValue(cleanupError);
      mockAuditLogger.log.mockRejectedValue(auditError);

      // Should not throw, should handle gracefully
      await AuditRetentionService.scheduleCleanup();

      expect(mockConsoleError).toHaveBeenCalledWith(
        'Scheduled audit log cleanup failed:',
        cleanupError
      );
    });
  });

  describe('Date calculations', () => {
    it('should calculate correct cutoff dates for different retention periods', async () => {
      mockDb.auditLog.deleteMany.mockResolvedValue({ count: 0 });
      mockAuditLogger.log.mockResolvedValue(undefined);

      // Test with different retention periods
      const testCases = [
        { days: 30, description: '30 days' },
        { days: 365, description: '1 year' },
        { days: 1825, description: '5 years' },
        { days: 2555, description: '7 years (default)' },
      ];

      for (const testCase of testCases) {
        jest.clearAllMocks();
        
        await AuditRetentionService.cleanupOldLogs(testCase.days);

        const expectedCutoffDate = new Date('2024-01-01T00:00:00Z');
        expectedCutoffDate.setDate(expectedCutoffDate.getDate() - testCase.days);

        expect(mockDb.auditLog.deleteMany).toHaveBeenCalledWith({
          where: {
            timestamp: {
              lt: expectedCutoffDate,
            },
          },
        });
      }
    });
  });
});