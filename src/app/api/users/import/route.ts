import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { UserRole } from "@/lib/user-role";
import { z } from "zod";
import bcrypt from "bcryptjs";
import * as XLSX from "xlsx";

const ImportUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
  role: z.enum([UserRole.TEACHER, UserRole.IQA_EVALUATOR, UserRole.EQA_EVALUATOR, UserRole.EXECUTIVE, UserRole.ADMIN]),
  password: z.string().min(6, "Password must be at least 6 characters").optional(),
  isActive: z.boolean().default(true)
});

interface ImportResult {
  success: boolean;
  processed: number;
  created: number;
  errors: Array<{
    row: number;
    email: string;
    error: string;
  }>;
  duplicates: Array<{
    row: number;
    email: string;
    existingId: string;
  }>;
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

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const skipDuplicates = formData.get("skipDuplicates") === "true";
    const defaultPassword = formData.get("defaultPassword") as string || "password123";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
      "application/vnd.ms-excel", // .xls
      "text/csv" // .csv
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: "Invalid file type. Only Excel (.xlsx, .xls) and CSV files are supported" 
      }, { status: 400 });
    }

    // Parse file
    const buffer = await file.arrayBuffer();
    let workbook: XLSX.WorkBook;
    
    try {
      if (file.type === "text/csv") {
        const csvText = new TextDecoder().decode(buffer);
        workbook = XLSX.read(csvText, { type: "string" });
      } else {
        workbook = XLSX.read(buffer, { type: "array" });
      }
    } catch (error) {
      return NextResponse.json({ 
        error: "Failed to parse file. Please ensure it's a valid Excel or CSV file" 
      }, { status: 400 });
    }

    // Get first worksheet
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    if (jsonData.length === 0) {
      return NextResponse.json({ 
        error: "File is empty or contains no data" 
      }, { status: 400 });
    }

    // Expected columns: name, email, role, password (optional)
    const expectedColumns = ["name", "email", "role"];
    const firstRow = jsonData[0] as any;
    const fileColumns = Object.keys(firstRow).map(k => k.toLowerCase());
    
    const missingColumns = expectedColumns.filter(col => !fileColumns.includes(col));
    if (missingColumns.length > 0) {
      return NextResponse.json({
        error: `Missing required columns: ${missingColumns.join(", ")}. Expected columns: name, email, role, password (optional)`
      }, { status: 400 });
    }

    // Process data
    const result: ImportResult = {
      success: true,
      processed: 0,
      created: 0,
      errors: [],
      duplicates: []
    };

    // Validate all rows first
    const validatedRows: any[] = [];
    
    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i] as any;
      const rowNumber = i + 2; // Excel row number (1-indexed + header row)

      try {
        // Normalize column names
        const normalizedRow = {
          name: row.name || row.Name || "",
          email: row.email || row.Email || "",
          role: row.role || row.Role || "",
          password: row.password || row.Password || defaultPassword,
          isActive: row.isActive !== undefined ? Boolean(row.isActive) : true
        };

        // Skip empty rows
        if (!normalizedRow.name && !normalizedRow.email) {
          continue;
        }

        // Validate role
        if (!Object.values(UserRole).includes(normalizedRow.role as UserRole)) {
          result.errors.push({
            row: rowNumber,
            email: normalizedRow.email,
            error: `Invalid role: ${normalizedRow.role}. Must be one of: ${Object.values(UserRole).join(", ")}`
          });
          continue;
        }

        // Validate data
        const validatedData = ImportUserSchema.parse(normalizedRow);
        
        // Check for duplicates in file
        const duplicateInFile = validatedRows.find(r => r.email === validatedData.email);
        if (duplicateInFile) {
          result.errors.push({
            row: rowNumber,
            email: validatedData.email,
            error: `Duplicate email in file (first occurrence at row ${duplicateInFile.originalRow})`
          });
          continue;
        }

        validatedRows.push({
          ...validatedData,
          originalRow: rowNumber
        });

      } catch (error) {
        if (error instanceof z.ZodError) {
          result.errors.push({
            row: rowNumber,
            email: row.email || "N/A",
            error: error.errors.map(e => `${e.path.join(".")}: ${e.message}`).join(", ")
          });
        } else {
          result.errors.push({
            row: rowNumber,
            email: row.email || "N/A",
            error: "Invalid data format"
          });
        }
      }
    }

    result.processed = validatedRows.length;

    if (result.errors.length > 0 && result.processed === 0) {
      return NextResponse.json({
        ...result,
        success: false,
        message: "No valid rows found to import"
      });
    }

    // Check for existing users
    const emails = validatedRows.map(row => row.email);
    const existingUsers = await db.user.findMany({
      where: {
        email: { in: emails },
        deletedAt: null
      },
      select: { id: true, email: true }
    });

    const existingEmailsMap = new Map(existingUsers.map(u => [u.email, u.id]));

    // Filter out duplicates
    const usersToCreate = validatedRows.filter(row => {
      const existingId = existingEmailsMap.get(row.email);
      if (existingId) {
        result.duplicates.push({
          row: row.originalRow,
          email: row.email,
          existingId
        });
        return false;
      }
      return true;
    });

    if (skipDuplicates) {
      // Remove duplicates from errors (they're now in duplicates array)
      result.errors = result.errors.filter(error => 
        !result.duplicates.some(dup => dup.email === error.email)
      );
    } else if (result.duplicates.length > 0) {
      // Add duplicates to errors if not skipping
      result.duplicates.forEach(dup => {
        result.errors.push({
          row: dup.row,
          email: dup.email,
          error: "User with this email already exists"
        });
      });
    }

    // Create users in batches
    if (usersToCreate.length > 0) {
      try {
        // Hash passwords
        const usersWithHashedPasswords = await Promise.all(
          usersToCreate.map(async (userData) => ({
            name: userData.name,
            email: userData.email,
            password: await bcrypt.hash(userData.password, 12),
            role: userData.role,
            isActive: userData.isActive
          }))
        );

        // Create users
        await db.user.createMany({
          data: usersWithHashedPasswords,
          skipDuplicates: true
        });

        result.created = usersToCreate.length;
      } catch (error) {
        console.error("Batch user creation error:", error);
        return NextResponse.json({
          ...result,
          success: false,
          message: "Failed to create users in database"
        });
      }
    }

    return NextResponse.json({
      ...result,
      message: `Import completed. Created ${result.created} users. ${result.errors.length} errors, ${result.duplicates.length} duplicates.`
    });

  } catch (error) {
    console.error("User import error:", error);
    return NextResponse.json({ 
      error: "Internal server error" 
    }, { status: 500 });
  }
}

