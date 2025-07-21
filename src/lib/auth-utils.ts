import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { UserRole } from "@/lib/user-role";
import { redirect } from "next/navigation";
import { ROLE_PERMISSIONS, ACADEMIC_YEAR_ACCESS } from "@/lib/constants";

export async function getRequiredSession() {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    redirect("/auth/signin");
  }
  
  return session;
}

export async function getOptionalSession() {
  return await getServerSession(authOptions);
}

export async function requireRole(allowedRoles: UserRole[]) {
  const session = await getRequiredSession();
  
  if (!allowedRoles.includes(session.user.role)) {
    redirect("/unauthorized");
  }
  
  return session;
}

export async function requireAdmin() {
  return requireRole([UserRole.ADMIN]);
}

export async function requireTeacher() {
  return requireRole([UserRole.TEACHER, UserRole.ADMIN]);
}

export async function requireIQAEvaluator() {
  return requireRole([UserRole.IQA_EVALUATOR, UserRole.ADMIN]);
}

export async function requireEQAEvaluator() {
  return requireRole([UserRole.EQA_EVALUATOR, UserRole.ADMIN]);
}

export async function requireExecutive() {
  return requireRole([UserRole.EXECUTIVE, UserRole.ADMIN]);
}

// Permission checking functions using constants
export function hasRole(userRole: UserRole, allowedRoles: UserRole[]): boolean {
  return allowedRoles.includes(userRole);
}

export function isAdmin(userRole: UserRole): boolean {
  return userRole === UserRole.ADMIN;
}

export function hasPermission(userRole: UserRole, permission: keyof typeof ROLE_PERMISSIONS[UserRole]): boolean {
  return ROLE_PERMISSIONS[userRole][permission];
}

export function canManageUsers(userRole: UserRole): boolean {
  return hasPermission(userRole, 'canManageUsers');
}

export function canManageAcademicYears(userRole: UserRole): boolean {
  return hasPermission(userRole, 'canManageAcademicYears');
}

export function canManageIndicators(userRole: UserRole): boolean {
  return hasPermission(userRole, 'canManageIndicators');
}

export function canUploadEvidence(userRole: UserRole): boolean {
  return hasPermission(userRole, 'canUploadEvidence');
}

export function canEvaluateIQA(userRole: UserRole): boolean {
  return hasPermission(userRole, 'canEvaluateIQA');
}

export function canEvaluateEQA(userRole: UserRole): boolean {
  return hasPermission(userRole, 'canEvaluateEQA');
}

export function canViewExecutiveDashboard(userRole: UserRole): boolean {
  return hasPermission(userRole, 'canViewExecutiveDashboard');
}

export function canAccessRecycleBin(userRole: UserRole): boolean {
  return hasPermission(userRole, 'canAccessRecycleBin');
}

export function canViewAuditLogs(userRole: UserRole): boolean {
  return hasPermission(userRole, 'canViewAuditLogs');
}

export function canExportReports(userRole: UserRole): boolean {
  return hasPermission(userRole, 'canExportReports');
}

// Academic year access control
export function getAccessibleAcademicYears(userRole: UserRole, currentYear: number): number[] {
  if (userRole === UserRole.EQA_EVALUATOR) {
    // EQA can access current year (N) to N-3 years
    const years = [];
    for (let i = 0; i < ACADEMIC_YEAR_ACCESS.EQA_HISTORICAL_YEARS; i++) {
      years.push(currentYear - i);
    }
    return years;
  }
  
  if (userRole === UserRole.IQA_EVALUATOR && ACADEMIC_YEAR_ACCESS.IQA_CURRENT_YEAR_ONLY) {
    // IQA can only access current year by default
    return [currentYear];
  }
  
  // Admin and other roles can access all years
  return [];
}

export function canAccessAcademicYear(userRole: UserRole, targetYear: number, currentYear: number): boolean {
  const accessibleYears = getAccessibleAcademicYears(userRole, currentYear);
  
  // If empty array, user can access all years (Admin, etc.)
  if (accessibleYears.length === 0) {
    return true;
  }
  
  return accessibleYears.includes(targetYear);
}

// Session validation helpers
export async function validateSessionAndRole(requiredRoles: UserRole[]) {
  const session = await getOptionalSession();
  
  if (!session) {
    return { isValid: false, error: "Not authenticated", session: null };
  }
  
  if (!requiredRoles.includes(session.user.role)) {
    return { isValid: false, error: "Insufficient permissions", session };
  }
  
  return { isValid: true, error: null, session };
}

// Error response helpers
export function createAuthError(message: string, status: number = 401) {
  return {
    error: {
      code: status === 401 ? "UNAUTHORIZED" : "FORBIDDEN",
      message,
      timestamp: new Date().toISOString(),
    }
  };
}