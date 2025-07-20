// Simple test script to verify audit logging functionality
const { PrismaClient } = require('@prisma/client');

const db = new PrismaClient();

async function testAuditLogging() {
  try {
    console.log('Testing audit logging system...');
    
    // Test creating an audit log entry
    const auditLog = await db.auditLog.create({
      data: {
        action: 'CREATE',
        resource: 'test',
        resourceId: 'test-123',
        newValues: { test: 'data' },
        metadata: { test: true },
      },
    });
    
    console.log('✅ Audit log created:', auditLog.id);
    
    // Test retrieving audit logs
    const logs = await db.auditLog.findMany({
      take: 5,
      orderBy: { timestamp: 'desc' },
    });
    
    console.log('✅ Retrieved audit logs:', logs.length);
    
    // Test cleanup
    await db.auditLog.delete({
      where: { id: auditLog.id },
    });
    
    console.log('✅ Test audit log cleaned up');
    console.log('🎉 Audit logging system is working correctly!');
    
  } catch (error) {
    console.error('❌ Error testing audit logging:', error);
  } finally {
    await db.$disconnect();
  }
}

testAuditLogging();