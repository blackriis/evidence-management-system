import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Starting database setup...');
    
    // Test database connection
    console.log('📡 Testing database connection...');
    await prisma.$connect();
    console.log('✅ Database connected successfully');
    
    // Push schema
    console.log('🔧 Pushing database schema...');
    // Note: We can't run prisma db push from API route
    // This would need to be done manually or via deployment scripts
    
    // Create admin user if not exists
    console.log('👤 Creating admin user...');
    const adminUser = await prisma.user.upsert({
      where: { email: 'admin@school.edu' },
      update: {},
      create: {
        email: 'admin@school.edu',
        name: 'System Administrator',
        role: 'ADMIN',
        isActive: true,
      },
    });
    console.log('✅ Admin user created:', adminUser.email);
    
    // Create test users
    const testUsers = [
      { email: 'teacher1@school.edu', name: 'Alice Johnson', role: 'TEACHER' },
      { email: 'iqa1@school.edu', name: 'Dr. Sarah Miller', role: 'IQA_EVALUATOR' },
      { email: 'eqa1@school.edu', name: 'Dr. Robert Taylor', role: 'EQA_EVALUATOR' },
      { email: 'executive1@school.edu', name: 'Principal John Executive', role: 'EXECUTIVE' },
    ];
    
    console.log('👥 Creating test users...');
    for (const userData of testUsers) {
      const user = await prisma.user.upsert({
        where: { email: userData.email },
        update: {},
        create: {
          ...userData,
          isActive: true,
        },
      });
      console.log(`✅ User created: ${user.email}`);
    }
    
    // Get user count
    const userCount = await prisma.user.count();
    console.log(`📊 Total users in database: ${userCount}`);
    
    await prisma.$disconnect();
    
    return NextResponse.json({
      success: true,
      message: 'Database setup completed successfully',
      userCount,
      adminUser: adminUser.email,
      environment: {
        nodeEnv: process.env.NODE_ENV,
        hasDatabase: !!process.env.DATABASE_URL,
        nextAuthUrl: process.env.NEXTAUTH_URL,
      },
    });
    
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    await prisma.$disconnect();
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      environment: {
        nodeEnv: process.env.NODE_ENV,
        hasDatabase: !!process.env.DATABASE_URL,
        nextAuthUrl: process.env.NEXTAUTH_URL,
      },
    }, { status: 500 });
  }
}