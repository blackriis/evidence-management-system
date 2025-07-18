import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { UserRole } from "@prisma/client";
import * as XLSX from "xlsx";

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

    // Only admin, executive, and evaluators can export
    const canExport = [UserRole.ADMIN, UserRole.EXECUTIVE, UserRole.IQA_EVALUATOR, UserRole.EQA_EVALUATOR].includes(user.role);
    if (!canExport) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const academicYearId = searchParams.get("academicYearId");
    const timeRange = searchParams.get("timeRange") || "30";
    const format = searchParams.get("format") || "xlsx";
    const includeDetails = searchParams.get("includeDetails") === "true";

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(timeRange));

    // Build filters based on user role
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

    // Apply academic year filter
    if (academicYearId) {
      evidenceFilter.academicYearId = academicYearId;
      evaluationFilter.evidence.academicYearId = academicYearId;
    }

    // Apply role-based filtering
    if (user.role === UserRole.TEACHER) {
      evidenceFilter.uploaderId = user.id;
      evaluationFilter.evidence.uploaderId = user.id;
    } else if (user.role === UserRole.IQA_EVALUATOR) {
      const ownedSubIndicatorIds = user.ownedSubIndicators.map(si => si.id);
      if (ownedSubIndicatorIds.length > 0) {
        evidenceFilter.subIndicatorId = { in: ownedSubIndicatorIds };
        evaluationFilter.evidence.subIndicatorId = { in: ownedSubIndicatorIds };
      } else {
        evidenceFilter.id = "no-access";
        evaluationFilter.evidenceId = "no-access";
      }
    } else if (user.role === UserRole.EQA_EVALUATOR) {
      const ownedSubIndicatorIds = user.ownedSubIndicators.map(si => si.id);
      if (ownedSubIndicatorIds.length > 0) {
        evidenceFilter.subIndicatorId = { in: ownedSubIndicatorIds };
        evaluationFilter.evidence.subIndicatorId = { in: ownedSubIndicatorIds };
      }
    }

    // Fetch data for export
    const [evidence, evaluations, users, academicYear] = await Promise.all([
      db.evidence.findMany({
        where: evidenceFilter,
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
          },
          evaluations: {
            include: {
              evaluator: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  role: true
                }
              }
            }
          }
        },
        orderBy: { uploadedAt: "desc" },
        take: 1000 // Limit for performance
      }),
      
      db.evaluation.findMany({
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
                  name: true
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
        orderBy: { evaluatedAt: "desc" },
        take: 1000
      }),
      
      db.user.findMany({
        where: {
          deletedAt: null,
          isActive: true
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          _count: {
            select: {
              evidence: true,
              evaluations: true
            }
          }
        },
        orderBy: { createdAt: "desc" }
      }),
      
      academicYearId ? db.academicYear.findUnique({
        where: { id: academicYearId },
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true
        }
      }) : null
    ]);

    // Prepare data for Excel export
    const workbook = XLSX.utils.book_new();

    // Summary sheet
    const summaryData = [
      ["Dashboard Export Report"],
      ["Generated on:", new Date().toLocaleString()],
      ["Generated by:", session.user.name],
      ["Time Range:", `${timeRange} days`],
      ["Academic Year:", academicYear?.name || "All"],
      [""],
      ["Summary Statistics"],
      ["Total Evidence:", evidence.length],
      ["Total Evaluations:", evaluations.length],
      ["Total Users:", users.length],
      ["Completion Rate:", evidence.length > 0 ? `${Math.round((evaluations.length / evidence.length) * 100)}%` : "0%"],
      [""],
      ["Evidence by Role"],
      ...Object.entries(
        evidence.reduce((acc, e) => {
          acc[e.uploader.role] = (acc[e.uploader.role] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      ).map(([role, count]) => [role.replace('_', ' '), count]),
      [""],
      ["Evaluations by Role"],
      ...Object.entries(
        evaluations.reduce((acc, e) => {
          acc[e.evaluator.role] = (acc[e.evaluator.role] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      ).map(([role, count]) => [role.replace('_', ' '), count])
    ];

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

    // Evidence sheet
    const evidenceData = [
      [
        "Evidence ID",
        "File Name",
        "Original Name",
        "Upload Date",
        "Uploader",
        "Uploader Role",
        "Academic Year",
        "Education Level",
        "Standard",
        "Indicator",
        "Sub-Indicator",
        "File Size (KB)",
        "Evaluations Count",
        "Latest Evaluation"
      ],
      ...evidence.map(e => [
        e.id,
        e.filename,
        e.originalName,
        e.uploadedAt.toLocaleDateString(),
        e.uploader.name,
        e.uploader.role.replace('_', ' '),
        e.academicYear.name,
        e.subIndicator.indicator.standard.educationLevel.name,
        e.subIndicator.indicator.standard.name,
        e.subIndicator.indicator.name,
        e.subIndicator.name,
        Math.round(e.fileSize / 1024),
        e.evaluations.length,
        e.evaluations.length > 0 ? 
          Math.max(...e.evaluations.map(ev => new Date(ev.evaluatedAt).getTime())) : 
          ""
      ])
    ];

    const evidenceSheet = XLSX.utils.aoa_to_sheet(evidenceData);
    XLSX.utils.book_append_sheet(workbook, evidenceSheet, "Evidence");

    // Evaluations sheet
    const evaluationData = [
      [
        "Evaluation ID",
        "Evidence File",
        "Evaluator",
        "Evaluator Role",
        "Evaluation Date",
        "Qualitative Score",
        "Quantitative Score",
        "Comments",
        "Education Level",
        "Standard",
        "Indicator",
        "Sub-Indicator"
      ],
      ...evaluations.map(e => [
        e.id,
        e.evidence.originalName,
        e.evaluator.name,
        e.evaluator.role.replace('_', ' '),
        e.evaluatedAt.toLocaleDateString(),
        e.qualitativeScore || "",
        e.quantitativeScore || "",
        e.comments || "",
        e.evidence.subIndicator.indicator.standard.educationLevel.name,
        e.evidence.subIndicator.indicator.standard.name,
        e.evidence.subIndicator.indicator.name,
        e.evidence.subIndicator.name
      ])
    ];

    const evaluationSheet = XLSX.utils.aoa_to_sheet(evaluationData);
    XLSX.utils.book_append_sheet(workbook, evaluationSheet, "Evaluations");

    // Users sheet (only for admin/executive)
    if ([UserRole.ADMIN, UserRole.EXECUTIVE].includes(user.role)) {
      const userData = [
        [
          "User ID",
          "Name",
          "Email",
          "Role",
          "Created Date",
          "Evidence Count",
          "Evaluation Count"
        ],
        ...users.map(u => [
          u.id,
          u.name,
          u.email,
          u.role.replace('_', ' '),
          u.createdAt.toLocaleDateString(),
          u._count.evidence,
          u._count.evaluations
        ])
      ];

      const userSheet = XLSX.utils.aoa_to_sheet(userData);
      XLSX.utils.book_append_sheet(workbook, userSheet, "Users");
    }

    // Generate Excel file
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    // Prepare response
    const filename = `dashboard-report-${academicYear?.name || 'all'}-${new Date().toISOString().split('T')[0]}.xlsx`;
    
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`
      }
    });

  } catch (error) {
    console.error("Dashboard export error:", error);
    return NextResponse.json({ 
      error: "Internal server error" 
    }, { status: 500 });
  }
}