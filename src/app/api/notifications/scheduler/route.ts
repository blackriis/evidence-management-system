import { NextRequest, NextResponse } from 'next/server';
import { SchedulerService } from '@/services/scheduler';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized access' },
        { status: 403 }
      );
    }

    const status = SchedulerService.getJobStatus();
    return NextResponse.json(status);
  } catch (error) {
    logger.error('Failed to get scheduler status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized access' },
        { status: 403 }
      );
    }

    const { action } = await request.json();

    switch (action) {
      case 'initialize':
        SchedulerService.initializeScheduler();
        logger.info('Scheduler initialized via API');
        return NextResponse.json({ message: 'Scheduler initialized successfully' });

      case 'stop':
        SchedulerService.stopAllJobs();
        logger.info('All scheduler jobs stopped via API');
        return NextResponse.json({ message: 'All jobs stopped successfully' });

      case 'trigger-deadline-checks':
        await SchedulerService.triggerDeadlineChecks();
        return NextResponse.json({ message: 'Deadline checks triggered successfully' });

      case 'trigger-notifications':
        await SchedulerService.triggerNotificationProcessing();
        return NextResponse.json({ message: 'Notification processing triggered successfully' });

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    logger.error('Failed to perform scheduler action:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}