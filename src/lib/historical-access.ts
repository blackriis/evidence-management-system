import { UserRole } from "@prisma/client";
import { db } from "@/lib/db";
import { ACADEMIC_YEAR_ACCESS } from "@/lib/constants";

export interface HistoricalAccessConfig {
  userRole: UserRole;
  currentYear: number;
  requestedYear?: number;
  requestedAcademicYearId?: string;
}

export interface AccessibleYearInfo {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  year: number;
  isAccessible: boolean;
  accessReason?: string;
}

export interface SourceFilter {
  internal: boolean;
  external: boolean;
  all: boolean;
}

/**
 * Get accessible academic years for a user based on their role
 */
export async function getAccessibleAcademicYears(
  userRole: UserRole,
  currentYear: number = new Date().getFullYear()
): Promise<AccessibleYearInfo[]> {
  const allAcademicYears = await db.academicYear.findMany({
    where: { isActive: true },
    orderBy: { startDate: "desc" },
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
    }
  });

  return allAcademicYears.map(year => {
    const yearNumber = year.startDate.getFullYear();
    const isAccessible = canAccessAcademicYear(userRole, yearNumber, currentYear);
    
    let accessReason: string | undefined;
    if (!isAccessible) {
      if (userRole === UserRole.EQA_EVALUATOR) {
        accessReason = `EQA evaluators can only access years ${currentYear} to ${currentYear - 3}`;
      } else if (userRole === UserRole.IQA_EVALUATOR && ACADEMIC_YEAR_ACCESS.IQA_CURRENT_YEAR_ONLY) {
        accessReason = `IQA evaluators can only access current year (${currentYear})`;
      }
    }

    return {
      ...year,
      year: yearNumber,
      isAccessible,
      accessReason
    };
  });
}

/**
 * Check if a user can access a specific academic year
 */
export function canAccessAcademicYear(
  userRole: UserRole,
  targetYear: number,
  currentYear: number = new Date().getFullYear()
): boolean {
  switch (userRole) {
    case UserRole.EQA_EVALUATOR:
      // EQA can access current year (N) to N-3 years
      return targetYear >= (currentYear - 3) && targetYear <= currentYear;
    
    case UserRole.IQA_EVALUATOR:
      // IQA can only access current year by default
      if (ACADEMIC_YEAR_ACCESS.IQA_CURRENT_YEAR_ONLY) {
        return targetYear === currentYear;
      }
      return true;
    
    case UserRole.ADMIN:
    case UserRole.EXECUTIVE:
    case UserRole.TEACHER:
      // Admin, Executive, and Teachers can access all years
      return true;
    
    default:
      return false;
  }
}

/**
 * Get accessible academic year IDs for database queries
 */
export async function getAccessibleAcademicYearIds(
  userRole: UserRole,
  currentYear: number = new Date().getFullYear()
): Promise<string[]> {
  const accessibleYears = await getAccessibleAcademicYears(userRole, currentYear);
  return accessibleYears
    .filter(year => year.isAccessible)
    .map(year => year.id);
}

/**
 * Validate access to a specific academic year ID
 */
export async function validateAcademicYearAccess(
  userRole: UserRole,
  academicYearId: string,
  currentYear: number = new Date().getFullYear()
): Promise<{ isValid: boolean; error?: string }> {
  const academicYear = await db.academicYear.findUnique({
    where: { id: academicYearId },
    select: { startDate: true, name: true }
  });

  if (!academicYear) {
    return { isValid: false, error: "Academic year not found" };
  }

  const yearNumber = academicYear.startDate.getFullYear();
  const canAccess = canAccessAcademicYear(userRole, yearNumber, currentYear);

  if (!canAccess) {
    let error = "Access denied to this academic year";
    if (userRole === UserRole.EQA_EVALUATOR) {
      error = `EQA evaluators can only access years ${currentYear} to ${currentYear - 3}`;
    } else if (userRole === UserRole.IQA_EVALUATOR && ACADEMIC_YEAR_ACCESS.IQA_CURRENT_YEAR_ONLY) {
      error = `IQA evaluators can only access current year (${currentYear})`;
    }
    return { isValid: false, error };
  }

  return { isValid: true };
}

