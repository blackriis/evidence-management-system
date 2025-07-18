import { db } from "./db";
import { UserRole } from "@prisma/client";

export interface ScopeContext {
  userId: string;
  role: UserRole;
  isActive: boolean;
}

export interface ScopeFilter {
  educationLevelIds?: string[];
  standardIds?: string[];
  indicatorIds?: string[];
  subIndicatorIds?: string[];
}

export class ScopeMiddleware {
  /**
   * Get user's scope-based filter based on their role and assignments
   */
  static async getUserScopeFilter(context: ScopeContext): Promise<ScopeFilter> {
    const filter: ScopeFilter = {};

    switch (context.role) {
      case UserRole.ADMIN:
        // Admin has access to everything - no filter needed
        break;

      case UserRole.TEACHER:
        // Teachers can only access sub-indicators they own
        const teacherSubIndicators = await db.subIndicator.findMany({
          where: { ownerId: context.userId },
          select: { id: true }
        });
        
        filter.subIndicatorIds = teacherSubIndicators.map(si => si.id);
        break;

      case UserRole.IQA_EVALUATOR:
        // IQA evaluators can access all sub-indicators (for current year)
        // This will be further filtered by academic year in the calling code
        break;

      case UserRole.EQA_EVALUATOR:
        // EQA evaluators can access all sub-indicators (for N to N-3 years)
        // This will be further filtered by academic year in the calling code
        break;

      case UserRole.EXECUTIVE:
        // Executives can access everything for reporting purposes
        break;

      default:
        // Default to no access
        filter.subIndicatorIds = [];
        break;
    }

    return filter;
  }

  /**
   * Apply scope filter to evidence queries
   */
  static async applyEvidenceFilter(
    context: ScopeContext,
    baseWhere: any = {}
  ): Promise<any> {
    const scopeFilter = await this.getUserScopeFilter(context);
    const where = { ...baseWhere };

    // Apply sub-indicator filter if specified
    if (scopeFilter.subIndicatorIds !== undefined) {
      where.subIndicatorId = {
        in: scopeFilter.subIndicatorIds
      };
    }

    // Apply role-specific academic year restrictions
    if (context.role === UserRole.IQA_EVALUATOR) {
      // IQA evaluators can only access current year
      const currentAcademicYear = await db.academicYear.findFirst({
        where: { isActive: true }
      });
      
      if (currentAcademicYear) {
        where.academicYearId = currentAcademicYear.id;
      }
    } else if (context.role === UserRole.EQA_EVALUATOR) {
      // EQA evaluators can access N to N-3 years
      const currentYear = new Date().getFullYear();
      const validAcademicYears = await db.academicYear.findMany({
        where: {
          startDate: {
            gte: new Date(`${currentYear - 3}-01-01`),
            lte: new Date(`${currentYear + 1}-12-31`)
          }
        },
        select: { id: true }
      });
      
      where.academicYearId = {
        in: validAcademicYears.map(year => year.id)
      };
    }

    return where;
  }

  /**
   * Apply scope filter to sub-indicator queries
   */
  static async applySubIndicatorFilter(
    context: ScopeContext,
    baseWhere: any = {}
  ): Promise<any> {
    const scopeFilter = await this.getUserScopeFilter(context);
    const where = { ...baseWhere };

    // Apply sub-indicator filter if specified
    if (scopeFilter.subIndicatorIds !== undefined) {
      where.id = {
        in: scopeFilter.subIndicatorIds
      };
    }

    return where;
  }

  /**
   * Apply scope filter to indicator queries
   */
  static async applyIndicatorFilter(
    context: ScopeContext,
    baseWhere: any = {}
  ): Promise<any> {
    const scopeFilter = await this.getUserScopeFilter(context);
    const where = { ...baseWhere };

    // If user has sub-indicator restrictions, filter indicators accordingly
    if (scopeFilter.subIndicatorIds !== undefined) {
      const indicators = await db.indicator.findMany({
        where: {
          subIndicators: {
            some: {
              id: {
                in: scopeFilter.subIndicatorIds
              }
            }
          }
        },
        select: { id: true }
      });

      where.id = {
        in: indicators.map(ind => ind.id)
      };
    }

    return where;
  }

