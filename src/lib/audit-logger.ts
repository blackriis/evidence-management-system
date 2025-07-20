import { AuditAction } from '@prisma/client';
import { db } from './db';
import { NextRequest } from 'next/server';

export interface AuditLogData {
  userId?: string;
  action: AuditAction;
  resource: string;
  resourceId?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface AuditContext {
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
}

export class AuditLogger {
  /**
   * Log an audit event
   */
  static async log(data: AuditLogData, context?: AuditContext): Promise<void> {
    try {
      const metadata = {
        ...data.metadata,
        ...(context && {
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          sessionId: context.sessionId,
        }),
      };

      await db.auditLog.create({
        data: {
          userId: data.userId,
          action: data.action,
          resource: data.resource,
          resourceId: data.resourceId,
          oldValues: data.oldValues ? JSON.parse(JSON.stringify(data.oldValues)) : null,
          newValues: data.newValues ? JSON.parse(JSON.stringify(data.newValues)) : null,
          metadata: Object.keys(metadata).length > 0 ? metadata : null,
        },
      });
    } catch (error) {
      // Log audit failures to console but don't throw to avoid breaking main operations
      console.error('Failed to create audit log:', error);
    }
  }

  /**
   * Extract audit context from Next.js request
   */
  static extractContext(request: NextRequest, userId?: string): AuditContext {
    return {
      userId,
      ipAddress: this.getClientIP(request),
      userAgent: request.headers.get('user-agent') || undefined,
      sessionId: request.cookies.get('next-auth.session-token')?.value,
    };
  }

  /**
   * Get client IP address from request
   */
  private static getClientIP(request: NextRequest): string {
    const forwarded = request.headers.get('x-forwarded-for');
    const realIP = request.headers.get('x-real-ip');
    
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }
    
    if (realIP) {
      return realIP;
    }
    
    return request.ip || 'unknown';
  }

  /**
   * Log user authentication events
   */
  static async logAuth(action: 'LOGIN' | 'LOGOUT', userId: string, context?: AuditContext): Promise<void> {
    await this.log({
      userId,
      action: action as AuditAction,
      resource: 'auth',
      metadata: {
        timestamp: new Date().toISOString(),
      },
    }, context);
  }

  /**
   * Log evidence-related actions
   */
  static async logEvidence(
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'UPLOAD' | 'DOWNLOAD' | 'RESTORE',
    evidenceId: string,
    userId: string,
    oldValues?: any,
    newValues?: any,
    context?: AuditContext
  ): Promise<void> {
    await this.log({
      userId,
      action: action as AuditAction,
      resource: 'evidence',
      resourceId: evidenceId,
      oldValues,
      newValues,
    }, context);
  }

  /**
   * Log evaluation actions
   */
  static async logEvaluation(
    action: 'CREATE' | 'UPDATE' | 'DELETE',
    evaluationId: string,
    userId: string,
    oldValues?: any,
    newValues?: any,
    context?: AuditContext
  ): Promise<void> {
    await this.log({
      userId,
      action: action as AuditAction,
      resource: 'evaluation',
      resourceId: evaluationId,
      oldValues,
      newValues,
    }, context);
  }

  /**
   * Log user management actions
   */
  static async logUser(
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'IMPORT',
    targetUserId: string,
    adminUserId: string,
    oldValues?: any,
    newValues?: any,
    context?: AuditContext
  ): Promise<void> {
    await this.log({
      userId: adminUserId,
      action: action as AuditAction,
      resource: 'user',
      resourceId: targetUserId,
      oldValues,
      newValues,
    }, context);
  }

  /**
   * Log system configuration changes
   */
  static async logSystemConfig(
    resource: string,
    resourceId: string,
    userId: string,
    oldValues?: any,
    newValues?: any,
    context?: AuditContext
  ): Promise<void> {
    await this.log({
      userId,
      action: AuditAction.SYSTEM_CONFIG,
      resource,
      resourceId,
      oldValues,
      newValues,
    }, context);
  }

  /**
   * Log export/import actions
   */
  static async logDataTransfer(
    action: 'EXPORT' | 'IMPORT',
    resource: string,
    userId: string,
    metadata?: Record<string, any>,
    context?: AuditContext
  ): Promise<void> {
    await this.log({
      userId,
      action: action as AuditAction,
      resource,
      metadata,
    }, context);
  }

  /**
   * Log security-related events
   */
  static async logSecurity(
    action: 'SECURITY_VIOLATION' | 'RATE_LIMIT_EXCEEDED' | 'CSRF_VIOLATION' | 'MALWARE_DETECTED' | 'UNAUTHORIZED_ACCESS',
    userId: string | undefined,
    details: Record<string, any>,
    context?: AuditContext
  ): Promise<void> {
    await this.log({
      userId,
      action: action as AuditAction,
      resource: 'security',
      resourceId: 'system',
      newValues: details,
      metadata: {
        severity: this.getSecuritySeverity(action),
        timestamp: new Date().toISOString(),
      },
    }, context);

    // For critical security events, also log to console for immediate attention
    const criticalEvents = [
      'MALWARE_DETECTED',
      'SECURITY_VIOLATION',
      'UNAUTHORIZED_ACCESS'
    ];

    if (criticalEvents.includes(action)) {
      console.warn(`[SECURITY ALERT] ${action}:`, {
        userId,
        details,
        context,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get security event severity level
   */
  private static getSecuritySeverity(action: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    switch (action) {
      case 'MALWARE_DETECTED':
      case 'SECURITY_VIOLATION':
        return 'CRITICAL';
      case 'UNAUTHORIZED_ACCESS':
        return 'HIGH';
      case 'CSRF_VIOLATION':
        return 'MEDIUM';
      case 'RATE_LIMIT_EXCEEDED':
        return 'LOW';
      default:
        return 'MEDIUM';
    }
  }
}

/**
 * Audit logging middleware for API routes
 */
export function withAuditLogging<T extends any[]>(
  handler: (...args: T) => Promise<Response>,
  resource: string,
  action: AuditAction
) {
  return async (...args: T): Promise<Response> => {
    const request = args[0] as NextRequest;
    const response = await handler(...args);
    
    // Extract user ID from session or JWT token
    // This would need to be implemented based on your auth setup
    const userId = await getUserIdFromRequest(request);
    const context = AuditLogger.extractContext(request, userId);
    
    // Log the action
    await AuditLogger.log({
      userId,
      action,
      resource,
      metadata: {
        method: request.method,
        url: request.url,
        statusCode: response.status,
      },
    }, context);
    
    return response;
  };
}

/**
 * Helper function to extract user ID from request
 * This should be implemented based on your authentication setup
 */
async function getUserIdFromRequest(request: NextRequest): Promise<string | undefined> {
  // Implementation depends on your auth setup
  // This is a placeholder that should be replaced with actual logic
  try {
    const token = request.cookies.get('next-auth.session-token')?.value;
    if (!token) return undefined;
    
    // Decode JWT or validate session token to get user ID
    // This is a simplified example
    return undefined; // Replace with actual implementation
  } catch {
    return undefined;
  }
}