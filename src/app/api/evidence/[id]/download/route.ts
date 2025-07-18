import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { storageService } from "@/lib/storage";
import { UserRole } from "@prisma/client";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const evidenceId = params.id;

    // Get evidence with related data
    const evidence = await db.evidence.findUnique({
      where: { id: evidenceId },
      include: {
        uploader: true,
        academicYear: true,
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
    });

    if (!evidence || evidence.deletedAt) {
      return NextResponse.json({ error: "Evidence not found" }, { status: 404 });
    }

    // Check access permissions
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, isActive: true }
    });

    if (!user?.isActive) {
      return NextResponse.json({ error: "Account is inactive" }, { status: 403 });
    }

    const canAccess = 
      // Admin can access all
      user.role === UserRole.ADMIN ||
      // Teacher can access their own evidence
      (user.role === UserRole.TEACHER && evidence.uploaderId === session.user.id) ||
      // Evaluators can access evidence in their assigned scope
      [UserRole.IQA_EVALUATOR, UserRole.EQA_EVALUATOR].includes(user.role) ||
      // Executive can access all evidence
      user.role === UserRole.EXECUTIVE;

    if (!canAccess) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    // For EQA evaluators, check historical access (N to N-3 years)
    if (user.role === UserRole.EQA_EVALUATOR) {
      const currentYear = new Date().getFullYear();
      const evidenceYear = evidence.academicYear.startDate.getFullYear();
      
      if (currentYear - evidenceYear > 3) {
        return NextResponse.json({ 
          error: "Access denied: Evidence is older than 3 years" 
        }, { status: 403 });
      }
    }

    // Generate signed download URL
    const downloadUrl = await storageService.getSignedDownloadUrl(evidence.storageKey, 3600); // 1 hour expiry

    // Log the download (for audit trail)
    console.log(`File download: ${evidence.filename} by ${session.user.email} (${user.role})`);

    return NextResponse.json({
      downloadUrl,
      evidence: {
        id: evidence.id,
        filename: evidence.filename,
        originalName: evidence.originalName,
        fileSize: evidence.fileSize,
        mimeType: evidence.mimeType,
        version: evidence.version,
        uploadedAt: evidence.uploadedAt,
        uploader: {
          name: evidence.uploader.name,
          email: evidence.uploader.email
        },
        academicYear: evidence.academicYear.name,
        subIndicator: evidence.subIndicator
      },
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString()
    });

  } catch (error) {
    console.error("Download error:", error);
    return NextResponse.json({ 
      error: "Internal server error during download" 
    }, { status: 500 });
  }
}