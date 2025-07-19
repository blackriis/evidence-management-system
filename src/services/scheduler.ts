import * as cron from 'node-cron';
import { DeadlineMonitorService } from './deadline-monitor';
import { logger } from '@/lib/logger';

export class SchedulerService {
  private static jobs: Map<string, cron.ScheduledTask> = new Map();

  // Initialize all scheduled jobs
  static initializeScheduler() {
    try {
      logger.info('Initializing notification scheduler...');

      // Run deadline checks every hour
      this.scheduleJob('deadline-checks', '0 * * * *', async () => {
        logger.info('Running scheduled deadline checks...');
        await DeadlineMonitorService.runAllChecks();
      });

      // Run notification processing every 5 minutes
      this.scheduleJob('notification-processing', '*/5 * * * *', async () => {
        logger.info('Processing pending notifications...');
        await DeadlineMonitorService.processPendingNotifications();
      });

      // Daily cleanup job at 2 AM
      this.scheduleJob('daily-cleanup', '0 2 * * *', async () => {
        logger.info('Running daily cleanup...');
        await this.performDailyCleanup();
      });

      // Weekly reminder job on Mondays at 9 AM
      this.scheduleJob('weekly-reminders', '0 9 * * 1', async () => {
        logger.info('Running weekly reminder checks...');
        await DeadlineMonitorService.checkUploadDeadlines();
        await DeadlineMonitorService.checkEvaluationDeadlines();
      });

      logger.info('Notification scheduler initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize scheduler:', error);
      throw error;
    }
  }

  // Schedule a new job
  static scheduleJob(name: string, schedule: string, task: () => Promise<void>) {
    try {
      // Stop existing job if it exists
      if (this.jobs.has(name)) {
        this.jobs.get(name)?.stop();
        this.jobs.delete(name);
      }

      // Create and start new job
      const job = cron.schedule(schedule, async () => {
        try {
          await task();
        } catch (error) {
          logger.error(`Scheduled job '${name}' failed:`, error);
        }
      });

      this.jobs.set(name, job);
      logger.info(`Scheduled job '${name}' created with schedule: ${schedule}`);
    } catch (error) {
      logger.error(`Failed to schedule job '${name}':`, error);
      throw error;
    }
  }

  // Stop a specific job
  static stopJob(name: string) {
    const job = this.jobs.get(name);
    if (job) {
      job.stop();
      this.jobs.delete(name);
      logger.info(`Stopped scheduled job: ${name}`);
    }
  }

  // Stop all jobs
  static stopAllJobs() {
    for (const [name, job] of this.jobs.entries()) {
      job.stop();
      logger.info(`Stopped scheduled job: ${name}`);
    }
    this.jobs.clear();
    logger.info('All scheduled jobs stopped');
  }

  // Get job status
  static getJobStatus() {
    const status = Array.from(this.jobs.entries()).map(([name]) => ({
      name,
      isRunning: true, // Assume running if in the map
    }));
    
    return {
      totalJobs: this.jobs.size,
      jobs: status,
    };
  }

  // Manually trigger deadline checks
  static async triggerDeadlineChecks() {
    try {
      logger.info('Manually triggering deadline checks...');
      await DeadlineMonitorService.runAllChecks();
      logger.info('Manual deadline checks completed');
    } catch (error) {
      logger.error('Failed to trigger deadline checks:', error);
      throw error;
    }
  }

  // Manually trigger notification processing
  static async triggerNotificationProcessing() {
    try {
      logger.info('Manually triggering notification processing...');
      await DeadlineMonitorService.processPendingNotifications();
      logger.info('Manual notification processing completed');
    } catch (error) {
      logger.error('Failed to trigger notification processing:', error);
      throw error;
    }
  }

  // Perform daily cleanup tasks
  private static async performDailyCleanup() {
    try {
      const { db } = await import('@/lib/db');
      
      // Clean up old read notifications (older than 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const deletedCount = await db.notification.deleteMany({
        where: {
          isRead: true,
          createdAt: { lt: thirtyDaysAgo },
        },
      });

      logger.info(`Daily cleanup completed: Deleted ${deletedCount.count} old notifications`);
    } catch (error) {
      logger.error('Failed to perform daily cleanup:', error);
      throw error;
    }
  }

  // Schedule a one-time notification
  static async scheduleOneTimeNotification(
    notificationId: string,
    scheduledFor: Date
  ) {
    try {
      const now = new Date();
      
      if (scheduledFor <= now) {
        // If scheduled time has passed, process immediately
        const { NotificationService } = await import('./notification');
        await NotificationService.processNotification(notificationId);
        return;
      }

      // Calculate cron expression for the specific date/time
      const cronExpression = this.dateToCron(scheduledFor);
      const jobName = `one-time-${notificationId}`;

      this.scheduleJob(jobName, cronExpression, async () => {
        const { NotificationService } = await import('./notification');
        await NotificationService.processNotification(notificationId);
        
        // Remove the one-time job after execution
        this.stopJob(jobName);
      });

      logger.info(`Scheduled one-time notification ${notificationId} for ${scheduledFor.toISOString()}`);
    } catch (error) {
      logger.error(`Failed to schedule one-time notification ${notificationId}:`, error);
      throw error;
    }
  }

  // Convert Date to cron expression
  private static dateToCron(date: Date): string {
    const minute = date.getMinutes();
    const hour = date.getHours();
    const dayOfMonth = date.getDate();
    const month = date.getMonth() + 1; // Month is 0-indexed in Date
    // const year = date.getFullYear();

    // Create a cron expression for a specific date and time
    // Format: minute hour day month dayOfWeek
    return `${minute} ${hour} ${dayOfMonth} ${month} *`;
  }

  // Validate cron expression
  static validateCronExpression(expression: string): boolean {
    try {
      return cron.validate(expression);
    } catch {
      return false;
    }
  }

  // Get next execution time for a cron expression
  static getNextExecutionTime(expression: string): Date | null {
    try {
      if (!this.validateCronExpression(expression)) {
        return null;
      }

      // For now, return null since node-cron types don't support nextDate()
      return null;
    } catch {
      return null;
    }
  }
}