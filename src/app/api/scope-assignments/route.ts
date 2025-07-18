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
    const userId = searchParams.get("userId");
    const subIndicatorId = searchParams.get("subIndicatorId");

    // Get assignments for specific user
    if (userId) {
      const assignments = await db.subIndicator.findMany({
        where: { ownerId: userId },
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
              email: true,
              role: true
            }
          }
        },
        orderBy: [
          { indicator: { standard: { educationLevel: { code: "asc" } } } },
          { indicator: { standard: { code: "asc" } } },
          { indicator: { code: "asc" } },
          { code: "asc" }
        ]
      });

      return NextResponse.json({
        assignments,
        userId
      });
    }

    // Get assignment for specific sub-indicator
    if (subIndicatorId) {
      const assignment = await db.subIndicator.findUnique({
        where: { id: subIndicatorId },
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true
            }
          },
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
      });

      if (!assignment) {
        return NextResponse.json({ error: "Sub-indicator not found" }, { status: 404 });
      }

      return NextResponse.json({
        assignment,
        subIndicatorId
      });
    }

    // Get all assignments overview
    const assignments = await db.subIndicator.findMany({
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        },
        indicator: {
          include: {
            standard: {
              include: {
                educationLevel: true
              }
            }
          }
        }
      },
      orderBy: [
        { indicator: { standard: { educationLevel: { code: "asc" } } } },
        { indicator: { standard: { code: "asc" } } },
        { indicator: { code: "asc" } },
        { code: "asc" }
      ]
    });

    // Group assignments by user
    const assignmentsByUser = assignments.reduce((acc, assignment) => {
      if (assignment.owner) {
        if (!acc[assignment.owner.id]) {
          acc[assignment.owner.id] = {
            user: assignment.owner,
            assignments: []
          };
        }
        acc[assignment.owner.id].assignments.push(assignment);
      }
      return acc;
    }, {} as Record<string, any>);

    // Get unassigned sub-indicators
    const unassigned = assignments.filter(a => !a.owner);

    return NextResponse.json({
      assignmentsByUser: Object.values(assignmentsByUser),
      unassigned,
      totalCount: assignments.length,
      assignedCount: assignments.filter(a => a.owner).length,
      unassignedCount: unassigned.length
    });

  } catch (error) {
    console.error("Scope assignments fetch error:", error);
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
    const { subIndicatorIds, userId } = body;

    if (!subIndicatorIds || !Array.isArray(subIndicatorIds)) {
      return NextResponse.json({ error: "Sub-indicator IDs array is required" }, { status: 400 });
    }

    // Validate user exists and is a teacher
    if (userId) {
      const targetUser = await db.user.findUnique({
        where: { id: userId },
        select: { role: true, isActive: true }
      });

      if (!targetUser) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      if (!targetUser.isActive) {
        return NextResponse.json({ error: "User is inactive" }, { status: 400 });
      }

      if (targetUser.role !== UserRole.TEACHER) {
        return NextResponse.json({ error: "Only teachers can be assigned to sub-indicators" }, { status: 400 });
      }
    }

    // Validate sub-indicators exist
    const subIndicators = await db.subIndicator.findMany({
      where: { id: { in: subIndicatorIds } },
      select: { id: true }
    });

    if (subIndicators.length !== subIndicatorIds.length) {
      return NextResponse.json({ error: "Some sub-indicators not found" }, { status: 404 });
    }

    // Bulk update assignments
    const result = await db.subIndicator.updateMany({
      where: { id: { in: subIndicatorIds } },
      data: { ownerId: userId || null }
    });

    return NextResponse.json({
      success: true,
      updatedCount: result.count,
      action: userId ? "assigned" : "unassigned"
    });

  } catch (error) {
    console.error("Scope assignment creation error:", error);
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

    if (!user?.isActive || user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const body = await request.json();
    const { subIndicatorId, userId } = body;

    if (!subIndicatorId) {
      return NextResponse.json({ error: "Sub-indicator ID is required" }, { status: 400 });
    }

    // Validate user if provided
    if (userId) {
      const targetUser = await db.user.findUnique({
        where: { id: userId },
        select: { role: true, isActive: true }
      });

      if (!targetUser) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      if (!targetUser.isActive) {
        return NextResponse.json({ error: "User is inactive" }, { status: 400 });
      }

      if (targetUser.role !== UserRole.TEACHER) {
        return NextResponse.json({ error: "Only teachers can be assigned to sub-indicators" }, { status: 400 });
      }
    }

    // Update assignment
    const result = await db.subIndicator.update({
      where: { id: subIndicatorId },
      data: { ownerId: userId || null },
      include: {
        owner: userId ? {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        } : false,
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
    });

    return NextResponse.json({
      success: true,
      assignment: result,
      action: userId ? "assigned" : "unassigned"
    });

  } catch (error) {
    console.error("Scope assignment update error:", error);
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
    const subIndicatorId = searchParams.get("subIndicatorId");
    const userId = searchParams.get("userId");

    if (subIndicatorId) {
      // Remove assignment from specific sub-indicator
      await db.subIndicator.update({
        where: { id: subIndicatorId },
        data: { ownerId: null }
      });

      return NextResponse.json({
        success: true,
        action: "unassigned",
        subIndicatorId
      });
    }

    if (userId) {
      // Remove all assignments from user
      const result = await db.subIndicator.updateMany({
        where: { ownerId: userId },
        data: { ownerId: null }
      });

      return NextResponse.json({
        success: true,
        action: "unassigned_all",
        userId,
        count: result.count
      });
    }

    return NextResponse.json({ error: "Either subIndicatorId or userId is required" }, { status: 400 });

  } catch (error) {
    console.error("Scope assignment deletion error:", error);
    return NextResponse.json({ 
      error: "Internal server error" 
    }, { status: 500 });
  }
}