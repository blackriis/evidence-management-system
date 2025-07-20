import { UserRole } from "@prisma/client";

export const ROLE_PERMISSIONS = {
  [UserRole.ADMIN]: {
    canManageUsers: true,
    canManageAcademicYears: true,
    canManageIndicators: true,
    canUploadEvidence: true,
    canEvaluateIQA: true,
    canEvaluateEQA: true,
    canViewExecutiveDashboard: true,
    canAccessRecycleBin: true,
    canViewAuditLogs: true,
    canExportReports: true,
  },
  [UserRole.TEACHER]: {
    canManageUsers: false,
    canManageAcademicYears: false,
    canManageIndicators: false,
    canUploadEvidence: true,
    canEvaluateIQA: false,
    canEvaluateEQA: false,
    canViewExecutiveDashboard: false,
    canAccessRecycleBin: false,
    canViewAuditLogs: false,
    canExportReports: false,
  },
  [UserRole.IQA_EVALUATOR]: {
    canManageUsers: false,
    canManageAcademicYears: false,
    canManageIndicators: false,
    canUploadEvidence: false,
    canEvaluateIQA: true,
    canEvaluateEQA: false,
    canViewExecutiveDashboard: false,
    canAccessRecycleBin: false,
    canViewAuditLogs: false,
    canExportReports: false,
  },
  [UserRole.EQA_EVALUATOR]: {
    canManageUsers: false,
    canManageAcademicYears: false,
    canManageIndicators: false,
    canUploadEvidence: false,
    canEvaluateIQA: false,
    canEvaluateEQA: true,
    canViewExecutiveDashboard: false,
    canAccessRecycleBin: false,
    canViewAuditLogs: false,
    canExportReports: false,
  },
  [UserRole.EXECUTIVE]: {
    canManageUsers: false,
    canManageAcademicYears: false,
    canManageIndicators: false,
    canUploadEvidence: false,
    canEvaluateIQA: false,
    canEvaluateEQA: false,
    canViewExecutiveDashboard: true,
    canAccessRecycleBin: false,
    canViewAuditLogs: false,
    canExportReports: true,
  },
} as const;

export const ROLE_LABELS = {
  [UserRole.ADMIN]: "ผู้ดูแลระบบ",
  [UserRole.TEACHER]: "ครู",
  [UserRole.IQA_EVALUATOR]: "ผู้ประเมิน IQA",
  [UserRole.EQA_EVALUATOR]: "ผู้ประเมิน EQA",
  [UserRole.EXECUTIVE]: "ผู้บริหาร",
} as const;

export const ACADEMIC_YEAR_ACCESS = {
  // EQA evaluators can only access current year (N) to N-3 years
  EQA_HISTORICAL_YEARS: 4,
  // IQA evaluators can access current year only by default
  IQA_CURRENT_YEAR_ONLY: true,
} as const;

export const FILE_UPLOAD_LIMITS = {
  MAX_FILE_SIZE: 5 * 1024 * 1024 * 1024, // 5GB per user per academic year
  CHUNK_SIZE: 10 * 1024 * 1024, // 10MB chunks for large files
  ALLOWED_MIME_TYPES: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "image/jpeg",
    "image/png",
    "image/gif",
    "text/plain",
  ],
} as const;

export const EVALUATION_SCORES = {
  QUALITATIVE_MIN: 1,
  QUALITATIVE_MAX: 5,
  QUANTITATIVE_MIN: 0,
  QUANTITATIVE_MAX: 100,
} as const;

export const RECYCLE_BIN_RETENTION_DAYS = 90;

// Security-related constants
export const SECURITY_CONSTANTS = {
  // Rate limiting
  RATE_LIMIT: {
    AUTH_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
    AUTH_MAX_ATTEMPTS: 5,
    API_WINDOW_MS: 60 * 1000, // 1 minute
    API_MAX_REQUESTS: 100,
    UPLOAD_WINDOW_MS: 60 * 1000, // 1 minute
    UPLOAD_MAX_REQUESTS: 10,
    EXPORT_WINDOW_MS: 5 * 60 * 1000, // 5 minutes
    EXPORT_MAX_REQUESTS: 3,
  },

  // File security
  FILE_SECURITY: {
    DANGEROUS_EXTENSIONS: [
      'exe', 'bat', 'cmd', 'com', 'pif', 'scr', 'vbs', 'js', 'jar',
      'php', 'py', 'rb', 'pl', 'sh', 'bash', 'msi', 'dll', 'app'
    ],
    MAX_FILENAME_LENGTH: 255,
    SCAN_FOR_MALWARE: true,
    QUARANTINE_SUSPICIOUS: true,
  },

  // Session security
  SESSION: {
    MAX_AGE_SECONDS: 24 * 60 * 60, // 24 hours
    ROTATION_INTERVAL: 60 * 60, // 1 hour
    SECURE_COOKIES: process.env.NODE_ENV === 'production',
    SAME_SITE: 'strict' as const,
  },

  // CSRF protection
  CSRF: {
    TOKEN_LENGTH: 32,
    COOKIE_NAME: 'csrf-token',
    HEADER_NAME: 'x-csrf-token',
    TOKEN_EXPIRY: 24 * 60 * 60 * 1000, // 24 hours
  },

  // Password requirements
  PASSWORD: {
    MIN_LENGTH: 8,
    REQUIRE_UPPERCASE: true,
    REQUIRE_LOWERCASE: true,
    REQUIRE_NUMBERS: true,
    REQUIRE_SPECIAL_CHARS: true,
    MAX_LOGIN_ATTEMPTS: 5,
    LOCKOUT_DURATION_MS: 30 * 60 * 1000, // 30 minutes
  },

  // Audit logging
  AUDIT: {
    RETENTION_DAYS: 2555, // 7 years
    LOG_SECURITY_EVENTS: true,
    ALERT_THRESHOLD_CRITICAL: 1,
    ALERT_THRESHOLD_HIGH: 10,
    ALERT_THRESHOLD_MEDIUM: 50,
  },

  // Content Security Policy
  CSP: {
    NONCE_LENGTH: 16,
    REPORT_ONLY: false,
    REPORT_ENDPOINT: '/api/security/csp-report',
  },

  // Security headers
  HEADERS: {
    HSTS_MAX_AGE: 31536000, // 1 year
    FRAME_OPTIONS: 'DENY',
    CONTENT_TYPE_OPTIONS: 'nosniff',
    REFERRER_POLICY: 'strict-origin-when-cross-origin',
    PERMISSIONS_POLICY: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  },
} as const;