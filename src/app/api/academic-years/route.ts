import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const createAcademicYearSchema = z.object({
  name: z.string().min(1, "Name is required"),
  startDate: z.string().datetime("Invalid start date"),
  endDate: z.string().datetime("Invalid end date"),
  uploadWindowOpen: z.boolean().optional().default(false),
  evaluationWindowOpen: z.boolean().optional().default(false),
});

const updateAcademicYearSchema = createAcademicYearSchema.partial();

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get("includeInactive") === "true";
    const userRole = session.user.role;

    // For EQA evaluators, only show years N to N-3
    const whereClause: any = {};
    
    if (userRole === "EQA_EVALUATOR") {
      const currentYear = new Date().getFullYear();
      const threeYearsAgo = new Date(`${currentYear - 3}-01-01`);
      whereClause.startDate = {
        gte: threeYearsAgo
      };
    }

    if (!includeInactive) {
      whereClause.isActive = true;
    }

    const academicYears = await db.academicYear.findMany({
      where: whereClause,
      orderBy: { startDate: "desc" },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        uploadWindowOpen: true,
        evaluationWindowOpen: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            evidence: true
          }
        }
      }
    });

    return NextResponse.json(academicYears);

  } catch (error) {
    console.error("Academic years fetch error:", error);
    return NextResponse.json({ 
      error: "Internal server error" 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = createAcademicYearSchema.parse(body);

    const startDate = new Date(validatedData.startDate);
    const endDate = new Date(validatedData.endDate);

    // Validate date range
    if (startDate >= endDate) {
      return NextResponse.json({ 
        error: "Start date must be before end date" 
      }, { status: 400 });
    }

    // Check for overlapping periods
    const overlapping = await db.academicYear.findFirst({
      where: {
        isActive: true,
        OR: [
          {
            AND: [
              { startDate: { lte: startDate } },
              { endDate: { gte: startDate } }
            ]
          },
          {
            AND: [
              { startDate: { lte: endDate } },
              { endDate: { gte: endDate } }
            ]
          },
          {
            AND: [
              { startDate: { gte: startDate } },
              { endDate: { lte: endDate } }
            ]
          }
        ]
      }
    });

    if (overlapping) {
      return NextResponse.json({ 
        error: "Academic year period overlaps with existing year" 
      }, { status: 409 });
    }

    const academicYear = await db.academicYear.create({
      data: {
        name: validatedData.name,
        startDate,
        endDate,
        uploadWindowOpen: validatedData.uploadWindowOpen,
        evaluationWindowOpen: validatedData.evaluationWindowOpen,
      }
    });

    return NextResponse.json(academicYear, { status: 201 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: "Validation error", 
        details: error.errors 
      }, { status: 400 });
    }

    console.error("Academic year creation error:", error);
    return NextResponse.json({ 
      error: "Internal server error" 
    }, { status: 500 });
  }
}