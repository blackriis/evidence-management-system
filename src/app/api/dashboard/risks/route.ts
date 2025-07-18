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
    const severity = searchParams.get("severity"); // high, medium, low

    // Build base filters based on user role
    let scopeFilter: any = {};
    
    if (user.role === UserRole.TEACHER) {
      // Teachers can only see risks related to their evidence
      scopeFilter = {
        evidence: {
          some: {
            uploaderId: user.id,
            deletedAt: null
          }
        }
      };
    } else if (user.role === UserRole.IQA_EVALUATOR) {
      // IQA evaluators can see risks in their assigned scopes
      const ownedSubIndicatorIds = user.ownedSubIndicators.map(si => si.id);
      if (ownedSubIndicatorIds.length > 0) {
        scopeFilter = {
          id: { in: ownedSubIndicatorIds }
        };
      } else {
        scopeFilter = { id: "no-access" };
      }
    } else if (user.role === UserRole.EQA_EVALUATOR) {
      // EQA evaluators can see risks in their assigned scopes
      const ownedSubIndicatorIds = user.ownedSubIndicators.map(si => si.id);
      if (ownedSubIndicatorIds.length > 0) {
        scopeFilter = {
          id: { in: ownedSubIndicatorIds }
        };
      }
    }
    // ADMIN and EXECUTIVE can see all risks (no additional filters)

    // 1. Unassigned Sub-Indicators (no owner)
    const unassignedSubIndicators = await db.subIndicator.findMany({
      where: {
        ownerId: null,
        deletedAt: null,
        ...scopeFilter
      },
      include: {
        indicator: {
          include: {
            standard: {
              include: {
                educationLevel: true
              }
            }
          }
        },
        _count: {
          select: {
            evidence: {
              where: {
                deletedAt: null,
                ...(academicYearId && { academicYearId })
              }
            }
          }
        }
      }
    });

    // 2. Evidence without evaluations (older than 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const unevaluatedEvidence = await db.evidence.findMany({
      where: {
        deletedAt: null,
        uploadedAt: { lte: sevenDaysAgo },
        evaluations: { none: {} },
        ...(academicYearId && { academicYearId }),
        academicYear: {
          evaluationWindowOpen: true
        }
      },
      include: {
        uploader: {
          select: {
            id: true,
            name: true,
            role: true
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
        academicYear: {
          select: {
            id: true,
            name: true,
            evaluationWindowOpen: true
          }
        }
      },
      orderBy: { uploadedAt: "asc" },
      take: 50
    });

    // 3. Evidence with only partial evaluations (missing IQA or EQA)
    const partiallyEvaluatedEvidence = await db.evidence.findMany({
      where: {
        deletedAt: null,
        ...(academicYearId && { academicYearId }),
        academicYear: {
          evaluationWindowOpen: true
        },
        OR: [
          // Has IQA but no EQA
          {
            evaluations: {
              some: {
                evaluator: {
                  role: UserRole.IQA_EVALUATOR
                }
              },
              none: {
                evaluator: {
                  role: UserRole.EQA_EVALUATOR
                }
              }
            }
          },
          // Has EQA but no IQA
          {
            evaluations: {
              some: {
                evaluator: {
                  role: UserRole.EQA_EVALUATOR
                }
              },
              none: {
                evaluator: {
                  role: UserRole.IQA_EVALUATOR
                }
              }
            }
          }
        ]
      },
      include: {
        uploader: {
          select: {
            id: true,
            name: true,
            role: true
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
        academicYear: {
          select: {
            id: true,
            name: true,
            evaluationWindowOpen: true
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
      take: 50
    });

    // 4. Inactive users with assigned scopes
    const inactiveUsersWithScopes = await db.user.findMany({
      where: {
        isActive: false,
        deletedAt: null,
        ownedSubIndicators: {
          some: {
            deletedAt: null
          }
        }
      },
      include: {
        ownedSubIndicators: {
          where: {
            deletedAt: null
          },
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
    });

    // 5. Academic years with evaluation windows closing soon
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const academicYearsClosingSoon = await db.academicYear.findMany({
      where: {
        evaluationWindowOpen: true,
        endDate: {
          lte: thirtyDaysFromNow,
          gte: new Date()
        }
      },
      include: {
        _count: {
          select: {
            evidence: {
              where: {
                deletedAt: null,
                evaluations: { none: {} }
              }
            }
          }
        }
      }
    });

    // 6. Sub-indicators with low evidence submission rates
    const subIndicatorsWithLowEvidence = await db.subIndicator.findMany({
      where: {
        deletedAt: null,
        ...scopeFilter
      },
      include: {
        indicator: {
          include: {
            standard: {
              include: {
                educationLevel: true
              }
            }
          }
        },
        owner: {
          select: {
            id: true,
            name: true,
            role: true
          }
        },
        _count: {
          select: {
            evidence: {
              where: {
                deletedAt: null,
                ...(academicYearId && { academicYearId })
              }
            }
          }
        }
      }
    });

    // Filter sub-indicators with very low evidence counts (< 3)
    const lowEvidenceSubIndicators = subIndicatorsWithLowEvidence.filter(
      si => si._count.evidence < 3
    );

    // Calculate risk scores and categorize
    const risks = [
      // High severity risks
      ...unassignedSubIndicators.map(si => ({
        id: `unassigned-${si.id}`,
        type: "unassigned_scope",
        severity: "high" as const,
        title: `Unassigned Sub-Indicator: ${si.code}`,
        description: `${si.name} has no assigned owner and ${si._count.evidence} evidence files`,
        subIndicator: si,
        createdAt: new Date(),
        affectedCount: si._count.evidence
      })),
      
      ...inactiveUsersWithScopes.map(user => ({
        id: `inactive-user-${user.id}`,
        type: "inactive_user_with_scopes",
        severity: "high" as const,
        title: `Inactive User with Assigned Scopes: ${user.name}`,
        description: `User is inactive but owns ${user.ownedSubIndicators.length} sub-indicators`,
        user: user,
        createdAt: new Date(),
        affectedCount: user.ownedSubIndicators.length
      })),
      
      // Medium severity risks
      ...unevaluatedEvidence.slice(0, 20).map(evidence => ({
        id: `unevaluated-${evidence.id}`,
        type: "unevaluated_evidence",
        severity: "medium" as const,
        title: `Unevaluated Evidence: ${evidence.originalName}`,
        description: `Evidence uploaded ${Math.floor((Date.now() - evidence.uploadedAt.getTime()) / (1000 * 60 * 60 * 24))} days ago without evaluation`,
        evidence: evidence,
        createdAt: new Date(),
        affectedCount: 1
      })),
      
      ...partiallyEvaluatedEvidence.slice(0, 15).map(evidence => {
        const hasIQA = evidence.evaluations.some(e => e.evaluator.role === UserRole.IQA_EVALUATOR);
        const hasEQA = evidence.evaluations.some(e => e.evaluator.role === UserRole.EQA_EVALUATOR);
        
        return {
          id: `partial-${evidence.id}`,
          type: "partial_evaluation",
          severity: "medium" as const,
          title: `Partial Evaluation: ${evidence.originalName}`,
          description: `Evidence has ${hasIQA ? 'IQA' : 'EQA'} evaluation but missing ${hasIQA ? 'EQA' : 'IQA'} evaluation`,
          evidence: evidence,
          createdAt: new Date(),
          affectedCount: 1
        };
      }),
      
      ...academicYearsClosingSoon.map(ay => ({
        id: `closing-${ay.id}`,
        type: "evaluation_window_closing",
        severity: "medium" as const,
        title: `Evaluation Window Closing: ${ay.name}`,
        description: `Evaluation window closes on ${ay.endDate.toLocaleDateString()} with ${ay._count.evidence} unevaluated evidence files`,
        academicYear: ay,
        createdAt: new Date(),
        affectedCount: ay._count.evidence
      })),
      
      // Low severity risks
      ...lowEvidenceSubIndicators.slice(0, 10).map(si => ({
        id: `low-evidence-${si.id}`,
        type: "low_evidence_submission",
        severity: "low" as const,
        title: `Low Evidence Submission: ${si.code}`,
        description: `Only ${si._count.evidence} evidence files submitted for this sub-indicator`,
        subIndicator: si,
        createdAt: new Date(),
        affectedCount: si._count.evidence
      }))
    ];

    // Apply severity filter if specified
    const filteredRisks = severity ? 
      risks.filter(risk => risk.severity === severity) : 
      risks;

    // Sort by severity (high, medium, low) and then by affected count
    const severityOrder = { high: 3, medium: 2, low: 1 };
    const sortedRisks = filteredRisks.sort((a, b) => {
      const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
      if (severityDiff !== 0) return severityDiff;
      return b.affectedCount - a.affectedCount;
    });

    // Calculate summary statistics
    const summary = {
      total: risks.length,
      high: risks.filter(r => r.severity === "high").length,
      medium: risks.filter(r => r.severity === "medium").length,
      low: risks.filter(r => r.severity === "low").length,
      byType: {
        unassigned_scope: risks.filter(r => r.type === "unassigned_scope").length,
        unevaluated_evidence: risks.filter(r => r.type === "unevaluated_evidence").length,
        partial_evaluation: risks.filter(r => r.type === "partial_evaluation").length,
        inactive_user_with_scopes: risks.filter(r => r.type === "inactive_user_with_scopes").length,
        evaluation_window_closing: risks.filter(r => r.type === "evaluation_window_closing").length,
        low_evidence_submission: risks.filter(r => r.type === "low_evidence_submission").length
      }
    };

    return NextResponse.json({
      summary,
      risks: sortedRisks.slice(0, 100), // Limit to 100 risks
      generatedAt: new Date()
    });

  } catch (error) {
    console.error("Dashboard risks error:", error);
    return NextResponse.json({ 
      error: "Internal server error" 
    }, { status: 500 });
  }
}