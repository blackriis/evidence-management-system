import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { UserRole } from "@/lib/user-role";

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
    const limit = parseInt(searchParams.get("limit") || "20");

    // Build activities from recent evidence uploads and evaluations
    const activities: any[] = [];

    // Get recent evidence uploads
    const evidenceFilter: any = {
      deletedAt: null,
      uploadedAt: {
        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
      }
    };

    if (academicYearId) {
      evidenceFilter.academicYearId = academicYearId;
    }

    // Apply role-based filtering
    if (user.role === UserRole.TEACHER) {
      evidenceFilter.uploaderId = user.id;
    } else if (user.role === UserRole.IQA_EVALUATOR) {
      const ownedSubIndicatorIds = user.ownedSubIndicators.map(si => si.id);
      if (ownedSubIndicatorIds.length > 0) {
        evidenceFilter.subIndicatorId = { in: ownedSubIndicatorIds };
      } else {
        evidenceFilter.id = "no-access";
      }
    } else if (user.role === UserRole.EQA_EVALUATOR) {
      const ownedSubIndicatorIds = user.ownedSubIndicators.map(si => si.id);
      if (ownedSubIndicatorIds.length > 0) {
        evidenceFilter.subIndicatorId = { in: ownedSubIndicatorIds };
      }
    }

    // Get recent evidence uploads
    const recentEvidence = await db.evidence.findMany({
      where: evidenceFilter,
      include: {
        uploader: {
          select: {
            id: true,
            name: true,
            role: true
          }
        },
        subIndicator: {
          select: {
            name: true,
            code: true
          }
        }
      },
      orderBy: { uploadedAt: "desc" },
      take: Math.floor(limit * 0.6) // 60% of activities from evidence
    });

    // Add evidence upload activities
    recentEvidence.forEach(evidence => {
      activities.push({
        id: `evidence-${evidence.id}`,
        type: 'evidence_upload' as const,
        title: 'Evidence Uploaded',
        description: `${evidence.originalName} uploaded for ${evidence.subIndicator?.code || 'Unknown'}`,
        timestamp: evidence.uploadedAt.toISOString(),
        user: {
          id: evidence.uploader.id,
          name: evidence.uploader.name,
          role: evidence.uploader.role
        },
        metadata: {
          evidenceId: evidence.id,
          fileName: evidence.originalName,
          subIndicatorCode: evidence.subIndicator?.code
        }
      });
    });

    // Get recent evaluations
    const evaluationFilter: any = {
      evidence: {
        deletedAt: null
      },
      evaluatedAt: {
        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
      }
    };

    if (academicYearId) {
      evaluationFilter.evidence.academicYearId = academicYearId;
    }

    // Apply role-based filtering for evaluations
    if (user.role === UserRole.TEACHER) {
      evaluationFilter.evidence.uploaderId = user.id;
    } else if (user.role === UserRole.IQA_EVALUATOR) {
      const ownedSubIndicatorIds = user.ownedSubIndicators.map(si => si.id);
      if (ownedSubIndicatorIds.length > 0) {
        evaluationFilter.evidence.subIndicatorId = { in: ownedSubIndicatorIds };
      } else {
        evaluationFilter.evidenceId = "no-access";
      }
    } else if (user.role === UserRole.EQA_EVALUATOR) {
      const ownedSubIndicatorIds = user.ownedSubIndicators.map(si => si.id);
      if (ownedSubIndicatorIds.length > 0) {
        evaluationFilter.evidence.subIndicatorId = { in: ownedSubIndicatorIds };
      }
    }

    const recentEvaluations = await db.evaluation.findMany({
      where: evaluationFilter,
      include: {
        evaluator: {
          select: {
            id: true,
            name: true,
            role: true
          }
        },
        evidence: {
          select: {
            id: true,
            originalName: true,
            subIndicator: {
              select: {
                name: true,
                code: true
              }
            }
          }
        }
      },
      orderBy: { evaluatedAt: "desc" },
      take: Math.floor(limit * 0.4) // 40% of activities from evaluations
    });

    // Add evaluation activities
    recentEvaluations.forEach(evaluation => {
      activities.push({
        id: `evaluation-${evaluation.id}`,
        type: 'evaluation_submitted' as const,
        title: 'Evaluation Submitted',
        description: `Evaluation completed for ${evaluation.evidence.originalName}`,
        timestamp: evaluation.evaluatedAt.toISOString(),
        user: {
          id: evaluation.evaluator.id,
          name: evaluation.evaluator.name,
          role: evaluation.evaluator.role
        },
        metadata: {
          evaluationId: evaluation.id,
          evidenceId: evaluation.evidence.id,
          fileName: evaluation.evidence.originalName,
          subIndicatorCode: evaluation.evidence.subIndicator?.code,
          qualitativeScore: evaluation.qualitativeScore,
          quantitativeScore: evaluation.quantitativeScore
        }
      });
    });

    // Sort all activities by timestamp and limit
    const sortedActivities = activities
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);

    return NextResponse.json({
      activities: sortedActivities,
      total: sortedActivities.length
    });

  } catch (error) {
    console.error("Dashboard activities error:", error);
    return NextResponse.json({ 
      error: "Internal server error" 
    }, { status: 500 });
  }
}