/**
 * Get source filter options for EQA users
 */
export function getSourceFilterOptions(userRole: UserRole): SourceFilter {
  if (userRole === UserRole.EQA_EVALUATOR) {
    return {
      internal: true,
      external: true,
      all: true
    };
  }
  
  // Other roles don't need source filtering
  return {
    internal: false,
    external: false,
    all: true
  };
}

/**
 * Apply source filtering to database queries for EQA users
 */
export function applySourceFilter(
  userRole: UserRole,
  sourceFilter: "internal" | "external" | "all" = "all",
  baseWhere: any = {}
): any {
  if (userRole !== UserRole.EQA_EVALUATOR || sourceFilter === "all") {
    return baseWhere;
  }

  // For EQA evaluators, we need to distinguish between internal and external evidence
  // Internal evidence: uploaded by teachers within the organization
  // External evidence: uploaded by external evaluators or imported from external sources
  
  if (sourceFilter === "internal") {
    return {
      ...baseWhere,
      uploader: {
        role: {
          in: [UserRole.TEACHER, UserRole.ADMIN]
        }
      }
    };
  } else if (sourceFilter === "external") {
    return {
      ...baseWhere,
      uploader: {
        role: {
          in: [UserRole.EQA_EVALUATOR, UserRole.IQA_EVALUATOR]
        }
      }
    };
  }

  return baseWhere;
}

/**
 * Create historical data archiving query
 */
export async function getHistoricalDataQuery(
  userRole: UserRole,
  options: {
    academicYearIds?: string[];
    sourceFilter?: "internal" | "external" | "all";
    includeDeleted?: boolean;
    dateRange?: {
      startDate: Date;
      endDate: Date;
    };
  } = {}
) {
  const currentYear = new Date().getFullYear();
  
  // Validate access
  const accessibleYearIds = await getAccessibleAcademicYearIds(userRole, currentYear);
  
  let whereClause: any = {};

  // Apply academic year filtering
  if (options.academicYearIds && options.academicYearIds.length > 0) {
    // Filter requested years by accessible years
    const validYearIds = options.academicYearIds.filter(id => 
      accessibleYearIds.includes(id)
    );
    whereClause.academicYearId = { in: validYearIds };
  } else {
    whereClause.academicYearId = { in: accessibleYearIds };
  }

  // Apply soft delete filtering
  if (!options.includeDeleted) {
    whereClause.deletedAt = null;
  }

  // Apply date range filtering
  if (options.dateRange) {
    whereClause.uploadedAt = {
      gte: options.dateRange.startDate,
      lte: options.dateRange.endDate
    };
  }

  // Apply source filtering for EQA users
  whereClause = applySourceFilter(userRole, options.sourceFilter, whereClause);

  return whereClause;
}

/**
 * Archive old academic year data (for admin use)
 */
export async function archiveAcademicYearData(
  academicYearId: string,
  retentionYears: number = 5
): Promise<{ success: boolean; archivedCount: number; error?: string }> {
  try {
    const academicYear = await db.academicYear.findUnique({
      where: { id: academicYearId },
      select: { startDate: true, endDate: true, name: true }
    });

    if (!academicYear) {
      return { success: false, archivedCount: 0, error: "Academic year not found" };
    }

    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - retentionYears);

    // Only archive if the academic year is older than retention period
    if (academicYear.endDate > cutoffDate) {
      return { 
        success: false, 
        archivedCount: 0, 
        error: `Academic year ${academicYear.name} is within retention period` 
      };
    }

    // Mark academic year as inactive (soft archive)
    await db.academicYear.update({
      where: { id: academicYearId },
      data: { isActive: false }
    });

    // Count evidence that would be affected
    const evidenceCount = await db.evidence.count({
      where: { 
        academicYearId,
        deletedAt: null
      }
    });

    return { 
      success: true, 
      archivedCount: evidenceCount,
      error: undefined
    };

  } catch (error) {
    console.error("Archive error:", error);
    return { 
      success: false, 
      archivedCount: 0, 
      error: "Failed to archive academic year data" 
    };
  }
}