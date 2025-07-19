import { SchedulerService } from '@/services/scheduler';
import { logger } from '@/lib/logger';

let schedulerInitialized = false;

export function initializeSchedulerIfNeeded() {
  // Only initialize in production or when explicitly enabled
  const shouldInitialize = process.env.NODE_ENV === 'production' || 
                          process.env.ENABLE_SCHEDULER === 'true';

  if (!shouldInitialize) {
    logger.info('Scheduler initialization skipped (not in production and ENABLE_SCHEDULER not set)');
    return;
  }

  if (schedulerInitialized) {
    logger.debug('Scheduler already initialized, skipping');
    return;
  }

  try {
    SchedulerService.initializeScheduler();
    schedulerInitialized = true;
    logger.info('Notification scheduler initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize notification scheduler:', error);
  }
}

export function shutdownScheduler() {
  if (schedulerInitialized) {
    try {
      SchedulerService.stopAllJobs();
      schedulerInitialized = false;
      logger.info('Notification scheduler shut down successfully');
    } catch (error) {
      logger.error('Failed to shut down notification scheduler:', error);
    }
  }
}