// Preview endpoint for validating import data without creating users
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

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Parse file (same logic as POST but without creating users)
    const buffer = await file.arrayBuffer();
    let workbook: XLSX.WorkBook;
    
    try {
      if (file.type === "text/csv") {
        const csvText = new TextDecoder().decode(buffer);
        workbook = XLSX.read(csvText, { type: "string" });
      } else {
        workbook = XLSX.read(buffer, { type: "array" });
      }
    } catch (error) {
      return NextResponse.json({ 
        error: "Failed to parse file" 
      }, { status: 400 });
    }

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    const previewData: any[] = [];
    const errors: any[] = [];

    for (let i = 0; i < Math.min(jsonData.length, 100); i++) { // Preview first 100 rows
      const row = jsonData[i] as any;
      const rowNumber = i + 2;

      try {
        const normalizedRow = {
          name: row.name || row.Name || "",
          email: row.email || row.Email || "",
          role: row.role || row.Role || "",
          password: "***",
          isActive: row.isActive !== undefined ? Boolean(row.isActive) : true
        };

        if (!normalizedRow.name && !normalizedRow.email) {
          continue;
        }

        const validatedData = ImportUserSchema.parse({
          ...normalizedRow,
          password: "password123" // Dummy password for validation
        });

        previewData.push({
          row: rowNumber,
          ...validatedData,
          password: "***" // Hide password in preview
        });

      } catch (error) {
        if (error instanceof z.ZodError) {
          errors.push({
            row: rowNumber,
            email: row.email || "N/A",
            error: error.errors.map(e => `${e.path.join(".")}: ${e.message}`).join(", ")
          });
        }
      }
    }

    // Check for existing users
    const emails = previewData.map(row => row.email);
    const existingUsers = await db.user.findMany({
      where: {
        email: { in: emails },
        deletedAt: null
      },
      select: { email: true }
    });

    const existingEmails = new Set(existingUsers.map(u => u.email));

    return NextResponse.json({
      preview: previewData.map(row => ({
        ...row,
        isDuplicate: existingEmails.has(row.email)
      })),
      errors,
      totalRows: jsonData.length,
      validRows: previewData.length,
      existingUsers: existingUsers.length
    });

  } catch (error) {
    console.error("User import preview error:", error);
    return NextResponse.json({ 
      error: "Internal server error" 
    }, { status: 500 });
  }
}