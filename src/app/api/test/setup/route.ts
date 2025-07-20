import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  // Only allow in test environment
  if (process.env.NODE_ENV !== 'test' && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not allowed in production' }, { status: 403 })
  }

  try {
    const { action, ...data } = await request.json()

    switch (action) {
      case 'create-test-users':
        return await createTestUsers(data.users)
      
      case 'create-academic-year':
        return await createAcademicYear(data)
      
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Test setup error:', error)
    return NextResponse.json({ error: 'Setup failed' }, { status: 500 })
  }
}

async function createTestUsers(users: any[]) {
  const createdUsers = []

  for (const userData of users) {
    try {
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: userData.email }
      })

      if (existingUser) {
        createdUsers.push(existingUser)
        continue
      }

      // Create new user
      const hashedPassword = await hash(userData.password, 12)
      const user = await prisma.user.create({
        data: {
          email: userData.email,
          name: userData.name,
          role: userData.role,
          department: userData.department,
          hashedPassword,
          emailVerified: new Date(), // Auto-verify for tests
        }
      })

      createdUsers.push(user)
    } catch (error) {
      console.error(`Failed to create user ${userData.email}:`, error)
    }
  }

  return NextResponse.json({ 
    success: true, 
    users: createdUsers.map(u => ({ id: u.id, email: u.email, role: u.role }))
  })
}

async function createAcademicYear(data: any) {
  try {
    // Check if academic year already exists
    const existingYear = await prisma.academicYear.findUnique({
      where: { year: data.year }
    })

    if (existingYear) {
      return NextResponse.json({ success: true, academicYear: existingYear })
    }

    // Deactivate other years if this one is active
    if (data.isActive) {
      await prisma.academicYear.updateMany({
        where: { isActive: true },
        data: { isActive: false }
      })
    }

    const academicYear = await prisma.academicYear.create({
      data: {
        year: data.year,
        isActive: data.isActive,
        submissionStart: new Date(data.submissionStart),
        submissionEnd: new Date(data.submissionEnd),
        evaluationStart: new Date(data.evaluationStart),
        evaluationEnd: new Date(data.evaluationEnd),
      }
    })

    return NextResponse.json({ success: true, academicYear })
  } catch (error) {
    console.error('Failed to create academic year:', error)
    return NextResponse.json({ error: 'Failed to create academic year' }, { status: 500 })
  }
}