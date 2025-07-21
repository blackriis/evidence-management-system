import { db } from '@/lib/db';
import { NotificationService } from './notification';
import { NotificationType } from '@prisma/client';
import { UserRole } from '@/lib/user-role';
import { logger } from '@/lib/logger';
import { addDays, differenceInDays, isBefore, isAfter } from 'date-fns';

export class DeadlineMonitorService {
  // Check for upcoming upload deadlines and send reminders
  static async checkUploadDeadlines() {
    try {
      logger.info('Starting upload deadline check...');

      // Get active academic years with open upload windows
      const academicYears = await db.academicYear.findMany({
        where: {
          isActive: true,
          uploadWindowOpen: true,
        },
      });

      for (const academicYear of academicYears) {
        await this.processUploadDeadlineReminders(academicYear);
      }

      logger.info('Upload deadline check completed');
    } catch (error) {
      logger.error('Failed to check upload deadlines:', error);
      throw error;
    }
  }

  // Check for upcoming evaluation deadlines
  static async checkEvaluationDeadlines() {
    try {
      logger.info('Starting evaluation deadline check...');

      // Get active academic years with open evaluation windows
      const academicYears = await db.academicYear.findMany({
        where: {
          isActive: true,
          evaluationWindowOpen: true,
        },
      });

      for (const academicYear of academicYears) {
        await this.processEvaluationDeadlineReminders(academicYear);
      }

      // Check for overdue evaluations
      await this.checkOverdueEvaluations();

      logger.info('Evaluation deadline check completed');
    } catch (error) {
      logger.error('Failed to check evaluation deadlines:', error);
      throw error;
    }
  }

  // Check for window status changes (opening/closing)
  static async checkWindowStatusChanges() {
    try {
      logger.info('Checking for window status changes...');

      const academicYears = await db.academicYear.findMany({
        where: { isActive: true },
      });

      for (const academicYear of academicYears) {
        await this.checkUploadWindowChanges(academicYear);
        await this.checkEvaluationWindowChanges(academicYear);
      }

      logger.info('Window status check completed');
    } catch (error) {
      logger.error('Failed to check window status changes:', error);
      throw error;
    }
  }

  // Process upload deadline reminders for a specific academic year
  private static async processUploadDeadlineReminders(academicYear: any) {
    const now = new Date();
    const daysUntilDeadline = differenceInDays(academicYear.endDate, now);

    // Get users who should receive reminders
    const users = await db.user.findMany({
      where: {
        isActive: true,
        role: UserRole.TEACHER,
        deadlineReminderDays: { gte: daysUntilDeadline },
      },
    });

    for (const user of users) {
      // Check if user has already been notified for this deadline
      const existingNotification = await db.notification.findFirst({
        where: {
          userId: user.id,
          type: NotificationType.UPLOAD_DEADLINE_REMINDER,
          metadata: {
            path: ['academicYearId'],
            equals: academicYear.id,
          },
          createdAt: {
            gte: addDays(now, -1), // Only check notifications from the last day
          },
        },
      });

      if (!existingNotification && daysUntilDeadline <= user.deadlineReminderDays) {
        await NotificationService.createNotification({
          userId: user.id,
          type: NotificationType.UPLOAD_DEADLINE_REMINDER,
          title: `Upload Deadline Reminder - ${academicYear.name}`,
          message: `The upload window for ${academicYear.name} will close in ${daysUntilDeadline} day(s) on ${academicYear.endDate.toLocaleDateString()}. Please ensure all your evidence has been uploaded.`,
          metadata: {
            academicYearId: academicYear.id,
            daysUntilDeadline,
            deadlineDate: academicYear.endDate.toISOString(),
            actionUrl: `${process.env.NEXTAUTH_URL}/upload`,
          },
        });

        logger.info(`Upload deadline reminder created for user ${user.id} - ${daysUntilDeadline} days until deadline`);
      }
    }
  }

