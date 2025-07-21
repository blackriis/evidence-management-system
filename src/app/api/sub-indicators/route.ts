import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { UserRole } from "@/lib/user-role";

export async function GET(_request: NextRequest) {
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

    let subIndicators;

    if (user.role === UserRole.ADMIN) {
      // Admin can see all sub-indicators
      subIndicators = await db.subIndicator.findMany({
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
        },
        orderBy: [
          { indicator: { standard: { educationLevel: { code: "asc" } } } },
          { indicator: { standard: { code: "asc" } } },
          { indicator: { code: "asc" } },
          { code: "asc" }
        ]
      });
    } else if (user.role === UserRole.TEACHER) {
      // Teachers can only see sub-indicators they own or are assigned to
      subIndicators = await db.subIndicator.findMany({
        where: {
          OR: [
            { ownerId: session.user.id },
            // Add additional scope-based filtering here when scope assignment is implemented
          ]
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
        },
        orderBy: [
          { indicator: { standard: { educationLevel: { code: "asc" } } } },
          { indicator: { standard: { code: "asc" } } },
          { indicator: { code: "asc" } },
          { code: "asc" }
        ]
      });
    } else {
      // For evaluators and executives, return all sub-indicators for now
      // This will be refined when scope-based access is implemented
      subIndicators = await db.subIndicator.findMany({
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
        },
        orderBy: [
          { indicator: { standard: { educationLevel: { code: "asc" } } } },
          { indicator: { standard: { code: "asc" } } },
          { indicator: { code: "asc" } },
          { code: "asc" }
        ]
      });
    }

    return NextResponse.json(subIndicators);

  } catch (error) {
    console.error("Sub-indicators fetch error:", error);
    return NextResponse.json({ 
      error: "Internal server error" 
    }, { status: 500 });
  }
}