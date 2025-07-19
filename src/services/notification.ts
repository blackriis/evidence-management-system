import { Resend } from 'resend';
import { db } from '@/lib/db';
import { NotificationType } from '@prisma/client';
import { logger } from '@/lib/logger';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

interface NotificationData {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  scheduledFor?: Date;
  metadata?: Record<string, any>;
}

interface LineNotifyPayload {
  message: string;
}

export class NotificationService {
  // Create a notification record in the database
  static async createNotification(data: NotificationData) {
    try {
      const notification = await db.notification.create({
        data: {
          userId: data.userId,
          type: data.type,
          title: data.title,
          message: data.message,
          scheduledFor: data.scheduledFor,
          metadata: data.metadata,
        },
        include: {
          user: true,
        },
      });

      logger.info(`Notification created: ${notification.id} for user ${data.userId}`);
      return notification;
    } catch (error) {
      logger.error('Failed to create notification:', error);
      throw error;
    }
  }

  // Send email notification using Resend
  static async sendEmailNotification(
    email: string,
    subject: string,
    message: string,
    metadata?: Record<string, any>
  ) {
    if (!resend) {
      logger.warn('Resend not configured, skipping email notification');
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const result = await resend.emails.send({
        from: process.env.FROM_EMAIL || 'noreply@evidencemanagement.com',
        to: email,
        subject,
        html: this.generateEmailTemplate(subject, message, metadata),
      });

      const resultId = result.data?.id || 'unknown';
      logger.info(`Email sent successfully to ${email}: ${resultId}`);
      return { success: true, id: resultId };
    } catch (error) {
      logger.error(`Failed to send email to ${email}:`, error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Send Line Notify message
  static async sendLineNotification(message: string) {
    const lineToken = process.env.LINE_NOTIFY_TOKEN;
    
    if (!lineToken) {
      logger.warn('Line Notify not configured, skipping notification');
      return { success: false, error: 'Line Notify not configured' };
    }

    try {
      // const payload: LineNotifyPayload = { message };
      
      const response = await fetch('https://notify-api.line.me/api/notify', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lineToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ message }),
      });

      if (!response.ok) {
        throw new Error(`Line Notify API error: ${response.status}`);
      }

      const result = await response.json();
      logger.info('Line notification sent successfully:', result);
      return { success: true, result };
    } catch (error) {
      logger.error('Failed to send Line notification:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Process and send a notification based on user preferences
  static async processNotification(notificationId: string) {
    try {
      const notification = await db.notification.findUnique({
        where: { id: notificationId },
        include: { user: true },
      });

      if (!notification) {
        logger.error(`Notification not found: ${notificationId}`);
        return;
      }

      const { user, title, message, metadata } = notification;
      
      // Send email if user has email notifications enabled
      if (user.emailNotifications) {
        const emailResult = await this.sendEmailNotification(
          user.email,
          title,
          message,
          metadata as Record<string, any>
        );
        
        if (!emailResult.success) {
          logger.error(`Failed to send email for notification ${notificationId}:`, emailResult.error);
        }
      }

      // Send Line notification if user has Line notifications enabled
      if (user.lineNotifications) {
        const lineMessage = `${title}\n\n${message}`;
        const lineResult = await this.sendLineNotification(lineMessage);
        
        if (!lineResult.success) {
          logger.error(`Failed to send Line notification for ${notificationId}:`, lineResult.error);
        }
      }

      // Mark notification as sent
      await db.notification.update({
        where: { id: notificationId },
        data: { sentAt: new Date() },
      });

      logger.info(`Notification processed successfully: ${notificationId}`);
    } catch (error) {
      logger.error(`Failed to process notification ${notificationId}:`, error);
      throw error;
    }
  }

  // Get pending notifications (not yet sent and scheduled for now or earlier)
  static async getPendingNotifications() {
    try {
      const now = new Date();
      
      return await db.notification.findMany({
        where: {
          sentAt: null,
          OR: [
            { scheduledFor: null },
            { scheduledFor: { lte: now } },
          ],
        },
        include: { user: true },
        orderBy: { createdAt: 'asc' },
      });
    } catch (error) {
      logger.error('Failed to get pending notifications:', error);
      throw error;
    }
  }

  // Mark notification as read
  static async markAsRead(notificationId: string, userId: string) {
    try {
      await db.notification.update({
        where: {
          id: notificationId,
          userId: userId, // Ensure user can only mark their own notifications
        },
        data: { isRead: true },
      });
      
      logger.info(`Notification marked as read: ${notificationId}`);
    } catch (error) {
      logger.error(`Failed to mark notification as read: ${notificationId}`, error);
      throw error;
    }
  }

  // Get user notifications with pagination
  static async getUserNotifications(
    userId: string,
    limit: number = 20,
    offset: number = 0,
    unreadOnly: boolean = false
  ) {
    try {
      const where = {
        userId,
        ...(unreadOnly && { isRead: false }),
      };

      const [notifications, total] = await Promise.all([
        db.notification.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        db.notification.count({ where }),
      ]);

      return { notifications, total };
    } catch (error) {
      logger.error(`Failed to get notifications for user ${userId}:`, error);
      throw error;
    }
  }

  // Generate HTML email template
  private static generateEmailTemplate(
    subject: string,
    message: string,
    metadata?: Record<string, any>
  ): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
          .content { padding: 20px 0; }
          .footer { background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin-top: 20px; font-size: 12px; color: #666; }
          .btn { 
            display: inline-block; 
            padding: 10px 20px; 
            background-color: #007bff; 
            color: white; 
            text-decoration: none; 
            border-radius: 5px; 
            margin: 10px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Evidence Management System</h1>
            <h2>${subject}</h2>
          </div>
          
          <div class="content">
            <p>${message.replace(/\n/g, '<br>')}</p>
            
            ${metadata?.actionUrl ? `
              <a href="${metadata.actionUrl}" class="btn">Take Action</a>
            ` : ''}
          </div>
          
          <div class="footer">
            <p>This is an automated notification from the Evidence Management System.</p>
            <p>Please do not reply to this email.</p>
            ${metadata?.timestamp ? `<p>Generated at: ${new Date(metadata.timestamp).toLocaleString()}</p>` : ''}
          </div>
        </div>
      </body>
      </html>
    `;
  }
}