  // Process evaluation deadline reminders
  private static async processEvaluationDeadlineReminders(academicYear: any) {
    const now = new Date();
    const daysUntilDeadline = differenceInDays(academicYear.endDate, now);

    // Get evaluators who should receive reminders
    const evaluators = await db.user.findMany({
      where: {
        isActive: true,
        role: { in: [UserRole.IQA_EVALUATOR, UserRole.EQA_EVALUATOR] },
        deadlineReminderDays: { gte: daysUntilDeadline },
      },
    });

    for (const evaluator of evaluators) {
      // Count pending evaluations for this evaluator
      const pendingCount = await this.getPendingEvaluationCount(evaluator.id, academicYear.id);

      if (pendingCount > 0) {
        const existingNotification = await db.notification.findFirst({
          where: {
            userId: evaluator.id,
            type: NotificationType.EVALUATION_DEADLINE_REMINDER,
            metadata: {
              path: ['academicYearId'],
              equals: academicYear.id,
            },
            createdAt: {
              gte: addDays(now, -1),
            },
          },
        });

        if (!existingNotification && daysUntilDeadline <= evaluator.deadlineReminderDays) {
          await NotificationService.createNotification({
            userId: evaluator.id,
            type: NotificationType.EVALUATION_DEADLINE_REMINDER,
            title: `Evaluation Deadline Reminder - ${academicYear.name}`,
            message: `You have ${pendingCount} pending evaluation(s) for ${academicYear.name}. The evaluation window will close in ${daysUntilDeadline} day(s) on ${academicYear.endDate.toLocaleDateString()}.`,
            metadata: {
              academicYearId: academicYear.id,
              pendingCount,
              daysUntilDeadline,
              deadlineDate: academicYear.endDate.toISOString(),
              actionUrl: `${process.env.NEXTAUTH_URL}/evaluate`,
            },
          });

          logger.info(`Evaluation deadline reminder created for user ${evaluator.id} - ${pendingCount} pending evaluations`);
        }
      }
    }
  }

  // Check for overdue evaluations with escalation
  private static async checkOverdueEvaluations() {
    const now = new Date();

    // Get closed academic years that might have overdue evaluations
    const closedAcademicYears = await db.academicYear.findMany({
      where: {
        isActive: true,
        evaluationWindowOpen: false,
        endDate: { lt: now },
      },
    });

    for (const academicYear of closedAcademicYears) {
      await this.processOverdueEvaluationsForYear(academicYear);
    }
  }

