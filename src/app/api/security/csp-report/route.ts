import { NextRequest, NextResponse } from "next/server";
import { AuditLogger } from "@/lib/audit-logger";
import { withSecurityHeaders } from "@/lib/security-headers";

interface CSPReport {
  'csp-report': {
    'document-uri': string;
    'referrer': string;
    'violated-directive': string;
    'effective-directive': string;
    'original-policy': string;
    'disposition': string;
    'blocked-uri': string;
    'line-number': number;
    'column-number': number;
    'source-file': string;
    'status-code': number;
    'script-sample': string;
  };
}

async function cspReportHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const report: CSPReport = await request.json();
    const cspViolation = report['csp-report'];

    // Log CSP violation for security monitoring
    const context = AuditLogger.extractContext(request);
    
    await AuditLogger.logSecurity(
      'SECURITY_VIOLATION',
      undefined, // CSP violations might not have a user context
      {
        type: 'CSP_VIOLATION',
        violatedDirective: cspViolation['violated-directive'],
        effectiveDirective: cspViolation['effective-directive'],
        blockedUri: cspViolation['blocked-uri'],
        documentUri: cspViolation['document-uri'],
        sourceFile: cspViolation['source-file'],
        lineNumber: cspViolation['line-number'],
        columnNumber: cspViolation['column-number'],
        scriptSample: cspViolation['script-sample'],
        statusCode: cspViolation['status-code'],
        referrer: cspViolation['referrer'],
        disposition: cspViolation['disposition'],
        originalPolicy: cspViolation['original-policy'],
      },
      context
    );

    // Log to console for immediate attention if it's a critical violation
    const criticalDirectives = [
      'script-src',
      'object-src',
      'base-uri',
      'form-action'
    ];

    const isCritical = criticalDirectives.some(directive => 
      cspViolation['violated-directive'].includes(directive)
    );

    if (isCritical) {
      console.warn('[CSP VIOLATION - CRITICAL]', {
        violatedDirective: cspViolation['violated-directive'],
        blockedUri: cspViolation['blocked-uri'],
        documentUri: cspViolation['document-uri'],
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json({ received: true }, { status: 204 });

  } catch (error) {
    console.error('Failed to process CSP report:', error);
    return NextResponse.json({ error: 'Invalid report format' }, { status: 400 });
  }
}

// Apply minimal security headers (no CSP to avoid recursion)
export const POST = withSecurityHeaders({
  contentSecurityPolicy: false, // Disable CSP for this endpoint to avoid recursion
  frameOptions: 'DENY',
  contentTypeOptions: true,
  referrerPolicy: 'no-referrer',
})(cspReportHandler);