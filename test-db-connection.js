#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');

// Use production database URL
const DATABASE_URL = "postgresql://postgres:Blackriis1122%23@twg0gwswggwkwsgsook40s44:5432/postgres?sslmode=require";

console.log('🔍 Testing PostgreSQL connection...');
console.log('Database URL:', DATABASE_URL.replace(/:[^:@]*@/, ':****@')); // Hide password

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: DATABASE_URL
    }
  }
});

async function testConnection() {
  try {
    console.log('\n📡 Attempting to connect to database...');
    
    // Test basic connection
    await prisma.$connect();
    console.log('✅ Database connection successful!');
    
    // Test query execution
    console.log('\n🔍 Testing query execution...');
    const result = await prisma.$queryRaw`SELECT version() as version, current_database() as database, current_user as user`;
    console.log('✅ Query execution successful!');
    console.log('📊 Database info:', result[0]);
    
    // Check if tables exist
    console.log('\n🔍 Checking existing tables...');
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    
    if (tables.length > 0) {
      console.log('📋 Existing tables:');
      tables.forEach(table => console.log(`  - ${table.table_name}`));
    } else {
      console.log('⚠️  No tables found - database needs to be initialized');
    }
    
    // Check if User table exists specifically
    const userTableExists = tables.some(table => table.table_name === 'User');
    console.log(`\n👤 User table exists: ${userTableExists ? '✅ Yes' : '❌ No'}`);
    
    if (userTableExists) {
      try {
        const userCount = await prisma.user.count();
        console.log(`👥 Number of users in database: ${userCount}`);
        
        if (userCount > 0) {
          const sampleUser = await prisma.user.findFirst({
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              isActive: true
            }
          });
          console.log('👤 Sample user:', sampleUser);
        }
      } catch (error) {
        console.log('⚠️  Could not query User table:', error.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Database connection failed!');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    
    if (error.code) {
      console.error('Error code:', error.code);
    }
    
    // Common error solutions
    if (error.message.includes('authentication failed')) {
      console.log('\n💡 Possible solutions:');
      console.log('   - Check username and password');
      console.log('   - Verify user has database access permissions');
    } else if (error.message.includes('connection refused')) {
      console.log('\n💡 Possible solutions:');
      console.log('   - Check if database server is running');
      console.log('   - Verify host and port are correct');
      console.log('   - Check firewall settings');
    } else if (error.message.includes('SSL')) {
      console.log('\n💡 Possible solutions:');
      console.log('   - Try sslmode=disable instead of require');
      console.log('   - Check SSL certificate configuration');
    }
    
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    console.log('\n🔌 Database connection closed');
  }
}

testConnection();