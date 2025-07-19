import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NotificationService } from '@/services/notification';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const createNotificationSchema = z.object({
  userId: z.string(),
  type: z.enum([
    'UPLOAD_DEADLINE_REMINDER',
    'EVALUATION_DEADLINE_REMINDER',
    'UPLOAD_WINDOW_OPENING',
    'UPLOAD_WINDOW_CLOSING',
    'EVALUATION_WINDOW_OPENING',
    'EVALUATION_WINDOW_CLOSING',
    'EVALUATION_OVERDUE',
    'ASSIGNMENT_NOTIFICATION',
    'SYSTEM_ALERT',
  ]),
  title: z.string().min(1),
  message: z.string().min(1),
  scheduledFor: z.string().datetime().optional(),
  metadata: z.record(z.any()).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const unreadOnly = url.searchParams.get('unreadOnly') === 'true';

    const result = await NotificationService.getUserNotifications(
      session.user.id,
      limit,
      offset,
      unreadOnly
    );

    return NextResponse.json(result);
  } catch (error) {
    logger.error('Failed to get user notifications:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Only admins can create notifications
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized access' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = createNotificationSchema.parse(body);

    const notification = await NotificationService.createNotification({
      userId: validatedData.userId,
      type: validatedData.type as any,
      title: validatedData.title,
      message: validatedData.message,
      scheduledFor: validatedData.scheduledFor ? new Date(validatedData.scheduledFor) : undefined,
      metadata: validatedData.metadata,
    });

    // If scheduled for future, schedule it
    if (notification.scheduledFor && notification.scheduledFor > new Date()) {
      const { SchedulerService } = await import('@/services/scheduler');
      await SchedulerService.scheduleOneTimeNotification(
        notification.id,
        notification.scheduledFor
      );
    } else {
      // Process immediately
      await NotificationService.processNotification(notification.id);
    }

    return NextResponse.json(notification, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input data', details: error.errors },
        { status: 400 }
      );
    }

    logger.error('Failed to create notification:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}