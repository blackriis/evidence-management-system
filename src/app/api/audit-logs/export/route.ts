import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { AuditAction } from '@prisma/client';
import { AuditLogger } from '@/lib/audit-logger';
import * as XLSX from 'xlsx';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins and executives can export audit logs
    if (!['ADMIN', 'EXECUTIVE'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const action = searchParams.get('action') as AuditAction;
    const resource = searchParams.get('resource');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

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

    // Get all matching audit logs (no pagination for export)
    const auditLogs = await db.auditLog.findMany({
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
      take: 10000, // Limit to prevent memory issues
    });

    // Transform data for Excel export
    const excelData = auditLogs.map(log => ({
      'วันที่/เวลา': new Date(log.timestamp).toLocaleString('th-TH'),
      'ผู้ใช้': log.user ? log.user.name : 'ระบบ',
      'อีเมล': log.user ? log.user.email : '',
      'บทบาท': log.user ? log.user.role : '',
      'การกระทำ': log.action,
      'ทรัพยากร': log.resource,
      'รหัสทรัพยากร': log.resourceId || '',
      'ข้อมูลเพิ่มเติม': log.metadata ? JSON.stringify(log.metadata) : '',
      'ค่าเดิม': log.oldValues ? JSON.stringify(log.oldValues) : '',
      'ค่าใหม่': log.newValues ? JSON.stringify(log.newValues) : '',
    }));

    // Create Excel workbook
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(excelData);

    // Set column widths
    const columnWidths = [
      { wch: 20 }, // วันที่/เวลา
      { wch: 25 }, // ผู้ใช้
      { wch: 30 }, // อีเมล
      { wch: 15 }, // บทบาท
      { wch: 15 }, // การกระทำ
      { wch: 20 }, // ทรัพยากร
      { wch: 15 }, // รหัสทรัพยากร
      { wch: 30 }, // ข้อมูลเพิ่มเติม
      { wch: 30 }, // ค่าเดิม
      { wch: 30 }, // ค่าใหม่
    ];
    worksheet['!cols'] = columnWidths;

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Audit Logs');

    // Generate Excel buffer
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // Log the export action
    const context = AuditLogger.extractContext(request, session.user.id);
    await AuditLogger.log({
      userId: session.user.id,
      action: AuditAction.EXPORT,
      resource: 'audit_logs',
      metadata: {
        filters: { userId, action, resource, startDate, endDate },
        exportedCount: auditLogs.length,
        format: 'xlsx',
      },
    }, context);

    // Return Excel file
    return new NextResponse(excelBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('Error exporting audit logs:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}