/**
 * Security Configuration and Constants
 */

export const SECURITY_CONFIG = {
  // Rate limiting configurations
  RATE_LIMITS: {
    AUTH: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 5,
    },
    UPLOAD: {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 10,
    },
    API: {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 100,
    },
    ADMIN: {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 50,
    },
    EXPORT: {
      windowMs: 5 * 60 * 1000, // 5 minutes
      maxRequests: 3,
    },
  },

  // File upload security
  FILE_SECURITY: {
    MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB
    ALLOWED_MIME_TYPES: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/jpeg',
      'image/png',
      'image/gif',
      'text/plain',
    ],
    DANGEROUS_EXTENSIONS: [
      'exe', 'bat', 'cmd', 'com', 'pif', 'scr', 'vbs', 'js', 'jar', 
      'php', 'py', 'rb', 'pl', 'sh', 'bash', 'msi', 'dll'
    ],
    SCAN_FOR_MALWARE: true,
    QUARANTINE_SUSPICIOUS_FILES: true,
  },

  // Session security
  SESSION: {
    MAX_AGE: 24 * 60 * 60, // 24 hours
    SECURE_COOKIES: process.env.NODE_ENV === 'production',
    SAME_SITE: 'strict' as const,
    HTTP_ONLY: true,
    ROTATE_ON_LOGIN: true,
  },

  // Password security
  PASSWORD: {
    MIN_LENGTH: 8,
    REQUIRE_UPPERCASE: true,
    REQUIRE_LOWERCASE: true,
    REQUIRE_NUMBERS: true,
    REQUIRE_SPECIAL_CHARS: true,
    MAX_LOGIN_ATTEMPTS: 5,
    LOCKOUT_DURATION: 30 * 60 * 1000, // 30 minutes
  },

  // CSRF protection
  CSRF: {
    TOKEN_LENGTH: 32,
    COOKIE_NAME: 'csrf-token',
    HEADER_NAME: 'x-csrf-token',
    SECURE_COOKIES: process.env.NODE_ENV === 'production',
  },

  // Content Security Policy
  CSP: {
    REPORT_ONLY: false,
    REPORT_URI: '/api/security/csp-report',
    NONCE_LENGTH: 16,
  },

  // Audit logging
  AUDIT: {
    RETENTION_DAYS: 2555, // 7 years
    LOG_ALL_REQUESTS: false,
    LOG_SECURITY_EVENTS: true,
    ALERT_ON_CRITICAL_EVENTS: true,
  },

  // IP restrictions (if needed)
  IP_RESTRICTIONS: {
    ENABLED: false,
    WHITELIST: [] as string[],
    BLACKLIST: [] as string[],
  },

  // Security headers
  HEADERS: {
    HSTS_MAX_AGE: 31536000, // 1 year
    INCLUDE_SUBDOMAINS: true,
    PRELOAD: true,
    FRAME_OPTIONS: 'DENY',
    CONTENT_TYPE_OPTIONS: 'nosniff',
    REFERRER_POLICY: 'strict-origin-when-cross-origin',
  },
} as const;

/**
 * Security validation utilities
 */
