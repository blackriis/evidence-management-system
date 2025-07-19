import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { ScopeMiddleware } from "@/lib/scope-middleware";
import { EVALUATION_SCORES } from "@/lib/constants";
import { UserRole } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, isActive: true }
    });

    if (!user?.isActive) {
      return NextResponse.json({ error: "Account is inactive" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const evidenceId = searchParams.get("evidenceId");
    const evaluatorId = searchParams.get("evaluatorId");
    const academicYearId = searchParams.get("academicYearId");
    const subIndicatorId = searchParams.get("subIndicatorId");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const includeEvidence = searchParams.get("includeEvidence") === "true";

    // Build base where clause
    const where: any = {};

    if (evidenceId) {
      where.evidenceId = evidenceId;
    }

    if (evaluatorId) {
      where.evaluatorId = evaluatorId;
    }

    // Apply evidence filters through relationships
    if (academicYearId || subIndicatorId) {
      where.evidence = {};
      if (academicYearId) {
        where.evidence.academicYearId = academicYearId;
      }
      if (subIndicatorId) {
        where.evidence.subIndicatorId = subIndicatorId;
      }
      where.evidence.deletedAt = null;
    } else {
      where.evidence = { deletedAt: null };
    }

    // Apply scope-based filtering
    const scopeContext = {
      userId: session.user.id,
      role: user.role,
      isActive: user.isActive
    };

    // For role-based restrictions, filter evidence through scope middleware
    if ([UserRole.TEACHER, UserRole.IQA_EVALUATOR, UserRole.EQA_EVALUATOR].includes(user.role)) {
      const evidenceFilter = await ScopeMiddleware.applyEvidenceFilter(scopeContext);
      where.evidence = { ...where.evidence, ...evidenceFilter };
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Get total count
    const total = await db.evaluation.count({ where });

    // Get evaluations
    const evaluations = await db.evaluation.findMany({
      where,
      include: {
        evaluator: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        },
        evidence: includeEvidence ? {
          include: {
            uploader: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true
              }
            },
            academicYear: {
              select: {
                id: true,
                name: true,
                startDate: true,
                endDate: true
              }
            },
            subIndicator: {
              include: {
                indicator: {
                  include: {
                    standard: {
                      include: {
                        educationLevel: true
                      }
                    }
                  }
                }
              }
            }
          }
        } : {
          select: {
            id: true,
            filename: true,
            originalName: true,
            fileSize: true,
            mimeType: true,
            uploadedAt: true
          }
        }
      },
      orderBy: { evaluatedAt: "desc" },
      skip,
      take: limit
    });

    // Calculate statistics
    const stats = {
      total,
      averageQualitative: await db.evaluation.aggregate({
        where: { ...where, qualitativeScore: { not: null } },
        _avg: { qualitativeScore: true }
      }).then(result => result._avg.qualitativeScore),
      averageQuantitative: await db.evaluation.aggregate({
        where: { ...where, quantitativeScore: { not: null } },
        _avg: { quantitativeScore: true }
      }).then(result => result._avg.quantitativeScore),
      scoreDistribution: await db.evaluation.groupBy({
        by: ["qualitativeScore"],
        where: { ...where, qualitativeScore: { not: null } },
        _count: { id: true }
      })
    };

    return NextResponse.json({
      evaluations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      },
      stats
    });

  } catch (error) {
    console.error("Evaluations fetch error:", error);
    return NextResponse.json({ 
      error: "Internal server error" 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, isActive: true }
    });

    if (!user?.isActive) {
      return NextResponse.json({ error: "Account is inactive" }, { status: 403 });
    }

    // Check if user can evaluate
    if (![UserRole.IQA_EVALUATOR, UserRole.EQA_EVALUATOR, UserRole.ADMIN].includes(user.role)) {
      return NextResponse.json({ error: "Insufficient permissions to evaluate" }, { status: 403 });
    }

    const body = await request.json();
    const { evidenceId, qualitativeScore, quantitativeScore, comments } = body;

    if (!evidenceId) {
      return NextResponse.json({ error: "Evidence ID is required" }, { status: 400 });
    }

    // Validate scores
    if (qualitativeScore !== null && qualitativeScore !== undefined) {
      if (!Number.isInteger(qualitativeScore) || 
          qualitativeScore < EVALUATION_SCORES.QUALITATIVE_MIN || 
          qualitativeScore > EVALUATION_SCORES.QUALITATIVE_MAX) {
        return NextResponse.json({ 
          error: `Qualitative score must be between ${EVALUATION_SCORES.QUALITATIVE_MIN} and ${EVALUATION_SCORES.QUALITATIVE_MAX}` 
        }, { status: 400 });
      }
    }

    if (quantitativeScore !== null && quantitativeScore !== undefined) {
      if (!Number.isInteger(quantitativeScore) || 
          quantitativeScore < EVALUATION_SCORES.QUANTITATIVE_MIN || 
          quantitativeScore > EVALUATION_SCORES.QUANTITATIVE_MAX) {
        return NextResponse.json({ 
          error: `Quantitative score must be between ${EVALUATION_SCORES.QUANTITATIVE_MIN} and ${EVALUATION_SCORES.QUANTITATIVE_MAX}` 
        }, { status: 400 });
      }
    }

    // At least one score must be provided
    if ((qualitativeScore === null || qualitativeScore === undefined) && 
        (quantitativeScore === null || quantitativeScore === undefined)) {
      return NextResponse.json({ 
        error: "At least one score (qualitative or quantitative) must be provided" 
      }, { status: 400 });
    }

    // Check if evidence exists and user can access it
    const evidence = await db.evidence.findUnique({
      where: { id: evidenceId },
      include: {
        academicYear: true,
        subIndicator: true
      }
    });

    if (!evidence || evidence.deletedAt) {
      return NextResponse.json({ error: "Evidence not found" }, { status: 404 });
    }

    // Check access permissions using scope middleware
    const scopeContext = {
      userId: session.user.id,
      role: user.role,
      isActive: user.isActive
    };

    const canAccess = await ScopeMiddleware.canAccessEvidence(scopeContext, evidenceId);
    if (!canAccess) {
      return NextResponse.json({ error: "Access denied to this evidence" }, { status: 403 });
    }

    // Check evaluation window
    if (!evidence.academicYear.evaluationWindowOpen) {
      return NextResponse.json({ error: "Evaluation window is not open for this academic year" }, { status: 400 });
    }

    // Check if evaluation already exists
    const existingEvaluation = await db.evaluation.findUnique({
      where: {
        evidenceId_evaluatorId: {
          evidenceId,
          evaluatorId: session.user.id
        }
      }
    });

    let evaluation;

    if (existingEvaluation) {
      // Update existing evaluation
      evaluation = await db.evaluation.update({
        where: { id: existingEvaluation.id },
        data: {
          qualitativeScore: qualitativeScore ?? existingEvaluation.qualitativeScore,
          quantitativeScore: quantitativeScore ?? existingEvaluation.quantitativeScore,
          comments: comments ?? existingEvaluation.comments,
          evaluatedAt: new Date()
        },
        include: {
          evaluator: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true
            }
          },
          evidence: {
            select: {
              id: true,
              filename: true,
              originalName: true,
              uploadedAt: true
            }
          }
        }
      });
    } else {
      // Create new evaluation
      evaluation = await db.evaluation.create({
        data: {
          evidenceId,
          evaluatorId: session.user.id,
          qualitativeScore,
          quantitativeScore,
          comments
        },
        include: {
          evaluator: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true
            }
          },
          evidence: {
            select: {
              id: true,
              filename: true,
              originalName: true,
              uploadedAt: true
            }
          }
        }
      });
    }

    return NextResponse.json({
      success: true,
      evaluation,
      action: existingEvaluation ? "updated" : "created"
    });

  } catch (error) {
    console.error("Evaluation creation error:", error);
    return NextResponse.json({ 
      error: "Internal server error" 
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, isActive: true }
    });

    if (!user?.isActive) {
      return NextResponse.json({ error: "Account is inactive" }, { status: 403 });
    }

    const body = await request.json();
    const { id, qualitativeScore, quantitativeScore, comments } = body;

    if (!id) {
      return NextResponse.json({ error: "Evaluation ID is required" }, { status: 400 });
    }

    // Check if evaluation exists and user owns it
    const existingEvaluation = await db.evaluation.findUnique({
      where: { id },
      include: { evidence: { include: { academicYear: true } } }
    });

    if (!existingEvaluation) {
      return NextResponse.json({ error: "Evaluation not found" }, { status: 404 });
    }

    // Check ownership or admin rights
    if (existingEvaluation.evaluatorId !== session.user.id && user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: "Can only edit your own evaluations" }, { status: 403 });
    }

    // Check evaluation window
    if (!existingEvaluation.evidence.academicYear.evaluationWindowOpen) {
      return NextResponse.json({ error: "Evaluation window is not open" }, { status: 400 });
    }

    // Validate scores if provided
    const updateData: any = {};

    if (qualitativeScore !== undefined) {
      if (qualitativeScore !== null) {
        if (!Number.isInteger(qualitativeScore) || 
            qualitativeScore < EVALUATION_SCORES.QUALITATIVE_MIN || 
            qualitativeScore > EVALUATION_SCORES.QUALITATIVE_MAX) {
          return NextResponse.json({ 
            error: `Qualitative score must be between ${EVALUATION_SCORES.QUALITATIVE_MIN} and ${EVALUATION_SCORES.QUALITATIVE_MAX}` 
          }, { status: 400 });
        }
      }
      updateData.qualitativeScore = qualitativeScore;
    }

    if (quantitativeScore !== undefined) {
      if (quantitativeScore !== null) {
        if (!Number.isInteger(quantitativeScore) || 
            quantitativeScore < EVALUATION_SCORES.QUANTITATIVE_MIN || 
            quantitativeScore > EVALUATION_SCORES.QUANTITATIVE_MAX) {
          return NextResponse.json({ 
            error: `Quantitative score must be between ${EVALUATION_SCORES.QUANTITATIVE_MIN} and ${EVALUATION_SCORES.QUANTITATIVE_MAX}` 
          }, { status: 400 });
        }
      }
      updateData.quantitativeScore = quantitativeScore;
    }

    if (comments !== undefined) {
      updateData.comments = comments;
    }

    updateData.evaluatedAt = new Date();

    // Update evaluation
    const evaluation = await db.evaluation.update({
      where: { id },
      data: updateData,
      include: {
        evaluator: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        },
        evidence: {
          select: {
            id: true,
            filename: true,
            originalName: true,
            uploadedAt: true
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      evaluation
    });

  } catch (error) {
    console.error("Evaluation update error:", error);
    return NextResponse.json({ 
      error: "Internal server error" 
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, isActive: true }
    });

    if (!user?.isActive) {
      return NextResponse.json({ error: "Account is inactive" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const evaluationId = searchParams.get("id");

    if (!evaluationId) {
      return NextResponse.json({ error: "Evaluation ID is required" }, { status: 400 });
    }

    // Check if evaluation exists and user owns it
    const evaluation = await db.evaluation.findUnique({
      where: { id: evaluationId },
      include: { evidence: { include: { academicYear: true } } }
    });

    if (!evaluation) {
      return NextResponse.json({ error: "Evaluation not found" }, { status: 404 });
    }

    // Check ownership or admin rights
    if (evaluation.evaluatorId !== session.user.id && user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: "Can only delete your own evaluations" }, { status: 403 });
    }

    // Check evaluation window
    if (!evaluation.evidence.academicYear.evaluationWindowOpen) {
      return NextResponse.json({ error: "Evaluation window is not open" }, { status: 400 });
    }

    // Delete evaluation
    await db.evaluation.delete({
      where: { id: evaluationId }
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Evaluation deletion error:", error);
    return NextResponse.json({ 
      error: "Internal server error" 
    }, { status: 500 });
  }
}