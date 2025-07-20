import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    // Test database connection
    await prisma.$connect();
    
    // Try a simple query
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    
    await prisma.$disconnect();
    
    return NextResponse.json({
      status: 'success',
      message: 'Database connection successful',
      result,
      databaseUrl: process.env.DATABASE_URL?.replace(/:[^:@]*@/, ':***@') // Hide password
    });
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      message: 'Database connection failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      databaseUrl: process.env.DATABASE_URL?.replace(/:[^:@]*@/, ':***@') // Hide password
    }, { status: 500 });
  }
}