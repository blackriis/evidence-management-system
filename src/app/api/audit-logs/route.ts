import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { AuditAction } from '@prisma/client';
import { AuditLogger } from '@/lib/audit-logger';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins and executives can view audit logs
    if (!['ADMIN', 'EXECUTIVE'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const userId = searchParams.get('userId');
    const action = searchParams.get('action') as AuditAction;
    const resource = searchParams.get('resource');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const skip = (page - 1) * limit;

    // Build filter conditions
    const where: any = {};
    
    if (userId) {
      where.userId = userId;
    }
    
    if (action) {
      where.action = action;
    }
    
    if (resource) {
      where.resource = resource;
    }
    
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) {
        where.timestamp.gte = new Date(startDate);
      }
      if (endDate) {
        where.timestamp.lte = new Date(endDate);
      }
    }

    // Get audit logs with pagination
    const [auditLogs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: {
          timestamp: 'desc',
        },
        skip,
        take: limit,
      }),
      db.auditLog.count({ where }),
    ]);

    // Log the audit log access
    const context = AuditLogger.extractContext(request, session.user.id);
    await AuditLogger.log({
      userId: session.user.id,
      action: AuditAction.EXPORT, // Viewing audit logs is considered an export action
      resource: 'audit_logs',
      metadata: {
        filters: { userId, action, resource, startDate, endDate },
        resultCount: auditLogs.length,
      },
    }, context);

    return NextResponse.json({
      auditLogs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins can delete audit logs
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const retentionDays = parseInt(searchParams.get('retentionDays') || '2555'); // ~7 years default
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    // Delete old audit logs
    const result = await db.auditLog.deleteMany({
      where: {
        timestamp: {
          lt: cutoffDate,
        },
      },
    });

    // Log the cleanup action
    const context = AuditLogger.extractContext(request, session.user.id);
    await AuditLogger.log({
      userId: session.user.id,
      action: AuditAction.DELETE,
      resource: 'audit_logs',
      metadata: {
        retentionDays,
        cutoffDate: cutoffDate.toISOString(),
        deletedCount: result.count,
      },
    }, context);

    return NextResponse.json({
      message: `Deleted ${result.count} audit log entries older than ${retentionDays} days`,
      deletedCount: result.count,
    });
  } catch (error) {
    console.error('Error cleaning up audit logs:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}