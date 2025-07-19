import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NotificationService } from '@/services/notification';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: { id: string };
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { action } = await request.json();

    if (action === 'markAsRead') {
      await NotificationService.markAsRead(params.id, session.user.id);
      return NextResponse.json({ message: 'Notification marked as read' });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    logger.error(`Failed to update notification ${params.id}:`, error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}