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

    if (!user?.isActive || user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    // Get total counts
    const [totalCount, activeCount, inactiveCount] = await Promise.all([
      db.user.count({ where: { deletedAt: null } }),
      db.user.count({ where: { deletedAt: null, isActive: true } }),
      db.user.count({ where: { deletedAt: null, isActive: false } })
    ]);

    // Get counts by role
    const roleStats = await db.user.groupBy({
      by: ['role'],
      where: { deletedAt: null, isActive: true },
      _count: { role: true }
    });

    const byRole = Object.values(UserRole).reduce((acc, role) => {
      acc[role] = roleStats.find(stat => stat.role === role)?._count.role || 0;
      return acc;
    }, {} as Record<UserRole, number>);

    // Get recently created users (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentlyCreated = await db.user.count({
      where: {
        deletedAt: null,
        createdAt: { gte: sevenDaysAgo }
      }
    });

    return NextResponse.json({
      total: totalCount,
      active: activeCount,
      inactive: inactiveCount,
      byRole,
      recentlyCreated
    });

  } catch (error) {
    console.error("User stats error:", error);
    return NextResponse.json({ 
      error: "Internal server error" 
    }, { status: 500 });
  }
}