  /**
   * Check if user can access specific evidence
   */
  static async canAccessEvidence(
    context: ScopeContext,
    evidenceId: string
  ): Promise<boolean> {
    const evidence = await db.evidence.findUnique({
      where: { id: evidenceId },
      include: {
        academicYear: true,
        subIndicator: true
      }
    });

    if (!evidence) {
      return false;
    }

    // Apply scope filter to check access
    const scopeFilter = await this.getUserScopeFilter(context);

    // Check sub-indicator access
    if (scopeFilter.subIndicatorIds !== undefined) {
      if (!scopeFilter.subIndicatorIds.includes(evidence.subIndicatorId)) {
        return false;
      }
    }

    // Check role-specific restrictions
    if (context.role === UserRole.TEACHER) {
      // Teachers can only access their own evidence
      return evidence.uploaderId === context.userId;
    } else if (context.role === UserRole.IQA_EVALUATOR) {
      // IQA evaluators can only access current year
      return evidence.academicYear.isActive;
    } else if (context.role === UserRole.EQA_EVALUATOR) {
      // EQA evaluators can access N to N-3 years
      const currentYear = new Date().getFullYear();
      const evidenceYear = evidence.academicYear.startDate.getFullYear();
      return currentYear - evidenceYear <= 3;
    }

    return true;
  }

  /**
   * Check if user can access specific sub-indicator
   */
  static async canAccessSubIndicator(
    context: ScopeContext,
    subIndicatorId: string
  ): Promise<boolean> {
    const scopeFilter = await this.getUserScopeFilter(context);

    // Check sub-indicator access
    if (scopeFilter.subIndicatorIds !== undefined) {
      return scopeFilter.subIndicatorIds.includes(subIndicatorId);
    }

    return true;
  }

  /**
   * Check if user can modify specific sub-indicator (assignment)
   */
  static async canModifySubIndicator(
    context: ScopeContext,
    subIndicatorId: string
  ): Promise<boolean> {
    // Only admins can modify assignments
    if (context.role !== UserRole.ADMIN) {
      return false;
    }

    const subIndicator = await db.subIndicator.findUnique({
      where: { id: subIndicatorId }
    });

    return !!subIndicator;
  }

  /**
   * Get user's assigned sub-indicators
   */
  static async getUserAssignedSubIndicators(userId: string): Promise<string[]> {
    const subIndicators = await db.subIndicator.findMany({
      where: { ownerId: userId },
      select: { id: true }
    });

    return subIndicators.map(si => si.id);
  }

  /**
   * Get scope statistics for a user
   */
  static async getUserScopeStats(context: ScopeContext): Promise<{
    assignedSubIndicators: number;
    accessibleEvidence: number;
    accessibleEvaluations: number;
  }> {
    const scopeFilter = await this.getUserScopeFilter(context);
    
    let assignedSubIndicators = 0;
    let accessibleEvidence = 0;
    let accessibleEvaluations = 0;

    if (context.role === UserRole.TEACHER) {
      // Count assigned sub-indicators
      assignedSubIndicators = await db.subIndicator.count({
        where: { ownerId: context.userId }
      });

      // Count accessible evidence (their own uploads)
      accessibleEvidence = await db.evidence.count({
        where: {
          uploaderId: context.userId,
          deletedAt: null
        }
      });

      // Count accessible evaluations (on their evidence)
      accessibleEvaluations = await db.evaluation.count({
        where: {
          evidence: {
            uploaderId: context.userId,
            deletedAt: null
          }
        }
      });
    } else if (context.role === UserRole.ADMIN) {
      // Admin has access to everything
      assignedSubIndicators = await db.subIndicator.count();
      accessibleEvidence = await db.evidence.count({
        where: { deletedAt: null }
      });
      accessibleEvaluations = await db.evaluation.count();
    } else {
      // For evaluators and executives, count all accessible items
      const evidenceWhere = await this.applyEvidenceFilter(context);
      accessibleEvidence = await db.evidence.count({
        where: {
          ...evidenceWhere,
          deletedAt: null
        }
      });

      accessibleEvaluations = await db.evaluation.count({
        where: {
          evidence: {
            ...evidenceWhere,
            deletedAt: null
          }
        }
      });

      assignedSubIndicators = await db.subIndicator.count();
    }

    return {
      assignedSubIndicators,
      accessibleEvidence,
      accessibleEvaluations
    };
  }
}