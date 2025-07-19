import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const updatePreferencesSchema = z.object({
  emailNotifications: z.boolean().optional(),
  lineNotifications: z.boolean().optional(),
  deadlineReminderDays: z.number().min(1).max(30).optional(),
});

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        emailNotifications: true,
        lineNotifications: true,
        deadlineReminderDays: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(user);
  } catch (error) {
    logger.error('Failed to get user preferences:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = updatePreferencesSchema.parse(body);

    const updatedUser = await db.user.update({
      where: { id: session.user.id },
      data: validatedData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        emailNotifications: true,
        lineNotifications: true,
        deadlineReminderDays: true,
      },
    });

    logger.info(`User preferences updated for user ${session.user.id}`);
    return NextResponse.json(updatedUser);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input data', details: error.errors },
        { status: 400 }
      );
    }

    logger.error('Failed to update user preferences:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}