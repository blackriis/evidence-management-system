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
      select: { role: true, isActive: true }
    });

    if (!user?.isActive) {
      return NextResponse.json({ error: "Account is inactive" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const academicYearId = searchParams.get("academicYearId");
    const subIndicatorId = searchParams.get("subIndicatorId");
    const uploaderId = searchParams.get("uploaderId");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search");
    const sortBy = searchParams.get("sortBy") || "uploadedAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";

    // Build where clause based on user role and filters
    const where: any = {
      deletedAt: null,
    };

    // Role-based filtering
    if (user.role === UserRole.TEACHER) {
      where.uploaderId = session.user.id;
    } else if (user.role === UserRole.IQA_EVALUATOR) {
      // IQA evaluators can only see current year evidence
      const currentAcademicYear = await db.academicYear.findFirst({
        where: { isActive: true }
      });
      if (currentAcademicYear) {
        where.academicYearId = currentAcademicYear.id;
      }
    } else if (user.role === UserRole.EQA_EVALUATOR) {
      // EQA evaluators can access N to N-3 years
      const currentYear = new Date().getFullYear();
      const academicYears = await db.academicYear.findMany({
        where: {
          startDate: {
            gte: new Date(`${currentYear - 3}-01-01`),
            lte: new Date(`${currentYear + 1}-12-31`)
          }
        },
        select: { id: true }
      });
      where.academicYearId = {
        in: academicYears.map(year => year.id)
      };
    }
    // Admin and Executive can see all evidence

    // Apply additional filters
    if (academicYearId) {
      where.academicYearId = academicYearId;
    }
    if (subIndicatorId) {
      where.subIndicatorId = subIndicatorId;
    }
    if (uploaderId && [UserRole.ADMIN, UserRole.EXECUTIVE].includes(user.role)) {
      where.uploaderId = uploaderId;
    }
    if (search) {
      where.OR = [
        { filename: { contains: search, mode: "insensitive" } },
        { originalName: { contains: search, mode: "insensitive" } },
        { uploader: { name: { contains: search, mode: "insensitive" } } },
        { uploader: { email: { contains: search, mode: "insensitive" } } }
      ];
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Get total count
    const total = await db.evidence.count({ where });

    // Get evidence with related data
    const evidence = await db.evidence.findMany({
      where,
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
      orderBy: {
        [sortBy]: sortOrder as "asc" | "desc"
      },
      skip,
      take: limit
    });

    // Calculate statistics
    const stats = {
      total,
      totalSize: await db.evidence.aggregate({
        where,
        _sum: { fileSize: true }
      }).then(result => result._sum.fileSize || 0),
      byMimeType: await db.evidence.groupBy({
        by: ["mimeType"],
        where,
        _count: { id: true }
      }),
      byAcademicYear: await db.evidence.groupBy({
        by: ["academicYearId"],
        where,
        _count: { id: true }
      })
    };

    return NextResponse.json({
      evidence,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      },
      stats,
      filters: {
        academicYearId,
        subIndicatorId,
        uploaderId,
        search,
        sortBy,
        sortOrder
      }
    });

  } catch (error) {
    console.error("Evidence listing error:", error);
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
    const evidenceId = searchParams.get("id");

    if (!evidenceId) {
      return NextResponse.json({ error: "Evidence ID is required" }, { status: 400 });
    }

    const evidence = await db.evidence.findUnique({
      where: { id: evidenceId },
      select: { uploaderId: true, deletedAt: true }
    });

    if (!evidence) {
      return NextResponse.json({ error: "Evidence not found" }, { status: 404 });
    }

    if (evidence.deletedAt) {
      return NextResponse.json({ error: "Evidence is already deleted" }, { status: 400 });
    }

    // Check permissions
    const canDelete = 
      user.role === UserRole.ADMIN ||
      (user.role === UserRole.TEACHER && evidence.uploaderId === session.user.id);

    if (!canDelete) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    // Soft delete the evidence
    await db.evidence.update({
      where: { id: evidenceId },
      data: { deletedAt: new Date() }
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Evidence deletion error:", error);
    return NextResponse.json({ 
      error: "Internal server error" 
    }, { status: 500 });
  }
}