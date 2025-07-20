import { NotificationService } from '../notification';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { NotificationType } from '@prisma/client';

// Mock external dependencies
jest.mock('@/lib/db', () => ({
  db: {
    notification: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock Resend
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest.fn(),
    },
  })),
}));

// Mock fetch for Line Notify
global.fetch = jest.fn();

const mockDb = db as jest.Mocked<typeof db>;
const mockLogger = logger as jest.Mocked<typeof logger>;

describe('NotificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.RESEND_API_KEY = 'test-resend-key';
    process.env.LINE_NOTIFY_TOKEN = 'test-line-token';
    process.env.FROM_EMAIL = 'test@example.com';
  });

  afterEach(() => {
    delete process.env.RESEND_API_KEY;
    delete process.env.LINE_NOTIFY_TOKEN;
    delete process.env.FROM_EMAIL;
  });

  describe('createNotification', () => {
    const mockNotificationData = {
      userId: 'user-123',
      type: NotificationType.DEADLINE_REMINDER,
      title: 'Test Notification',
      message: 'This is a test notification',
      metadata: { key: 'value' },
    };

    const mockCreatedNotification = {
      id: 'notification-123',
      ...mockNotificationData,
      createdAt: new Date(),
      user: { id: 'user-123', email: 'test@example.com' },
    };

    it('should create a notification successfully', async () => {
      mockDb.notification.create.mockResolvedValue(mockCreatedNotification as any);

      const result = await NotificationService.createNotification(mockNotificationData);

      expect(mockDb.notification.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          type: NotificationType.DEADLINE_REMINDER,
          title: 'Test Notification',
          message: 'This is a test notification',
          scheduledFor: undefined,
          metadata: { key: 'value' },
        },
        include: {
          user: true,
        },
      });

      expect(result).toBe(mockCreatedNotification);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Notification created: notification-123 for user user-123'
      );
    });

    it('should handle scheduled notifications', async () => {
      const scheduledDate = new Date('2024-01-01T10:00:00Z');
      const scheduledData = {
        ...mockNotificationData,
        scheduledFor: scheduledDate,
      };

      mockDb.notification.create.mockResolvedValue({
        ...mockCreatedNotification,
        scheduledFor: scheduledDate,
      } as any);

      await NotificationService.createNotification(scheduledData);

      expect(mockDb.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            scheduledFor: scheduledDate,
          }),
        })
      );
    });

    it('should log and throw error on database failure', async () => {
      const dbError = new Error('Database connection failed');
      mockDb.notification.create.mockRejectedValue(dbError);

      await expect(
        NotificationService.createNotification(mockNotificationData)
      ).rejects.toThrow(dbError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to create notification:',
        dbError
      );
    });
  });

  describe('sendEmailNotification', () => {
    const mockResend = {
      emails: {
        send: jest.fn(),
      },
    };

    beforeEach(() => {
      const { Resend } = require('resend');
      Resend.mockImplementation(() => mockResend);
    });

    it('should send email successfully', async () => {
      mockResend.emails.send.mockResolvedValue({
        data: { id: 'email-123' },
      });

      const result = await NotificationService.sendEmailNotification(
        'test@example.com',
        'Test Subject',
        'Test message'
      );

      expect(mockResend.emails.send).toHaveBeenCalledWith({
        from: 'test@example.com',
        to: 'test@example.com',
        subject: 'Test Subject',
        html: expect.stringContaining('Test message'),
      });

      expect(result).toEqual({ success: true, id: 'email-123' });
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Email sent successfully to test@example.com: email-123'
      );
    });

    it('should return error when Resend is not configured', async () => {
      delete process.env.RESEND_API_KEY;

      const result = await NotificationService.sendEmailNotification(
        'test@example.com',
        'Test Subject',
        'Test message'
      );

      expect(result).toEqual({
        success: false,
        error: 'Email service not configured',
      });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Resend not configured, skipping email notification'
      );
    });

    it('should handle email sending failure', async () => {
      const emailError = new Error('SMTP server unavailable');
      mockResend.emails.send.mockRejectedValue(emailError);

      const result = await NotificationService.sendEmailNotification(
        'test@example.com',
        'Test Subject',
        'Test message'
      );

      expect(result).toEqual({
        success: false,
        error: 'SMTP server unavailable',
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to send email to test@example.com:',
        emailError
      );
    });

    it('should generate proper HTML email template', async () => {
      mockResend.emails.send.mockResolvedValue({
        data: { id: 'email-123' },
      });

      const metadata = {
        actionUrl: 'https://example.com/action',
        timestamp: '2024-01-01T10:00:00Z',
      };

      await NotificationService.sendEmailNotification(
        'test@example.com',
        'Test Subject',
        'Line 1\nLine 2',
        metadata
      );

      const expectedHtml = expect.stringContaining('Line 1<br>Line 2');
      const actionUrl = expect.stringContaining('https://example.com/action');
      const timestamp = expect.stringContaining('Generated at:');

      expect(mockResend.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringMatching(
            new RegExp([expectedHtml, actionUrl, timestamp].join('.*'), 's')
          ),
        })
      );
    });
  });

  describe('sendLineNotification', () => {
    const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

    it('should send Line notification successfully', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ status: 200, message: 'ok' }),
      } as Response);

      const result = await NotificationService.sendLineNotification('Test message');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://notify-api.line.me/api/notify',
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer test-line-token',
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({ message: 'Test message' }),
        }
      );

      expect(result).toEqual({
        success: true,
        result: { status: 200, message: 'ok' },
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Line notification sent successfully:',
        { status: 200, message: 'ok' }
      );
    });

    it('should return error when Line Notify is not configured', async () => {
      delete process.env.LINE_NOTIFY_TOKEN;

      const result = await NotificationService.sendLineNotification('Test message');

      expect(result).toEqual({
        success: false,
        error: 'Line Notify not configured',
      });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Line Notify not configured, skipping notification'
      );
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should handle Line API error response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
      } as Response);

      const result = await NotificationService.sendLineNotification('Test message');

      expect(result).toEqual({
        success: false,
        error: 'Line Notify API error: 401',
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to send Line notification:',
        expect.any(Error)
      );
    });

    it('should handle network failure', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await NotificationService.sendLineNotification('Test message');

      expect(result).toEqual({
        success: false,
        error: 'Network error',
      });
    });
  });

  describe('processNotification', () => {
    const mockNotification = {
      id: 'notification-123',
      title: 'Test Notification',
      message: 'Test message',
      metadata: { key: 'value' },
      user: {
        id: 'user-123',
        email: 'test@example.com',
        emailNotifications: true,
        lineNotifications: true,
      },
    };

    it('should process notification with both email and Line notifications', async () => {
      mockDb.notification.findUnique.mockResolvedValue(mockNotification as any);
      mockDb.notification.update.mockResolvedValue({} as any);

      // Mock successful email and Line sending
      const mockResend = {
        emails: { send: jest.fn().mockResolvedValue({ data: { id: 'email-123' } }) },
      };
      const { Resend } = require('resend');
      Resend.mockImplementation(() => mockResend);

      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        json: async () => ({ status: 200 }),
      } as Response);

      await NotificationService.processNotification('notification-123');

      expect(mockDb.notification.findUnique).toHaveBeenCalledWith({
        where: { id: 'notification-123' },
        include: { user: true },
      });

      expect(mockResend.emails.send).toHaveBeenCalled();
      expect(fetch).toHaveBeenCalled();

      expect(mockDb.notification.update).toHaveBeenCalledWith({
        where: { id: 'notification-123' },
        data: { sentAt: expect.any(Date) },
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Notification processed successfully: notification-123'
      );
    });

    it('should skip email when user has email notifications disabled', async () => {
      const notificationWithoutEmail = {
        ...mockNotification,
        user: { ...mockNotification.user, emailNotifications: false },
      };

      mockDb.notification.findUnique.mockResolvedValue(notificationWithoutEmail as any);
      mockDb.notification.update.mockResolvedValue({} as any);

      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        json: async () => ({ status: 200 }),
      } as Response);

      await NotificationService.processNotification('notification-123');

      // Should not attempt to send email
      const { Resend } = require('resend');
      const resendInstance = new Resend();
      expect(resendInstance.emails.send).not.toHaveBeenCalled();

      // Should still send Line notification
      expect(fetch).toHaveBeenCalled();
    });

    it('should handle notification not found', async () => {
      mockDb.notification.findUnique.mockResolvedValue(null);

      await NotificationService.processNotification('nonexistent-id');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Notification not found: nonexistent-id'
      );
      expect(mockDb.notification.update).not.toHaveBeenCalled();
    });

    it('should handle processing errors', async () => {
      const dbError = new Error('Database error');
      mockDb.notification.findUnique.mockRejectedValue(dbError);

      await expect(
        NotificationService.processNotification('notification-123')
      ).rejects.toThrow(dbError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to process notification notification-123:',
        dbError
      );
    });
  });

  describe('getPendingNotifications', () => {
    it('should retrieve pending notifications', async () => {
      const mockNotifications = [
        { id: 'notif-1', scheduledFor: null },
        { id: 'notif-2', scheduledFor: new Date('2024-01-01T09:00:00Z') },
      ];

      mockDb.notification.findMany.mockResolvedValue(mockNotifications as any);

      const result = await NotificationService.getPendingNotifications();

      expect(mockDb.notification.findMany).toHaveBeenCalledWith({
        where: {
          sentAt: null,
          OR: [
            { scheduledFor: null },
            { scheduledFor: { lte: expect.any(Date) } },
          ],
        },
        include: { user: true },
        orderBy: { createdAt: 'asc' },
      });

      expect(result).toBe(mockNotifications);
    });

    it('should handle database errors', async () => {
      const dbError = new Error('Database connection failed');
      mockDb.notification.findMany.mockRejectedValue(dbError);

      await expect(NotificationService.getPendingNotifications()).rejects.toThrow(dbError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get pending notifications:',
        dbError
      );
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      mockDb.notification.update.mockResolvedValue({} as any);

      await NotificationService.markAsRead('notification-123', 'user-123');

      expect(mockDb.notification.update).toHaveBeenCalledWith({
        where: {
          id: 'notification-123',
          userId: 'user-123',
        },
        data: { isRead: true },
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Notification marked as read: notification-123'
      );
    });

    it('should handle update errors', async () => {
      const dbError = new Error('Update failed');
      mockDb.notification.update.mockRejectedValue(dbError);

      await expect(
        NotificationService.markAsRead('notification-123', 'user-123')
      ).rejects.toThrow(dbError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to mark notification as read: notification-123',
        dbError
      );
    });
  });

  describe('getUserNotifications', () => {
    const mockNotifications = [
      { id: 'notif-1', isRead: false },
      { id: 'notif-2', isRead: true },
    ];

    it('should get all user notifications with pagination', async () => {
      mockDb.notification.findMany.mockResolvedValue(mockNotifications as any);
      mockDb.notification.count.mockResolvedValue(25);

      const result = await NotificationService.getUserNotifications(
        'user-123',
        10,
        5,
        false
      );

      expect(mockDb.notification.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        orderBy: { createdAt: 'desc' },
        take: 10,
        skip: 5,
      });

      expect(mockDb.notification.count).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
      });

      expect(result).toEqual({
        notifications: mockNotifications,
        total: 25,
      });
    });

    it('should filter unread notifications only', async () => {
      const unreadNotifications = [{ id: 'notif-1', isRead: false }];
      
      mockDb.notification.findMany.mockResolvedValue(unreadNotifications as any);
      mockDb.notification.count.mockResolvedValue(5);

      const result = await NotificationService.getUserNotifications(
        'user-123',
        20,
        0,
        true
      );

      expect(mockDb.notification.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123', isRead: false },
        orderBy: { createdAt: 'desc' },
        take: 20,
        skip: 0,
      });

      expect(result).toEqual({
        notifications: unreadNotifications,
        total: 5,
      });
    });

    it('should use default pagination parameters', async () => {
      mockDb.notification.findMany.mockResolvedValue([] as any);
      mockDb.notification.count.mockResolvedValue(0);

      await NotificationService.getUserNotifications('user-123');

      expect(mockDb.notification.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        orderBy: { createdAt: 'desc' },
        take: 20,
        skip: 0,
      });
    });

    it('should handle database errors', async () => {
      const dbError = new Error('Query failed');
      mockDb.notification.findMany.mockRejectedValue(dbError);

      await expect(
        NotificationService.getUserNotifications('user-123')
      ).rejects.toThrow(dbError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get notifications for user user-123:',
        dbError
      );
    });
  });
});