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
    const parentId = searchParams.get("parentId");
    const level = searchParams.get("level");
    const includeAssignments = searchParams.get("includeAssignments") === "true";

    // Get full tree structure
    if (!parentId && !level) {
      const educationLevels = await db.educationLevel.findMany({
        include: {
          standards: {
            include: {
              indicators: {
                include: {
                  subIndicators: includeAssignments ? {
                    include: {
                      owner: {
                        select: {
                          id: true,
                          name: true,
                          email: true,
                          role: true
                        }
                      }
                    }
                  } : true
                }
              }
            }
          }
        },
        orderBy: { code: "asc" }
      });

      return NextResponse.json({
        tree: educationLevels,
        type: "full"
      });
    }

    // Get specific level data for lazy loading
    if (level === "standards" && parentId) {
      const standards = await db.standard.findMany({
        where: { educationLevelId: parentId },
        include: {
          educationLevel: {
            select: { id: true, name: true, code: true }
          }
        },
        orderBy: { code: "asc" }
      });

      return NextResponse.json({
        data: standards,
        type: "standards",
        parentId
      });
    }

    if (level === "indicators" && parentId) {
      const indicators = await db.indicator.findMany({
        where: { standardId: parentId },
        include: {
          standard: {
            select: { id: true, name: true, code: true }
          }
        },
        orderBy: { code: "asc" }
      });

      return NextResponse.json({
        data: indicators,
        type: "indicators",
        parentId
      });
    }

    if (level === "subIndicators" && parentId) {
      const subIndicators = await db.subIndicator.findMany({
        where: { indicatorId: parentId },
        include: {
          indicator: {
            select: { id: true, name: true, code: true }
          },
          owner: includeAssignments ? {
            select: {
              id: true,
              name: true,
              email: true,
              role: true
            }
          } : false
        },
        orderBy: { code: "asc" }
      });

      return NextResponse.json({
        data: subIndicators,
        type: "subIndicators",
        parentId
      });
    }

    return NextResponse.json({ error: "Invalid request parameters" }, { status: 400 });

  } catch (error) {
    console.error("Indicator tree fetch error:", error);
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
    const { type, parentId, data } = body;

    if (!type || !data) {
      return NextResponse.json({ error: "Type and data are required" }, { status: 400 });
    }

    let result;

    switch (type) {
      case "educationLevel":
        result = await db.educationLevel.create({
          data: {
            name: data.name,
            code: data.code
          }
        });
        break;

      case "standard":
        if (!parentId) {
          return NextResponse.json({ error: "Parent ID required for standard" }, { status: 400 });
        }
        result = await db.standard.create({
          data: {
            name: data.name,
            code: data.code,
            educationLevelId: parentId
          },
          include: {
            educationLevel: {
              select: { id: true, name: true, code: true }
            }
          }
        });
        break;

      case "indicator":
        if (!parentId) {
          return NextResponse.json({ error: "Parent ID required for indicator" }, { status: 400 });
        }
        result = await db.indicator.create({
          data: {
            name: data.name,
            code: data.code,
            standardId: parentId
          },
          include: {
            standard: {
              select: { id: true, name: true, code: true }
            }
          }
        });
        break;

      case "subIndicator":
        if (!parentId) {
          return NextResponse.json({ error: "Parent ID required for sub-indicator" }, { status: 400 });
        }
        result = await db.subIndicator.create({
          data: {
            name: data.name,
            code: data.code,
            indicatorId: parentId,
            ownerId: data.ownerId || null
          },
          include: {
            indicator: {
              select: { id: true, name: true, code: true }
            },
            owner: data.ownerId ? {
              select: {
                id: true,
                name: true,
                email: true,
                role: true
              }
            } : false
          }
        });
        break;

      default:
        return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error("Indicator tree creation error:", error);
    
    if (error.code === "P2002") {
      return NextResponse.json({ 
        error: "Code already exists in this context" 
      }, { status: 409 });
    }
    
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
    const { type, id, data } = body;

    if (!type || !id || !data) {
      return NextResponse.json({ error: "Type, ID, and data are required" }, { status: 400 });
    }

    let result;

    switch (type) {
      case "educationLevel":
        result = await db.educationLevel.update({
          where: { id },
          data: {
            name: data.name,
            code: data.code
          }
        });
        break;

      case "standard":
        result = await db.standard.update({
          where: { id },
          data: {
            name: data.name,
            code: data.code
          },
          include: {
            educationLevel: {
              select: { id: true, name: true, code: true }
            }
          }
        });
        break;

      case "indicator":
        result = await db.indicator.update({
          where: { id },
          data: {
            name: data.name,
            code: data.code
          },
          include: {
            standard: {
              select: { id: true, name: true, code: true }
            }
          }
        });
        break;

      case "subIndicator":
        result = await db.subIndicator.update({
          where: { id },
          data: {
            name: data.name,
            code: data.code,
            ownerId: data.ownerId || null
          },
          include: {
            indicator: {
              select: { id: true, name: true, code: true }
            },
            owner: data.ownerId ? {
              select: {
                id: true,
                name: true,
                email: true,
                role: true
              }
            } : false
          }
        });
        break;

      default:
        return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error("Indicator tree update error:", error);
    
    if (error.code === "P2002") {
      return NextResponse.json({ 
        error: "Code already exists in this context" 
      }, { status: 409 });
    }
    
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
    const type = searchParams.get("type");
    const id = searchParams.get("id");

    if (!type || !id) {
      return NextResponse.json({ error: "Type and ID are required" }, { status: 400 });
    }

    // Check if item has children before deleting
    let hasChildren = false;
    
    switch (type) {
      case "educationLevel":
        const standardCount = await db.standard.count({
          where: { educationLevelId: id }
        });
        hasChildren = standardCount > 0;
        break;

      case "standard":
        const indicatorCount = await db.indicator.count({
          where: { standardId: id }
        });
        hasChildren = indicatorCount > 0;
        break;

      case "indicator":
        const subIndicatorCount = await db.subIndicator.count({
          where: { indicatorId: id }
        });
        hasChildren = subIndicatorCount > 0;
        break;

      case "subIndicator":
        const evidenceCount = await db.evidence.count({
          where: { subIndicatorId: id, deletedAt: null }
        });
        hasChildren = evidenceCount > 0;
        break;
    }

    if (hasChildren) {
      return NextResponse.json({ 
        error: "Cannot delete item with children. Please remove all children first." 
      }, { status: 400 });
    }

    // Perform deletion
    switch (type) {
      case "educationLevel":
        await db.educationLevel.delete({ where: { id } });
        break;
      case "standard":
        await db.standard.delete({ where: { id } });
        break;
      case "indicator":
        await db.indicator.delete({ where: { id } });
        break;
      case "subIndicator":
        await db.subIndicator.delete({ where: { id } });
        break;
      default:
        return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Indicator tree deletion error:", error);
    return NextResponse.json({ 
      error: "Internal server error" 
    }, { status: 500 });
  }
}