import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { UserRole } from "@/lib/user-role";
import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const PasswordResetSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
  sendNotification: z.boolean().default(true)
});

const GeneratePasswordSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  length: z.number().min(8).max(32).default(12)
});

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
    const validatedData = PasswordResetSchema.parse(body);

    // Check if target user exists
    const targetUser = await db.user.findFirst({
      where: {
        id: validatedData.userId,
        deletedAt: null
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true
      }
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Cannot reset own password through this endpoint
    if (targetUser.id === session.user.id) {
      return NextResponse.json({ 
        error: "Cannot reset your own password through this endpoint" 
      }, { status: 400 });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(validatedData.newPassword, 12);

    // Update user password
    await db.user.update({
      where: { id: validatedData.userId },
      data: {
        password: hashedPassword,
        // Force user to change password on next login
        mustChangePassword: true
      }
    });

    // Log the password reset action
    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: "PASSWORD_RESET",
        resourceType: "USER",
        resourceId: validatedData.userId,
        details: {
          targetUser: targetUser.email,
          resetBy: session.user.email,
          timestamp: new Date().toISOString()
        }
      }
    }).catch(error => {
      // Audit log is optional, don't fail the request if it fails
      console.error("Failed to create audit log:", error);
    });

    // TODO: Send notification email if requested
    if (validatedData.sendNotification) {
      // In a real implementation, you would send an email notification here
      console.log(`Password reset notification should be sent to ${targetUser.email}`);
    }

    return NextResponse.json({
      success: true,
      message: "Password reset successfully",
      user: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email
      }
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: "Validation error", 
        details: error.errors 
      }, { status: 400 });
    }

    console.error("Password reset error:", error);
    return NextResponse.json({ 
      error: "Internal server error" 
    }, { status: 500 });
  }
}

// Generate a random password
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
    const validatedData = GeneratePasswordSchema.parse(body);

    // Check if target user exists
    const targetUser = await db.user.findFirst({
      where: {
        id: validatedData.userId,
        deletedAt: null
      },
      select: {
        id: true,
        name: true,
        email: true
      }
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Generate random password
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < validatedData.length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Update user password
    await db.user.update({
      where: { id: validatedData.userId },
      data: {
        password: hashedPassword,
        mustChangePassword: true
      }
    });

    // Log the password generation action
    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: "PASSWORD_GENERATED",
        resourceType: "USER",
        resourceId: validatedData.userId,
        details: {
          targetUser: targetUser.email,
          generatedBy: session.user.email,
          timestamp: new Date().toISOString()
        }
      }
    }).catch(error => {
      console.error("Failed to create audit log:", error);
    });

    return NextResponse.json({
      success: true,
      message: "Password generated successfully",
      password: password, // Return the plain text password for admin to share
      user: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email
      }
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: "Validation error", 
        details: error.errors 
      }, { status: 400 });
    }

    console.error("Password generation error:", error);
    return NextResponse.json({ 
      error: "Internal server error" 
    }, { status: 500 });
  }
}

// Bulk password reset
export async function PATCH(request: NextRequest) {
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
    const { userIds, newPassword, generateRandom } = body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ error: "User IDs are required" }, { status: 400 });
    }

    if (!generateRandom && (!newPassword || newPassword.length < 6)) {
      return NextResponse.json({ 
        error: "Password must be at least 6 characters" 
      }, { status: 400 });
    }

    // Remove current user from the list
    const filteredUserIds = userIds.filter(id => id !== session.user.id);

    if (filteredUserIds.length === 0) {
      return NextResponse.json({ 
        error: "Cannot reset your own password through this endpoint" 
      }, { status: 400 });
    }

    // Get target users
    const targetUsers = await db.user.findMany({
      where: {
        id: { in: filteredUserIds },
        deletedAt: null
      },
      select: {
        id: true,
        name: true,
        email: true
      }
    });

    if (targetUsers.length === 0) {
      return NextResponse.json({ error: "No valid users found" }, { status: 404 });
    }

    const results = [];

    for (const targetUser of targetUsers) {
      try {
        let password = newPassword;
        
        if (generateRandom) {
          // Generate random password for each user
          const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
          password = "";
          for (let i = 0; i < 12; i++) {
            password += charset.charAt(Math.floor(Math.random() * charset.length));
          }
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        await db.user.update({
          where: { id: targetUser.id },
          data: {
            password: hashedPassword,
            mustChangePassword: true
          }
        });

        results.push({
          success: true,
          user: targetUser,
          password: generateRandom ? password : undefined
        });

        // Log the action
        await db.auditLog.create({
          data: {
            userId: session.user.id,
            action: "BULK_PASSWORD_RESET",
            resourceType: "USER",
            resourceId: targetUser.id,
            details: {
              targetUser: targetUser.email,
              resetBy: session.user.email,
              timestamp: new Date().toISOString()
            }
          }
        }).catch(error => {
          console.error("Failed to create audit log:", error);
        });

      } catch (error) {
        console.error(`Failed to reset password for user ${targetUser.id}:`, error);
        results.push({
          success: false,
          user: targetUser,
          error: "Failed to reset password"
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: true,
      message: `Password reset completed: ${successCount} successful, ${failCount} failed`,
      results,
      summary: {
        total: results.length,
        successful: successCount,
        failed: failCount
      }
    });

  } catch (error) {
    console.error("Bulk password reset error:", error);
    return NextResponse.json({ 
      error: "Internal server error" 
    }, { status: 500 });
  }
}