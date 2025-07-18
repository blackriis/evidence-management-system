import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import bcrypt from "bcryptjs";

const CreateUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum([UserRole.TEACHER, UserRole.IQA_EVALUATOR, UserRole.EQA_EVALUATOR, UserRole.EXECUTIVE, UserRole.ADMIN]),
  isActive: z.boolean().default(true)
});

const UpdateUserSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  email: z.string().email("Valid email is required").optional(),
  password: z.string().min(6, "Password must be at least 6 characters").optional(),
  role: z.enum([UserRole.TEACHER, UserRole.IQA_EVALUATOR, UserRole.EQA_EVALUATOR, UserRole.EXECUTIVE, UserRole.ADMIN]).optional(),
  isActive: z.boolean().optional()
});

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
    const role = searchParams.get("role") as UserRole;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const search = searchParams.get("search");
    const isActive = searchParams.get("isActive");

    // Build where clause
    let where: any = {};

    if (role) {
      where.role = role;
    }

    if (isActive !== null) {
      where.isActive = isActive === "true";
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } }
      ];
    }

    // Only admins can see all users
    if (user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Get total count
    const total = await db.user.count({ where });

    // Get users
    const users = await db.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
        ownedSubIndicators: {
          select: {
            id: true,
            name: true,
            code: true
          }
        },
        _count: {
          select: {
            evidence: true,
            evaluations: true
          }
        }
      },
      orderBy: [
        { isActive: "desc" },
        { name: "asc" }
      ],
      skip,
      take: limit
    });

    return NextResponse.json({
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    });

  } catch (error) {
    console.error("Users fetch error:", error);
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
    const validatedData = CreateUserSchema.parse(body);

    // Check if user already exists
    const existingUser = await db.user.findFirst({
      where: {
        email: validatedData.email,
        deletedAt: null
      }
    });

    if (existingUser) {
      return NextResponse.json({ 
        error: "User with this email already exists" 
      }, { status: 400 });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(validatedData.password, 12);

    // Create user
    const newUser = await db.user.create({
      data: {
        name: validatedData.name,
        email: validatedData.email,
        password: hashedPassword,
        role: validatedData.role,
        isActive: validatedData.isActive
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true
      }
    });

    return NextResponse.json({
      success: true,
      user: newUser,
      message: "User created successfully"
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: "Validation error", 
        details: error.errors 
      }, { status: 400 });
    }

    console.error("User creation error:", error);
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
    const { userId, ...updateData } = body;

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    const validatedData = UpdateUserSchema.parse(updateData);

    // Check if user exists
    const existingUser = await db.user.findFirst({
      where: {
        id: userId,
        deletedAt: null
      }
    });

    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // If email is being updated, check for conflicts
    if (validatedData.email && validatedData.email !== existingUser.email) {
      const emailConflict = await db.user.findFirst({
        where: {
          email: validatedData.email,
          id: { not: userId },
          deletedAt: null
        }
      });

      if (emailConflict) {
        return NextResponse.json({ 
          error: "Email already in use by another user" 
        }, { status: 400 });
      }
    }

    // Hash password if provided
    let updatePayload: any = { ...validatedData };
    if (validatedData.password) {
      updatePayload.password = await bcrypt.hash(validatedData.password, 12);
    }

    // Update user
    const updatedUser = await db.user.update({
      where: { id: userId },
      data: updatePayload,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        updatedAt: true
      }
    });

    return NextResponse.json({
      success: true,
      user: updatedUser,
      message: "User updated successfully"
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: "Validation error", 
        details: error.errors 
      }, { status: 400 });
    }

    console.error("User update error:", error);
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
    const userId = searchParams.get("userId");
    const permanent = searchParams.get("permanent") === "true";

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    // Cannot delete self
    if (userId === session.user.id) {
      return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
    }

    // Check if user exists
    const existingUser = await db.user.findUnique({
      where: { id: userId }
    });

    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (permanent) {
      // Permanent deletion - remove from database
      await db.user.delete({
        where: { id: userId }
      });

      return NextResponse.json({
        success: true,
        message: "User permanently deleted"
      });
    } else {
      // Soft delete - mark as deleted
      await db.user.update({
        where: { id: userId },
        data: {
          deletedAt: new Date(),
          isActive: false
        }
      });

      return NextResponse.json({
        success: true,
        message: "User moved to recycle bin"
      });
    }

  } catch (error) {
    console.error("User deletion error:", error);
    return NextResponse.json({ 
      error: "Internal server error" 
    }, { status: 500 });
  }
}