import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { UserRole } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { 
        id: true, 
        role: true, 
        isActive: true,
        ownedSubIndicators: {
          select: { id: true }
        }
      }
    });

    if (!user?.isActive) {
      return NextResponse.json({ error: "Account is inactive" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const academicYearId = searchParams.get("academicYearId");
    const timeRange = searchParams.get("timeRange") || "30"; // days
    const includeInactive = searchParams.get("includeInactive") === "true";

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(timeRange));

    // Build base filters based on user role
    let evidenceFilter: any = {
      deletedAt: null,
      uploadedAt: {
        gte: startDate,
        lte: endDate
      }
    };

    let evaluationFilter: any = {
      evidence: {
        deletedAt: null
      },
      evaluatedAt: {
        gte: startDate,
        lte: endDate
      }
    };

    // Apply academic year filter if specified
    if (academicYearId) {
      evidenceFilter.academicYearId = academicYearId;
      evaluationFilter.evidence.academicYearId = academicYearId;
    }

    // Apply role-based filtering
    if (user.role === UserRole.TEACHER) {
      // Teachers can only see their own evidence
      evidenceFilter.uploaderId = user.id;
      evaluationFilter.evidence.uploaderId = user.id;
    } else if (user.role === UserRole.IQA_EVALUATOR) {
      // IQA evaluators can see evidence in their assigned scopes
      const ownedSubIndicatorIds = user.ownedSubIndicators.map(si => si.id);
      if (ownedSubIndicatorIds.length > 0) {
        evidenceFilter.subIndicatorId = { in: ownedSubIndicatorIds };
        evaluationFilter.evidence.subIndicatorId = { in: ownedSubIndicatorIds };
      } else {
        // No assigned scopes, return empty results
        evidenceFilter.id = "no-access";
        evaluationFilter.evidenceId = "no-access";
      }
    } else if (user.role === UserRole.EQA_EVALUATOR) {
      // EQA evaluators can see all evidence but with historical restrictions
      // For now, apply same logic as IQA but can be extended
      const ownedSubIndicatorIds = user.ownedSubIndicators.map(si => si.id);
      if (ownedSubIndicatorIds.length > 0) {
        evidenceFilter.subIndicatorId = { in: ownedSubIndicatorIds };
        evaluationFilter.evidence.subIndicatorId = { in: ownedSubIndicatorIds };
      }
    }
    // ADMIN and EXECUTIVE can see all data (no additional filters)

    // Get evidence metrics
    const [
      totalEvidence,
      recentEvidence,
      evidenceByRole,
      evidenceBySubIndicator,
      evidenceByStatus
    ] = await Promise.all([
      // Total evidence count
      db.evidence.count({
        where: {
          deletedAt: null,
          ...(academicYearId && { academicYearId })
        }
      }),
      
      // Recent evidence count
      db.evidence.count({
        where: evidenceFilter
      }),
      
      // Evidence by uploader role
      db.evidence.groupBy({
        by: ['uploaderId'],
        where: evidenceFilter,
        _count: { id: true },
        take: 10
      }),
      
      // Evidence by sub-indicator
      db.evidence.groupBy({
        by: ['subIndicatorId'],
        where: evidenceFilter,
        _count: { id: true },
        take: 10
      }),
      
      // Evidence by academic year
      db.evidence.groupBy({
        by: ['academicYearId'],
        where: evidenceFilter,
        _count: { id: true },
        take: 5
      })
    ]);

    // Get evaluation metrics
    const [
      totalEvaluations,
      recentEvaluations,
      evaluationsByRole,
      evaluationsByScore,
      pendingEvaluations
    ] = await Promise.all([
      // Total evaluations count
      db.evaluation.count({
        where: {
          evidence: { deletedAt: null },
          ...(academicYearId && { evidence: { academicYearId, deletedAt: null } })
        }
      }),
      
      // Recent evaluations count
      db.evaluation.count({
        where: evaluationFilter
      }),
      
      // Evaluations by evaluator role
      db.evaluation.groupBy({
        by: ['evaluatorId'],
        where: evaluationFilter,
        _count: { id: true },
        take: 10
      }),
      
      // Evaluations by qualitative score
      db.evaluation.groupBy({
        by: ['qualitativeScore'],
        where: {
          ...evaluationFilter,
          qualitativeScore: { not: null }
        },
        _count: { id: true }
      }),
      
      // Count evidence needing evaluation
      db.evidence.count({
        where: {
          ...evidenceFilter,
          evaluations: { none: {} }
        }
      })
    ]);

    // Get user activity metrics
    const [
      activeUsers,
      usersByRole,
      recentUploads,
      recentEvaluations24h
    ] = await Promise.all([
      // Active users in period
      db.user.count({
        where: {
          isActive: true,
          deletedAt: null,
          OR: [
            {
              evidence: {
                some: {
                  uploadedAt: { gte: startDate },
                  deletedAt: null
                }
              }
            },
            {
              evaluations: {
                some: {
                  evaluatedAt: { gte: startDate }
                }
              }
            }
          ]
        }
      }),
      
      // Users by role
      db.user.groupBy({
        by: ['role'],
        where: {
          isActive: true,
          deletedAt: null
        },
        _count: { role: true }
      }),
      
      // Recent uploads (last 24h)
      db.evidence.count({
        where: {
          deletedAt: null,
          uploadedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        }
      }),
      
      // Recent evaluations (last 24h)
      db.evaluation.count({
        where: {
          evidence: { deletedAt: null },
          evaluatedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        }
      })
    ]);

    // Calculate completion rates
    const completionRate = totalEvidence > 0 ? 
      Math.round((totalEvaluations / totalEvidence) * 100) : 0;

    const recentCompletionRate = recentEvidence > 0 ? 
      Math.round((recentEvaluations / recentEvidence) * 100) : 0;

    // Get detailed role information for evidence and evaluations
    const uploaderDetails = await db.user.findMany({
      where: {
        id: { in: evidenceByRole.map(e => e.uploaderId) }
      },
      select: {
        id: true,
        name: true,
        role: true
      }
    });

    const evaluatorDetails = await db.user.findMany({
      where: {
        id: { in: evaluationsByRole.map(e => e.evaluatorId) }
      },
      select: {
        id: true,
        name: true,
        role: true
      }
    });

    const subIndicatorDetails = await db.subIndicator.findMany({
      where: {
        id: { in: evidenceBySubIndicator.map(e => e.subIndicatorId) }
      },
      select: {
        id: true,
        name: true,
        code: true,
        indicator: {
          select: {
            name: true,
            code: true
          }
        }
      }
    });

    const academicYearDetails = await db.academicYear.findMany({
      where: {
        id: { in: evidenceByStatus.map(e => e.academicYearId) }
      },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true
      }
    });

    // Format response
    const metrics = {
      summary: {
        totalEvidence,
        totalEvaluations,
        pendingEvaluations,
        completionRate,
        recentCompletionRate,
        activeUsers,
        recentUploads,
        recentEvaluations: recentEvaluations24h
      },
      evidence: {
        total: totalEvidence,
        recent: recentEvidence,
        byUploader: evidenceByRole.map(item => ({
          uploaderId: item.uploaderId,
          count: item._count.id,
          uploader: uploaderDetails.find(u => u.id === item.uploaderId)
        })),
        bySubIndicator: evidenceBySubIndicator.map(item => ({
          subIndicatorId: item.subIndicatorId,
          count: item._count.id,
          subIndicator: subIndicatorDetails.find(si => si.id === item.subIndicatorId)
        })),
        byAcademicYear: evidenceByStatus.map(item => ({
          academicYearId: item.academicYearId,
          count: item._count.id,
          academicYear: academicYearDetails.find(ay => ay.id === item.academicYearId)
        }))
      },
      evaluations: {
        total: totalEvaluations,
        recent: recentEvaluations,
        byEvaluator: evaluationsByRole.map(item => ({
          evaluatorId: item.evaluatorId,
          count: item._count.id,
          evaluator: evaluatorDetails.find(e => e.id === item.evaluatorId)
        })),
        byScore: evaluationsByScore.map(item => ({
          score: item.qualitativeScore,
          count: item._count.id
        })).sort((a, b) => (a.score || 0) - (b.score || 0))
      },
      users: {
        active: activeUsers,
        byRole: usersByRole.map(item => ({
          role: item.role,
          count: item._count.role
        }))
      },
      risks: {
        pendingEvaluations,
        unassignedScopes: 0, // TODO: Calculate unassigned scopes
        missedDeadlines: 0, // TODO: Calculate missed deadlines
        inactiveUsers: 0 // TODO: Calculate inactive users
      }
    };

    return NextResponse.json(metrics);

  } catch (error) {
    console.error("Dashboard metrics error:", error);
    return NextResponse.json({ 
      error: "Internal server error" 
    }, { status: 500 });
  }
}