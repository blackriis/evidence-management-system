#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');

const HOST = 'twg0gwswggwkwsgsook40s44';
const PORT = '5432';
const USER = 'postgres';
const DB = 'postgres';
const PASSWORD = 'Blackriis1122#';

// Different DATABASE_URL variations to test
const variations = [
  // Different SSL modes
  `postgresql://${USER}:${encodeURIComponent(PASSWORD)}@${HOST}:${PORT}/${DB}?sslmode=disable`,
  `postgresql://${USER}:${encodeURIComponent(PASSWORD)}@${HOST}:${PORT}/${DB}?sslmode=require`,
  `postgresql://${USER}:${encodeURIComponent(PASSWORD)}@${HOST}:${PORT}/${DB}?sslmode=prefer`,
  `postgresql://${USER}:${encodeURIComponent(PASSWORD)}@${HOST}:${PORT}/${DB}`,
  
  // Manual encoding
  `postgresql://${USER}:Blackriis1122%23@${HOST}:${PORT}/${DB}?sslmode=disable`,
  `postgresql://${USER}:Blackriis1122%23@${HOST}:${PORT}/${DB}?sslmode=require`,
  
  // Without encoding (risky but let's test)
  `postgresql://${USER}:Blackriis1122#@${HOST}:${PORT}/${DB}?sslmode=disable`,
];

async function testDatabaseUrl(dbUrl, index) {
  console.log(`\n🔍 Test ${index + 1}: ${dbUrl.replace(/:([^:@]*?)@/, ':****@')}`);
  
  const prisma = new PrismaClient({
    datasources: {
      db: { url: dbUrl }
    }
  });

  try {
    await prisma.$connect();
    const result = await prisma.$queryRaw`SELECT current_user, current_database(), version()`;
    console.log(`✅ SUCCESS!`);
    console.log(`📊 User: ${result[0].current_user}`);
    console.log(`📊 DB: ${result[0].current_database}`);
    console.log(`📊 Version: ${result[0].version.split(' ')[0]} ${result[0].version.split(' ')[1]}`);
    
    // Test if we can create tables
    try {
      await prisma.$queryRaw`SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'User'`;
      console.log(`🔍 Can query schema info - permissions OK`);
    } catch (error) {
      console.log(`⚠️  Schema query failed: ${error.message}`);
    }
    
    await prisma.$disconnect();
    return dbUrl;
  } catch (error) {
    console.log(`❌ Failed: ${error.message.split('\n')[0]}`);
    if (error.message.includes('authentication failed')) {
      console.log(`   🔑 Password issue`);
    } else if (error.message.includes('SSL')) {
      console.log(`   🔒 SSL issue`);
    } else if (error.message.includes('timeout')) {
      console.log(`   ⏰ Connection timeout`);
    }
    await prisma.$disconnect();
    return null;
  }
}

async function testAllVariations() {
  console.log('🚀 Testing PostgreSQL connection variations...');
  console.log(`Password: "${PASSWORD}"`);
  
  for (let i = 0; i < variations.length; i++) {
    const success = await testDatabaseUrl(variations[i], i);
    if (success) {
      console.log(`\n🎉 WORKING DATABASE_URL FOUND!`);
      console.log(`📋 Use this in production:`);
      console.log(`DATABASE_URL="${success}"`);
      console.log(`\n📝 Update .env.production with this URL`);
      return;
    }
  }
  
  console.log('\n❌ No working configuration found!');
  console.log('\n💡 Next steps:');
  console.log('   1. Verify password is exactly: Blackriis1122#');
  console.log('   2. Check if postgres user exists');
  console.log('   3. Verify database "postgres" exists');
  console.log('   4. Check PostgreSQL server logs');
}

testAllVariations();