  // Process overdue evaluations for a specific academic year with escalation
  private static async processOverdueEvaluationsForYear(academicYear: any) {
    const now = new Date();
    const daysSinceClosure = differenceInDays(now, academicYear.endDate);

    // Find evidence without evaluations
    const unevaluatedEvidence = await db.evidence.findMany({
      where: {
        academicYearId: academicYear.id,
        deletedAt: null,
        evaluations: { none: {} },
      },
      include: {
        uploader: true,
        subIndicator: {
          include: {
            owner: true,
            indicator: {
              include: {
                standard: {
                  include: {
                    educationLevel: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (unevaluatedEvidence.length === 0) return;

    // Group by sub-indicator owner (IQA evaluator)
    const groupedByEvaluator = unevaluatedEvidence.reduce((acc, evidence) => {
      const evaluatorId = evidence.subIndicator.ownerId;
      if (evaluatorId) {
        if (!acc[evaluatorId]) {
          acc[evaluatorId] = [];
        }
        acc[evaluatorId].push(evidence);
      }
      return acc;
    }, {} as Record<string, any[]>);

    // Apply escalation rules based on how long evaluations are overdue
    for (const [evaluatorId, evidenceList] of Object.entries(groupedByEvaluator)) {
      await this.applyEscalationRules(evaluatorId, evidenceList, academicYear, daysSinceClosure);
    }
  }

  // Apply escalation rules based on overdue duration
  private static async applyEscalationRules(
    evaluatorId: string,
    evidenceList: any[],
    academicYear: any,
    daysSinceClosure: number
  ) {
    const escalationLevels = [
      { days: 1, level: 1, description: 'Initial reminder' },
      { days: 3, level: 2, description: 'Second reminder' },
      { days: 7, level: 3, description: 'Escalation to supervisor' },
      { days: 14, level: 4, description: 'Final warning' },
      { days: 30, level: 5, description: 'Administrative action' },
    ];

    // Find the appropriate escalation level
    const currentLevel = escalationLevels
      .filter(level => daysSinceClosure >= level.days)
      .pop();

    if (!currentLevel) return;

    // Check if notification for this level has already been sent
    const existingNotification = await db.notification.findFirst({
      where: {
        userId: evaluatorId,
        type: NotificationType.EVALUATION_OVERDUE,
        createdAt: {
          gte: addDays(new Date(), -1), // Check last 24 hours
        },
      },
    });

    // If there's an existing notification, check if it's for the same level
    if (existingNotification && existingNotification.metadata) {
      const metadata = existingNotification.metadata as any;
      if (metadata.academicYearId === academicYear.id && metadata.escalationLevel === currentLevel.level) {
        return; // Already sent notification for this level
      }
    }

    // Get evaluator information
    const evaluator = await db.user.findUnique({
      where: { id: evaluatorId },
    });

    if (!evaluator) return;

    // Create escalated notification
    await this.createEscalatedNotification(
      evaluator,
      evidenceList,
      academicYear,
      currentLevel,
      daysSinceClosure
    );

    // Handle special escalation actions
    await this.handleEscalationActions(
      evaluator,
      evidenceList,
      academicYear,
      currentLevel,
      daysSinceClosure
    );
  }

  // Create escalated notification
  private static async createEscalatedNotification(
    evaluator: any,
    evidenceList: any[],
    academicYear: any,
    escalationLevel: any,
    daysSinceClosure: number
  ) {
    const urgencyPrefix = escalationLevel.level >= 3 ? '[URGENT] ' : '';
    const title = `${urgencyPrefix}Overdue Evaluations - Level ${escalationLevel.level}`;
    
    let message = `You have ${evidenceList.length} overdue evaluation(s) for ${academicYear.name}. `;
    message += `These evaluations are ${daysSinceClosure} day(s) overdue (${escalationLevel.description}).`;

    // Add specific consequences based on escalation level
    switch (escalationLevel.level) {
      case 1:
        message += ' Please complete these evaluations at your earliest convenience.';
        break;
      case 2:
        message += ' Immediate action is required to complete these evaluations.';
        break;
      case 3:
        message += ' This matter has been escalated to your supervisor for review.';
        break;
      case 4:
        message += ' This is your final warning. Administrative action may be taken if not resolved immediately.';
        break;
      case 5:
        message += ' Administrative action is being initiated due to continued non-compliance.';
        break;
    }

    await NotificationService.createNotification({
      userId: evaluator.id,
      type: NotificationType.EVALUATION_OVERDUE,
      title,
      message,
      metadata: {
        academicYearId: academicYear.id,
        overdueCount: evidenceList.length,
        escalationLevel: escalationLevel.level,
        daysSinceClosure,
        escalationDescription: escalationLevel.description,
        actionUrl: `${process.env.NEXTAUTH_URL}/evaluate`,
      },
    });

    logger.info(
      `Escalation level ${escalationLevel.level} notification created for user ${evaluator.id} - ${evidenceList.length} overdue evaluations`
    );
  }

  // Handle special escalation actions
  private static async handleEscalationActions(
    evaluator: any,
    evidenceList: any[],
    academicYear: any,
    escalationLevel: any,
    daysSinceClosure: number
  ) {
    // Level 3: Notify supervisor/admin
    if (escalationLevel.level === 3) {
      await this.notifySupervisors(evaluator, evidenceList, academicYear, daysSinceClosure);
    }

    // Level 4: Final warning with detailed report
    if (escalationLevel.level === 4) {
      await this.sendDetailedOverdueReport(evaluator, evidenceList, academicYear, daysSinceClosure);
    }

    // Level 5: Create administrative alert
    if (escalationLevel.level === 5) {
      await this.createAdministrativeAlert(evaluator, evidenceList, academicYear, daysSinceClosure);
    }
  }

  // Notify supervisors about overdue evaluations
  private static async notifySupervisors(
    evaluator: any,
    evidenceList: any[],
    academicYear: any,
    daysSinceClosure: number
  ) {
    // Get all admin users
    const supervisors = await db.user.findMany({
      where: {
        isActive: true,
        role: { in: [UserRole.ADMIN, UserRole.EXECUTIVE] },
      },
    });

    for (const supervisor of supervisors) {
      await NotificationService.createNotification({
        userId: supervisor.id,
        type: NotificationType.SYSTEM_ALERT,
        title: `Escalation Alert: Overdue Evaluations`,
        message: `${evaluator.name} (${evaluator.email}) has ${evidenceList.length} overdue evaluation(s) for ${academicYear.name}. These evaluations are ${daysSinceClosure} day(s) overdue and require supervisor intervention.`,
        metadata: {
          escalationType: 'supervisor_notification',
          evaluatorId: evaluator.id,
          evaluatorName: evaluator.name,
          evaluatorEmail: evaluator.email,
          academicYearId: academicYear.id,
          overdueCount: evidenceList.length,
          daysSinceClosure,
          actionUrl: `${process.env.NEXTAUTH_URL}/admin/users`,
        },
      });
    }

    logger.info(`Supervisor escalation notifications sent for evaluator ${evaluator.id}`);
  }

  // Send detailed overdue report
  private static async sendDetailedOverdueReport(
    evaluator: any,
    evidenceList: any[],
    academicYear: any,
    daysSinceClosure: number
  ) {
    // Create detailed breakdown of overdue items
    const breakdown = evidenceList.map(evidence => ({
      evidenceId: evidence.id,
      fileName: evidence.originalName,
      uploader: evidence.uploader.name,
      subIndicator: evidence.subIndicator.name,
      indicator: evidence.subIndicator.indicator.name,
      standard: evidence.subIndicator.indicator.standard.name,
      educationLevel: evidence.subIndicator.indicator.standard.educationLevel.name,
      uploadedAt: evidence.uploadedAt,
    }));

    await NotificationService.createNotification({
      userId: evaluator.id,
      type: NotificationType.EVALUATION_OVERDUE,
      title: `[FINAL WARNING] Detailed Overdue Report - ${academicYear.name}`,
      message: `This is your final warning regarding ${evidenceList.length} overdue evaluation(s). Please review the detailed breakdown and complete all evaluations immediately to avoid administrative action.`,
      metadata: {
        escalationType: 'detailed_report',
        academicYearId: academicYear.id,
        overdueCount: evidenceList.length,
        daysSinceClosure,
        detailedBreakdown: breakdown,
        actionUrl: `${process.env.NEXTAUTH_URL}/evaluate`,
      },
    });

    logger.info(`Detailed overdue report sent to evaluator ${evaluator.id}`);
  }

  // Create administrative alert for level 5 escalation
  private static async createAdministrativeAlert(
    evaluator: any,
    evidenceList: any[],
    academicYear: any,
    daysSinceClosure: number
  ) {
    // Get all admin users for administrative alerts
    const admins = await db.user.findMany({
      where: {
        isActive: true,
        role: UserRole.ADMIN,
      },
    });

    for (const admin of admins) {
      await NotificationService.createNotification({
        userId: admin.id,
        type: NotificationType.SYSTEM_ALERT,
        title: `[ADMINISTRATIVE ACTION REQUIRED] Chronic Evaluation Delays`,
        message: `URGENT: ${evaluator.name} (${evaluator.email}) has persistently failed to complete ${evidenceList.length} evaluation(s) for ${academicYear.name}. These evaluations are ${daysSinceClosure} day(s) overdue. Immediate administrative intervention is required.`,
        metadata: {
          escalationType: 'administrative_action',
          evaluatorId: evaluator.id,
          evaluatorName: evaluator.name,
          evaluatorEmail: evaluator.email,
          academicYearId: academicYear.id,
          overdueCount: evidenceList.length,
          daysSinceClosure,
          severity: 'critical',
          actionUrl: `${process.env.NEXTAUTH_URL}/admin/users`,
        },
      });
    }

    // Also notify the evaluator about administrative action
    await NotificationService.createNotification({
      userId: evaluator.id,
      type: NotificationType.SYSTEM_ALERT,
      title: `[ADMINISTRATIVE ACTION] Evaluation Compliance Issue`,
      message: `Due to persistent failure to complete evaluations, administrative action has been initiated regarding your ${evidenceList.length} overdue evaluation(s) for ${academicYear.name}. Please contact the administrator immediately.`,
      metadata: {
        escalationType: 'administrative_notice',
        academicYearId: academicYear.id,
        overdueCount: evidenceList.length,
        daysSinceClosure,
        severity: 'critical',
      },
    });

    logger.warn(`Administrative action alert created for evaluator ${evaluator.id} - chronic evaluation delays`);
  }

  // Legacy method - keeping for compatibility
  private static async checkOverdueEvaluationsLegacy() {
    const now = new Date();

    // Get closed academic years that might have overdue evaluations
    const closedAcademicYears = await db.academicYear.findMany({
      where: {
        isActive: true,
        evaluationWindowOpen: false,
        endDate: { lt: now },
      },
    });

    for (const academicYear of closedAcademicYears) {
      // Find evidence without evaluations
      const unevaluatedEvidence = await db.evidence.findMany({
        where: {
          academicYearId: academicYear.id,
          deletedAt: null,
          evaluations: { none: {} },
        },
        include: {
          uploader: true,
          subIndicator: {
            include: {
              owner: true,
            },
          },
        },
      });

      // Group by sub-indicator owner (IQA evaluator)
      const groupedByEvaluator = unevaluatedEvidence.reduce((acc, evidence) => {
        const evaluatorId = evidence.subIndicator.ownerId;
        if (evaluatorId) {
          if (!acc[evaluatorId]) {
            acc[evaluatorId] = [];
          }
          acc[evaluatorId].push(evidence);
        }
        return acc;
      }, {} as Record<string, any[]>);

      // Send overdue notifications
      for (const [evaluatorId, evidenceList] of Object.entries(groupedByEvaluator)) {
        const existingNotification = await db.notification.findFirst({
          where: {
            userId: evaluatorId,
            type: NotificationType.EVALUATION_OVERDUE,
            metadata: {
              path: ['academicYearId'],
              equals: academicYear.id,
            },
            createdAt: {
              gte: addDays(now, -7), // Don't spam - only once per week
            },
          },
        });

        if (!existingNotification) {
          await NotificationService.createNotification({
            userId: evaluatorId,
            type: NotificationType.EVALUATION_OVERDUE,
            title: `Overdue Evaluations - ${academicYear.name}`,
            message: `You have ${evidenceList.length} overdue evaluation(s) for ${academicYear.name}. The evaluation window has closed, but these evaluations are still pending.`,
            metadata: {
              academicYearId: academicYear.id,
              overdueCount: evidenceList.length,
              actionUrl: `${process.env.NEXTAUTH_URL}/evaluate`,
            },
          });

          logger.info(`Overdue evaluation notification created for user ${evaluatorId} - ${evidenceList.length} overdue evaluations`);
        }
      }
    }
  }

  // Check for upload window changes
  private static async checkUploadWindowChanges(academicYear: any) {
    const now = new Date();
    const startDate = new Date(academicYear.startDate);
    const endDate = new Date(academicYear.endDate);

    // Check if upload window should open
    if (!academicYear.uploadWindowOpen && isAfter(now, startDate) && isBefore(now, endDate)) {
      await this.notifyWindowOpening(academicYear, 'upload');
    }

    // Check if upload window should close
    if (academicYear.uploadWindowOpen && isAfter(now, endDate)) {
      await this.notifyWindowClosing(academicYear, 'upload');
    }
  }

  // Check for evaluation window changes
  private static async checkEvaluationWindowChanges(academicYear: any) {
    const now = new Date();
    const startDate = new Date(academicYear.startDate);
    const endDate = new Date(academicYear.endDate);

    // Check if evaluation window should open
    if (!academicYear.evaluationWindowOpen && isAfter(now, startDate) && isBefore(now, endDate)) {
      await this.notifyWindowOpening(academicYear, 'evaluation');
    }

    // Check if evaluation window should close
    if (academicYear.evaluationWindowOpen && isAfter(now, endDate)) {
      await this.notifyWindowClosing(academicYear, 'evaluation');
    }
  }

  // Notify about window opening
  private static async notifyWindowOpening(academicYear: any, windowType: 'upload' | 'evaluation') {
    const isUpload = windowType === 'upload';
    const userRoles = isUpload ? [UserRole.TEACHER] : [UserRole.IQA_EVALUATOR, UserRole.EQA_EVALUATOR];
    const notificationType = isUpload 
      ? NotificationType.UPLOAD_WINDOW_OPENING 
      : NotificationType.EVALUATION_WINDOW_OPENING;

    const users = await db.user.findMany({
      where: {
        isActive: true,
        role: { in: userRoles },
      },
    });

    for (const user of users) {
      await NotificationService.createNotification({
        userId: user.id,
        type: notificationType,
        title: `${isUpload ? 'Upload' : 'Evaluation'} Window Opened - ${academicYear.name}`,
        message: `The ${windowType} window for ${academicYear.name} is now open until ${academicYear.endDate.toLocaleDateString()}.`,
        metadata: {
          academicYearId: academicYear.id,
          windowType,
          actionUrl: `${process.env.NEXTAUTH_URL}/${isUpload ? 'upload' : 'evaluate'}`,
        },
      });
    }

    logger.info(`${windowType} window opening notifications sent for ${academicYear.name}`);
  }

  // Notify about window closing
  private static async notifyWindowClosing(academicYear: any, windowType: 'upload' | 'evaluation') {
    const isUpload = windowType === 'upload';
    const userRoles = isUpload ? [UserRole.TEACHER] : [UserRole.IQA_EVALUATOR, UserRole.EQA_EVALUATOR];
    const notificationType = isUpload 
      ? NotificationType.UPLOAD_WINDOW_CLOSING 
      : NotificationType.EVALUATION_WINDOW_CLOSING;

    const users = await db.user.findMany({
      where: {
        isActive: true,
        role: { in: userRoles },
      },
    });

    for (const user of users) {
      await NotificationService.createNotification({
        userId: user.id,
        type: notificationType,
        title: `${isUpload ? 'Upload' : 'Evaluation'} Window Closed - ${academicYear.name}`,
        message: `The ${windowType} window for ${academicYear.name} has been closed as of ${academicYear.endDate.toLocaleDateString()}.`,
        metadata: {
          academicYearId: academicYear.id,
          windowType,
        },
      });
    }

    logger.info(`${windowType} window closing notifications sent for ${academicYear.name}`);
  }

  // Get count of pending evaluations for an evaluator
  private static async getPendingEvaluationCount(evaluatorId: string, academicYearId: string): Promise<number> {
    const evaluatorUser = await db.user.findUnique({
      where: { id: evaluatorId },
    });

    if (!evaluatorUser) return 0;

    if (evaluatorUser.role === UserRole.IQA_EVALUATOR) {
      // IQA evaluators are responsible for their assigned sub-indicators
      return await db.evidence.count({
        where: {
          academicYearId,
          deletedAt: null,
          subIndicator: {
            ownerId: evaluatorId,
          },
          evaluations: { none: {} },
        },
      });
    } else if (evaluatorUser.role === UserRole.EQA_EVALUATOR) {
      // EQA evaluators can evaluate any evidence
      return await db.evidence.count({
        where: {
          academicYearId,
          deletedAt: null,
          evaluations: {
            none: {
              evaluatorId: evaluatorId,
            },
          },
        },
      });
    }

    return 0;
  }

  // Process all pending notifications
  static async processPendingNotifications() {
    try {
      logger.info('Processing pending notifications...');

      const pendingNotifications = await NotificationService.getPendingNotifications();
      
      for (const notification of pendingNotifications) {
        await NotificationService.processNotification(notification.id);
      }

      logger.info(`Processed ${pendingNotifications.length} pending notifications`);
    } catch (error) {
      logger.error('Failed to process pending notifications:', error);
      throw error;
    }
  }

  // Run all deadline checks
  static async runAllChecks() {
    try {
      logger.info('Starting all deadline monitoring checks...');

      await Promise.all([
        this.checkUploadDeadlines(),
        this.checkEvaluationDeadlines(),
        this.checkWindowStatusChanges(),
        this.processPendingNotifications(),
      ]);

      logger.info('All deadline monitoring checks completed successfully');
    } catch (error) {
      logger.error('Failed to run deadline monitoring checks:', error);
      throw error;
    }
  }
}