import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { S3Client, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'

const prisma = new PrismaClient()
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
})

export async function POST(request: NextRequest) {
  // Only allow in test environment
  if (process.env.NODE_ENV !== 'test' && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not allowed in production' }, { status: 403 })
  }

  try {
    const { action, cleanupTypes, filePatterns } = await request.json()

    switch (action) {
      case 'cleanup-test-data':
        return await cleanupTestData(cleanupTypes)
      
      case 'cleanup-test-files':
        return await cleanupTestFiles(filePatterns)
      
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Test cleanup error:', error)
    return NextResponse.json({ error: 'Cleanup failed' }, { status: 500 })
  }
}

async function cleanupTestData(cleanupTypes: string[]) {
  const results = []

  for (const type of cleanupTypes) {
    try {
      switch (type) {
        case 'test-users':
          const deletedUsers = await prisma.user.deleteMany({
            where: {
              email: {
                contains: '@test.university.ac.th'
              }
            }
          })
          results.push({ type, count: deletedUsers.count })
          break

        case 'test-evidence':
          const deletedEvidence = await prisma.evidence.deleteMany({
            where: {
              OR: [
                { title: { contains: 'Test' } },
                { title: { contains: 'E2E' } },
                { title: { contains: 'Concurrent' } },
                { title: { contains: 'Performance' } },
              ]
            }
          })
          results.push({ type, count: deletedEvidence.count })
          break

        case 'test-evaluations':
          const deletedEvaluations = await prisma.evaluation.deleteMany({
            where: {
              feedback: {
                contains: 'test'
              }
            }
          })
          results.push({ type, count: deletedEvaluations.count })
          break

        case 'test-academic-years':
          const deletedAcademicYears = await prisma.academicYear.deleteMany({
            where: {
              year: '2024' // Test year
            }
          })
          results.push({ type, count: deletedAcademicYears.count })
          break

        case 'test-audit-logs':
          const deletedAuditLogs = await prisma.auditLog.deleteMany({
            where: {
              OR: [
                { details: { path: ['test'] } },
                { userId: { contains: 'test' } },
              ]
            }
          })
          results.push({ type, count: deletedAuditLogs.count })
          break

        default:
          results.push({ type, error: 'Unknown cleanup type' })
      }
    } catch (error) {
      console.error(`Failed to cleanup ${type}:`, error)
      results.push({ type, error: error.message })
    }
  }

  return NextResponse.json({ success: true, results })
}

async function cleanupTestFiles(filePatterns: string[]) {
  const results = []
  const bucketName = process.env.AWS_S3_BUCKET

  if (!bucketName) {
    return NextResponse.json({ error: 'S3 bucket not configured' }, { status: 500 })
  }

  try {
    // List all objects in the bucket
    const listCommand = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: 'evidence/', // Only look in evidence folder
    })

    const listResponse = await s3Client.send(listCommand)
    const objects = listResponse.Contents || []

    // Filter objects that match test patterns
    const testObjects = objects.filter(obj => {
      const key = obj.Key || ''
      return filePatterns.some(pattern => {
        const regex = new RegExp(pattern.replace('*', '.*'), 'i')
        return regex.test(key)
      })
    })

    // Delete matching objects
    const deletePromises = testObjects.map(async (obj) => {
      try {
        const deleteCommand = new DeleteObjectCommand({
          Bucket: bucketName,
          Key: obj.Key,
        })
        await s3Client.send(deleteCommand)
        return { key: obj.Key, success: true }
      } catch (error) {
        return { key: obj.Key, success: false, error: error.message }
      }
    })

    const deleteResults = await Promise.all(deletePromises)
    const successCount = deleteResults.filter(r => r.success).length
    const failureCount = deleteResults.filter(r => !r.success).length

    results.push({
      type: 'file-cleanup',
      totalFiles: testObjects.length,
      successCount,
      failureCount,
      details: deleteResults,
    })

  } catch (error) {
    console.error('Failed to cleanup test files:', error)
    results.push({
      type: 'file-cleanup',
      error: error.message,
    })
  }

  return NextResponse.json({ success: true, results })
}