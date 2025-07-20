import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { storageService } from "@/lib/storage";
import { FileValidator } from "@/lib/file-validation";
import { FILE_UPLOAD_LIMITS } from "@/lib/constants";
import { UserRole } from "@prisma/client";
import { AuditLogger } from "@/lib/audit-logger";
import { withRateLimit, RATE_LIMIT_CONFIGS } from "@/lib/rate-limiter";
import { withSecurityHeaders, withCSRFProtection } from "@/lib/security-headers";
import { InputSanitizer } from "@/lib/input-sanitizer";

const postHandler = async function(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has upload permissions
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, isActive: true }
    });

    if (!user?.isActive || ![UserRole.TEACHER, UserRole.ADMIN].includes(user.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    // Check if upload window is open
    const activeAcademicYear = await db.academicYear.findFirst({
      where: { isActive: true, uploadWindowOpen: true }
    });

    if (!activeAcademicYear) {
      return NextResponse.json({ error: "Upload window is not open" }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const subIndicatorId = formData.get("subIndicatorId") as string;
    const replace = formData.get("replace") === "true";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!subIndicatorId) {
      return NextResponse.json({ error: "Sub-indicator ID is required" }, { status: 400 });
    }

    // Verify sub-indicator exists and user has access
    const subIndicator = await db.subIndicator.findUnique({
      where: { id: subIndicatorId },
      include: { 
        indicator: { 
          include: { 
            standard: { 
              include: { educationLevel: true } 
            } 
          } 
        } 
      }
    });

    if (!subIndicator) {
      return NextResponse.json({ error: "Sub-indicator not found" }, { status: 404 });
    }

    // Check user's quota for this academic year
    const userEvidenceSize = await db.evidence.aggregate({
      where: {
        uploaderId: session.user.id,
        academicYearId: activeAcademicYear.id,
        deletedAt: null
      },
      _sum: { fileSize: true }
    });

    const currentQuotaUsed = userEvidenceSize._sum.fileSize || 0;
    const availableQuota = FILE_UPLOAD_LIMITS.MAX_FILE_SIZE - currentQuotaUsed;

    // Sanitize filename
    const sanitizedFilename = InputSanitizer.sanitizeFilename(file.name);
    
    // Convert file to buffer and validate with enhanced security
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileInfo = {
      name: sanitizedFilename,
      size: file.size,
      type: file.type,
      buffer
    };

    const validationResult = await FileValidator.validateFileWithSecurity(fileInfo);
    
    if (!validationResult.isValid) {
      // Log security violations
      if (validationResult.securityScan && !validationResult.securityScan.isSafe) {
        const context = AuditLogger.extractContext(request, session.user.id);
        await AuditLogger.logSecurity(
          'FILE_UPLOAD_BLOCKED',
          session.user.id,
          {
            filename: sanitizedFilename,
            threats: validationResult.securityScan.threats,
            fileSize: file.size,
            mimeType: file.type,
          },
          context
        );
      }

      return NextResponse.json({ 
        error: "File validation failed", 
        details: validationResult.errors 
      }, { status: 400 });
    }

    if (file.size > availableQuota) {
      return NextResponse.json({ 
        error: `File size exceeds available quota. Available: ${FileValidator.formatFileSize(availableQuota)}` 
      }, { status: 400 });
    }

    // Check if evidence already exists for this sub-indicator
    const existingEvidence = await db.evidence.findFirst({
      where: {
        subIndicatorId,
        academicYearId: activeAcademicYear.id,
        uploaderId: session.user.id,
        deletedAt: null
      },
      orderBy: { version: "desc" }
    });

    if (existingEvidence && !replace) {
      return NextResponse.json({ 
        error: "Evidence already exists for this sub-indicator. Use replace=true to overwrite." 
      }, { status: 409 });
    }

    // Upload file to storage
    const uploadResult = await storageService.uploadFile(buffer, {
      userId: session.user.id,
      academicYearId: activeAcademicYear.id,
      subIndicatorId,
      originalName: file.name,
      contentType: file.type,
      size: file.size
    });

    // Create database record
    const newVersion = existingEvidence ? existingEvidence.version + 1 : 1;
    
    // Mark previous version as not latest
    if (existingEvidence) {
      await db.evidence.update({
        where: { id: existingEvidence.id },
        data: { isLatest: false }
      });
    }

    const evidence = await db.evidence.create({
      data: {
        filename: sanitizedFilename,
        originalName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        uploaderId: session.user.id,
        academicYearId: activeAcademicYear.id,
        subIndicatorId,
        version: newVersion,
        isLatest: true,
        storageKey: uploadResult.key,
      },
      include: {
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

    // Log evidence upload
    const context = AuditLogger.extractContext(request, session.user.id);
    await AuditLogger.logEvidence(
      'UPLOAD',
      evidence.id,
      session.user.id,
      existingEvidence ? {
        previousVersion: existingEvidence.version,
        previousFilename: existingEvidence.filename,
      } : null,
      {
        filename: evidence.filename,
        fileSize: evidence.fileSize,
        mimeType: evidence.mimeType,
        version: evidence.version,
        subIndicatorId: evidence.subIndicatorId,
        academicYearId: evidence.academicYearId,
      },
      context
    );

    const response = NextResponse.json({
      success: true,
      evidence: {
        id: evidence.id,
        filename: evidence.filename,
        fileSize: evidence.fileSize,
        mimeType: evidence.mimeType,
        version: evidence.version,
        uploadedAt: evidence.uploadedAt,
        subIndicator: evidence.subIndicator
      },
      warnings: validationResult.warnings,
      securityWarnings: validationResult.securityScan?.warnings || []
    });

    return response;

  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ 
      error: "Internal server error during upload" 
    }, { status: 500 });
  }
}

const getHandler = async function(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const academicYearId = searchParams.get("academicYearId");
    const subIndicatorId = searchParams.get("subIndicatorId");

    // Get user's quota information
    const currentAcademicYear = academicYearId 
      ? await db.academicYear.findUnique({ where: { id: academicYearId } })
      : await db.academicYear.findFirst({ where: { isActive: true } });

    if (!currentAcademicYear) {
      return NextResponse.json({ error: "Academic year not found" }, { status: 404 });
    }

    const userEvidenceSize = await db.evidence.aggregate({
      where: {
        uploaderId: session.user.id,
        academicYearId: currentAcademicYear.id,
        deletedAt: null
      },
      _sum: { fileSize: true }
    });

    const quotaUsed = userEvidenceSize._sum.fileSize || 0;
    const quotaAvailable = FILE_UPLOAD_LIMITS.MAX_FILE_SIZE - quotaUsed;

    // Get evidence list if subIndicatorId is provided
    let evidence = null;
    if (subIndicatorId) {
      evidence = await db.evidence.findMany({
        where: {
          subIndicatorId,
          academicYearId: currentAcademicYear.id,
          uploaderId: session.user.id,
          deletedAt: null
        },
        orderBy: { version: "desc" },
        include: {
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
    }

    return NextResponse.json({
      quota: {
        used: quotaUsed,
        available: quotaAvailable,
        total: FILE_UPLOAD_LIMITS.MAX_FILE_SIZE,
        usagePercentage: (quotaUsed / FILE_UPLOAD_LIMITS.MAX_FILE_SIZE) * 100
      },
      uploadWindow: {
        isOpen: currentAcademicYear.uploadWindowOpen,
        academicYear: currentAcademicYear.name
      },
      evidence,
      allowedTypes: FILE_UPLOAD_LIMITS.ALLOWED_MIME_TYPES,
      maxFileSize: FILE_UPLOAD_LIMITS.MAX_FILE_SIZE
    });

  } catch (error) {
    console.error("Upload info error:", error);
    return NextResponse.json({ 
      error: "Internal server error" 
    }, { status: 500 });
  }
}

// Apply security middleware to route handlers
export const POST = withSecurityHeaders()(
  withCSRFProtection()(
    withRateLimit(RATE_LIMIT_CONFIGS.UPLOAD)(postHandler)
  )
);

export const GET = withSecurityHeaders()(
  withRateLimit(RATE_LIMIT_CONFIGS.API)(getHandler)
);