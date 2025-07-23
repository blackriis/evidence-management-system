import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    // Get basic user statistics
    const totalUsers = await db.user.count();
    const activeUsers = await db.user.count({
      where: {
        isActive: true,
        deletedAt: null,
      },
    });

    const usersByRole = await db.user.groupBy({
      by: ['role'],
      where: {
        isActive: true,
        deletedAt: null,
      },
      _count: {
        role: true,
      },
    });

    // Get sample users (first 5)
    const sampleUsers = await db.user.findMany({
      where: {
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
      take: 5,
    });

    return NextResponse.json({
      success: true,
      stats: {
        totalUsers,
        activeUsers,
        usersByRole: usersByRole.reduce((acc, item) => {
          acc[item.role] = item._count.role;
          return acc;
        }, {} as Record<string, number>),
      },
      sampleUsers,
      environment: {
        nodeEnv: process.env.NODE_ENV,
        hasDatabase: !!process.env.DATABASE_URL,
        databaseUrlHost: process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).hostname : 'none',
        databaseUrlUser: process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).username : 'none',
        hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
        nextAuthUrl: process.env.NEXTAUTH_URL,
      },
    });
  } catch (error) {
    console.error('Database debug error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      environment: {
        nodeEnv: process.env.NODE_ENV,
        hasDatabase: !!process.env.DATABASE_URL,
        databaseUrlHost: process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).hostname : 'none',
        databaseUrlUser: process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).username : 'none',
        hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
        nextAuthUrl: process.env.NEXTAUTH_URL,
      },
    }, { status: 500 });
  }
}