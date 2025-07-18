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