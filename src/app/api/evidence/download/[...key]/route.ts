import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { storageService } from "@/lib/storage";
import { db } from "@/lib/db";
import { UserRole } from "@prisma/client";

interface Params {
  key: string[];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Reconstruct the full key from the dynamic route segments
    const key = decodeURIComponent(params.key.join('/'));

    // Find the evidence record to verify access permissions
    const evidence = await db.evidence.findFirst({
      where: {
        storageKey: key,
        deletedAt: null,
      },
      include: {
        uploader: true,
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

    if (!evidence) {
      return NextResponse.json({ error: "Evidence not found" }, { status: 404 });
    }

    // Check access permissions
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, isActive: true }
    });

    if (!user?.isActive) {
      return NextResponse.json({ error: "Account not active" }, { status: 403 });
    }

    // Permission checks based on user role
    const canAccess = 
      user.role === UserRole.ADMIN || // Admin can access all files
      evidence.uploaderId === session.user.id || // Uploader can access their own files
      [UserRole.IQA_EVALUATOR, UserRole.EQA_EVALUATOR, UserRole.EXECUTIVE].includes(user.role); // Evaluators and executives can access for evaluation

    if (!canAccess) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    // Get the file from storage
    const fileBuffer = await storageService.getFile(key);
    
    if (!fileBuffer) {
      return NextResponse.json({ error: "File not found in storage" }, { status: 404 });
    }

    // Set appropriate headers for file download
    const headers = new Headers();
    headers.set('Content-Type', evidence.mimeType || 'application/octet-stream');
    headers.set('Content-Length', fileBuffer.length.toString());
    headers.set('Content-Disposition', `attachment; filename="${evidence.originalName}"`);
    headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');

    return new NextResponse(fileBuffer, {
      status: 200,
      headers,
    });

  } catch (error) {
    console.error("Download error:", error);
    return NextResponse.json({ 
      error: "Internal server error during download" 
    }, { status: 500 });
  }
}