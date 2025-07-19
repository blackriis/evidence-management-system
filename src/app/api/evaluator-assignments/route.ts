import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { UserRole } from "@prisma/client";

// We'll extend the database schema to include evaluator assignments
// For now, we'll use a junction table approach through evidence assignments

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

    // Only admins can view assignments
    if (user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const evaluatorId = searchParams.get("evaluatorId");
    const academicYearId = searchParams.get("academicYearId");
    const subIndicatorId = searchParams.get("subIndicatorId");
    const evaluatorType = searchParams.get("evaluatorType") as "IQA" | "EQA" | null;

    // Get all evaluators
    const evaluators = await db.user.findMany({
      where: {
        role: evaluatorType ? 
          (evaluatorType === "IQA" ? UserRole.IQA_EVALUATOR : UserRole.EQA_EVALUATOR) :
          { in: [UserRole.IQA_EVALUATOR, UserRole.EQA_EVALUATOR] },
        isActive: true
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true
      },
      orderBy: { name: "asc" }
    });

    // Get evaluation assignments (who has evaluated what)
    const evaluationFilter: any = {};
    
    if (evaluatorId) {
      evaluationFilter.evaluatorId = evaluatorId;
    }
    
    if (academicYearId || subIndicatorId) {
      evaluationFilter.evidence = {};
      if (academicYearId) {
        evaluationFilter.evidence.academicYearId = academicYearId;
      }
      if (subIndicatorId) {
        evaluationFilter.evidence.subIndicatorId = subIndicatorId;
      }
      evaluationFilter.evidence.deletedAt = null;
    } else {
      evaluationFilter.evidence = { deletedAt: null };
    }

    const evaluations = await db.evaluation.findMany({
      where: evaluationFilter,
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
          include: {
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
        }
      },
      orderBy: { evaluatedAt: "desc" }
    });

    // Group evaluations by evaluator
    const assignmentsByEvaluator = evaluations.reduce((acc, evaluation) => {
      const evaluatorId = evaluation.evaluator.id;
      if (!acc[evaluatorId]) {
        acc[evaluatorId] = {
          evaluator: evaluation.evaluator,
          evaluations: []
        };
      }
      acc[evaluatorId].evaluations.push(evaluation);
      return acc;
    }, {} as Record<string, any>);

    // Get evidence that needs evaluation (has no evaluations yet)
    const allEvidence = await db.evidence.findMany({
      where: {
        deletedAt: null,
        ...(academicYearId && { academicYearId }),
        ...(subIndicatorId && { subIndicatorId })
      },
      include: {
        academicYear: {
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
            evaluationWindowOpen: true
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
        },
        evaluations: {
          include: {
            evaluator: {
              select: {
                id: true,
                name: true,
                role: true
              }
            }
          }
        }
      },
      orderBy: { uploadedAt: "desc" }
    });

    // Filter evidence that needs evaluation
    const evidenceNeedingEvaluation = allEvidence.filter(evidence => {
      // Check if evaluation window is open
      if (!evidence.academicYear.evaluationWindowOpen) return false;
      
      // For IQA evaluators - evidence needs IQA evaluation
      const hasIQAEvaluation = evidence.evaluations.some(evaluation => 
        evaluation.evaluator.role === UserRole.IQA_EVALUATOR
      );
      
      // For EQA evaluators - evidence needs EQA evaluation (usually after IQA)
      const hasEQAEvaluation = evidence.evaluations.some(evaluation => 
        evaluation.evaluator.role === UserRole.EQA_EVALUATOR
      );

      if (evaluatorType === "IQA") {
        return !hasIQAEvaluation;
      } else if (evaluatorType === "EQA") {
        return !hasEQAEvaluation; // EQA can evaluate regardless of IQA status
      } else {
        return !hasIQAEvaluation || !hasEQAEvaluation;
      }
    });

    // Calculate statistics
    const stats = {
      totalEvaluators: evaluators.length,
      iqaEvaluators: evaluators.filter(e => e.role === UserRole.IQA_EVALUATOR).length,
      eqaEvaluators: evaluators.filter(e => e.role === UserRole.EQA_EVALUATOR).length,
      totalEvaluations: evaluations.length,
      evidenceNeedingEvaluation: evidenceNeedingEvaluation.length,
      evaluationsByType: {
        IQA: evaluations.filter(e => e.evaluator.role === UserRole.IQA_EVALUATOR).length,
        EQA: evaluations.filter(e => e.evaluator.role === UserRole.EQA_EVALUATOR).length
      }
    };

    return NextResponse.json({
      evaluators,
      assignmentsByEvaluator: Object.values(assignmentsByEvaluator),
      evidenceNeedingEvaluation,
      allEvidence,
      stats
    });

  } catch (error) {
    console.error("Evaluator assignments fetch error:", error);
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

    if (!user?.isActive || user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const body = await request.json();
    const { action, evaluatorIds, evidenceIds, academicYearId, subIndicatorId } = body;

    if (!action || !evaluatorIds || !Array.isArray(evaluatorIds)) {
      return NextResponse.json({ error: "Action and evaluator IDs are required" }, { status: 400 });
    }

    // Validate evaluators exist and have correct roles
    const evaluators = await db.user.findMany({
      where: {
        id: { in: evaluatorIds },
        role: { in: [UserRole.IQA_EVALUATOR, UserRole.EQA_EVALUATOR] },
        isActive: true
      },
      select: { id: true, name: true, role: true }
    });

    if (evaluators.length !== evaluatorIds.length) {
      return NextResponse.json({ error: "Some evaluators not found or invalid" }, { status: 404 });
    }

    let targetEvidence: string[] = [];

    if (evidenceIds && Array.isArray(evidenceIds)) {
      // Specific evidence assignment
      targetEvidence = evidenceIds;
    } else {
      // Bulk assignment by academic year or sub-indicator
      const evidenceFilter: any = { deletedAt: null };
      
      if (academicYearId) {
        evidenceFilter.academicYearId = academicYearId;
      }
      
      if (subIndicatorId) {
        evidenceFilter.subIndicatorId = subIndicatorId;
      }

      const evidence = await db.evidence.findMany({
        where: evidenceFilter,
        select: { id: true }
      });

      targetEvidence = evidence.map(e => e.id);
    }

    if (targetEvidence.length === 0) {
      return NextResponse.json({ error: "No evidence found for assignment" }, { status: 400 });
    }

    let result;

    switch (action) {
      case "notify":
        // Send notification to evaluators about new evidence to evaluate
        // For now, we'll just log this action
        console.log(`Notifying evaluators ${evaluatorIds.join(', ')} about ${targetEvidence.length} evidence files`);
        
        result = {
          action: "notified",
          evaluators: evaluators.length,
          evidence: targetEvidence.length,
          message: `Notified ${evaluators.length} evaluators about ${targetEvidence.length} evidence files`
        };
        break;

      case "auto_assign_iqa":
        // Auto-assign evidence to IQA evaluators in round-robin fashion
        const iqaEvaluators = evaluators.filter(e => e.role === UserRole.IQA_EVALUATOR);
        
        if (iqaEvaluators.length === 0) {
          return NextResponse.json({ error: "No IQA evaluators selected" }, { status: 400 });
        }

        // For now, we'll create a system to track assignments
        // In a real implementation, you might want a separate assignments table
        let iqaAssignments = 0;
        
        for (let i = 0; i < targetEvidence.length; i++) {
          const evaluator = iqaEvaluators[i % iqaEvaluators.length];
          // Log assignment - in production, store in assignments table
          console.log(`Assigned evidence ${targetEvidence[i]} to IQA evaluator ${evaluator.name}`);
          iqaAssignments++;
        }

        result = {
          action: "auto_assigned_iqa",
          assignments: iqaAssignments,
          evaluators: iqaEvaluators.length,
          evidence: targetEvidence.length
        };
        break;

      case "auto_assign_eqa":
        // Auto-assign evidence to EQA evaluators
        const eqaEvaluators = evaluators.filter(e => e.role === UserRole.EQA_EVALUATOR);
        
        if (eqaEvaluators.length === 0) {
          return NextResponse.json({ error: "No EQA evaluators selected" }, { status: 400 });
        }

        let eqaAssignments = 0;
        
        for (let i = 0; i < targetEvidence.length; i++) {
          const evaluator = eqaEvaluators[i % eqaEvaluators.length];
          console.log(`Assigned evidence ${targetEvidence[i]} to EQA evaluator ${evaluator.name}`);
          eqaAssignments++;
        }

        result = {
          action: "auto_assigned_eqa",
          assignments: eqaAssignments,
          evaluators: eqaEvaluators.length,
          evidence: targetEvidence.length
        };
        break;

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      result
    });

  } catch (error) {
    console.error("Evaluator assignment error:", error);
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

    if (!user?.isActive || user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const evaluatorId = searchParams.get("evaluatorId");
    const evidenceId = searchParams.get("evidenceId");
    const academicYearId = searchParams.get("academicYearId");

    if (!evaluatorId) {
      return NextResponse.json({ error: "Evaluator ID is required" }, { status: 400 });
    }

    // Remove evaluations (this is a destructive action)
    const deleteFilter: any = { evaluatorId };

    if (evidenceId) {
      deleteFilter.evidenceId = evidenceId;
    } else if (academicYearId) {
      deleteFilter.evidence = {
        academicYearId,
        deletedAt: null
      };
    }

    const deletedEvaluations = await db.evaluation.deleteMany({
      where: deleteFilter
    });

    return NextResponse.json({
      success: true,
      deletedCount: deletedEvaluations.count,
      message: `Removed ${deletedEvaluations.count} evaluations from evaluator`
    });

  } catch (error) {
    console.error("Evaluator assignment deletion error:", error);
    return NextResponse.json({ 
      error: "Internal server error" 
    }, { status: 500 });
  }
}