export class SecurityValidator {
  /**
   * Validate password strength
   */
  static validatePassword(password: string): {
    isValid: boolean;
    errors: string[];
    score: number; // 0-100
  } {
    const errors: string[] = [];
    let score = 0;

    if (password.length < SECURITY_CONFIG.PASSWORD.MIN_LENGTH) {
      errors.push(`Password must be at least ${SECURITY_CONFIG.PASSWORD.MIN_LENGTH} characters long`);
    } else {
      score += 20;
    }

    if (SECURITY_CONFIG.PASSWORD.REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    } else {
      score += 20;
    }

    if (SECURITY_CONFIG.PASSWORD.REQUIRE_LOWERCASE && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    } else {
      score += 20;
    }

    if (SECURITY_CONFIG.PASSWORD.REQUIRE_NUMBERS && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    } else {
      score += 20;
    }

    if (SECURITY_CONFIG.PASSWORD.REQUIRE_SPECIAL_CHARS && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    } else {
      score += 20;
    }

    // Additional scoring for length and complexity
    if (password.length >= 12) score += 10;
    if (password.length >= 16) score += 10;
    if (/[!@#$%^&*(),.?":{}|<>].*[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 5;

    return {
      isValid: errors.length === 0,
      errors,
      score: Math.min(100, score),
    };
  }

  /**
   * Validate IP address format
   */
  static validateIPAddress(ip: string): boolean {
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    
    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
  }

  /**
   * Check if IP is in whitelist/blacklist
   */
  static isIPAllowed(ip: string): boolean {
    if (!SECURITY_CONFIG.IP_RESTRICTIONS.ENABLED) {
      return true;
    }

    // Check blacklist first
    if (SECURITY_CONFIG.IP_RESTRICTIONS.BLACKLIST.includes(ip)) {
      return false;
    }

    // If whitelist is empty, allow all (except blacklisted)
    if (SECURITY_CONFIG.IP_RESTRICTIONS.WHITELIST.length === 0) {
      return true;
    }

    // Check whitelist
    return SECURITY_CONFIG.IP_RESTRICTIONS.WHITELIST.includes(ip);
  }

  /**
   * Validate file extension against dangerous list
   */
  static isFileExtensionSafe(filename: string): boolean {
    const extension = filename.split('.').pop()?.toLowerCase();
    if (!extension) return false;
    
    return !SECURITY_CONFIG.FILE_SECURITY.DANGEROUS_EXTENSIONS.includes(extension);
  }

  /**
   * Validate MIME type against allowed list
   */
  static isMimeTypeAllowed(mimeType: string): boolean {
    return SECURITY_CONFIG.FILE_SECURITY.ALLOWED_MIME_TYPES.includes(mimeType);
  }
}

/**
 * Security event types for monitoring
 */
export enum SecurityEventType {
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  CSRF_VIOLATION = 'CSRF_VIOLATION',
  MALWARE_DETECTED = 'MALWARE_DETECTED',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  SUSPICIOUS_FILE_UPLOAD = 'SUSPICIOUS_FILE_UPLOAD',
  BRUTE_FORCE_ATTEMPT = 'BRUTE_FORCE_ATTEMPT',
  SQL_INJECTION_ATTEMPT = 'SQL_INJECTION_ATTEMPT',
  XSS_ATTEMPT = 'XSS_ATTEMPT',
  DIRECTORY_TRAVERSAL_ATTEMPT = 'DIRECTORY_TRAVERSAL_ATTEMPT',
  INVALID_SESSION = 'INVALID_SESSION',
}

/**
 * Security monitoring utilities
 */
export class SecurityMonitor {
  private static readonly ALERT_THRESHOLDS = {
    [SecurityEventType.RATE_LIMIT_EXCEEDED]: 50, // per hour
    [SecurityEventType.CSRF_VIOLATION]: 10, // per hour
    [SecurityEventType.MALWARE_DETECTED]: 1, // immediate alert
    [SecurityEventType.UNAUTHORIZED_ACCESS]: 20, // per hour
    [SecurityEventType.BRUTE_FORCE_ATTEMPT]: 10, // per hour
  };

  /**
   * Check if security event should trigger an alert
   */
  static shouldAlert(eventType: SecurityEventType, recentCount: number): boolean {
    const threshold = this.ALERT_THRESHOLDS[eventType];
    return threshold !== undefined && recentCount >= threshold;
  }

  /**
   * Get security event severity
   */
  static getEventSeverity(eventType: SecurityEventType): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    switch (eventType) {
      case SecurityEventType.MALWARE_DETECTED:
        return 'CRITICAL';
      case SecurityEventType.UNAUTHORIZED_ACCESS:
      case SecurityEventType.BRUTE_FORCE_ATTEMPT:
        return 'HIGH';
      case SecurityEventType.CSRF_VIOLATION:
      case SecurityEventType.SUSPICIOUS_FILE_UPLOAD:
      case SecurityEventType.SQL_INJECTION_ATTEMPT:
      case SecurityEventType.XSS_ATTEMPT:
        return 'MEDIUM';
      default:
        return 'LOW';
    }
  }
}

export default SECURITY_CONFIG;