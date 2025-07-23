#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');

const HOST = 'twg0gwswggwkwsgsook40s44';
const PORT = '5432';
const USER = 'postgres';
const DB = 'postgres';

// Different password variations to test
const passwords = [
  'Blackriis1122#',
  'Blackriis1122%23',  // URL encoded
  'blackriis1122#',    // lowercase
  'Blackriis1122',     // without #
  'postgres',          // default postgres password
  'password',          // common password
  'admin',             // common password
  '',                  // empty password
];

async function testPassword(password) {
  const encodedPassword = encodeURIComponent(password);
  const dbUrl = `postgresql://${USER}:${encodedPassword}@${HOST}:${PORT}/${DB}?sslmode=require`;
  
  console.log(`\n🔍 Testing password: "${password}" (encoded: "${encodedPassword}")`);
  
  const prisma = new PrismaClient({
    datasources: {
      db: { url: dbUrl }
    }
  });

  try {
    await prisma.$connect();
    const result = await prisma.$queryRaw`SELECT current_user, current_database()`;
    console.log(`✅ SUCCESS! Password "${password}" works!`);
    console.log(`📊 Connected as: ${result[0].current_user} to database: ${result[0].current_database}`);
    await prisma.$disconnect();
    return password;
  } catch (error) {
    console.log(`❌ Failed: ${error.message.split('\n')[0]}`);
    await prisma.$disconnect();
    return null;
  }
}

async function testAllPasswords() {
  console.log('🚀 Testing PostgreSQL passwords...');
  console.log(`Host: ${HOST}:${PORT}`);
  console.log(`User: ${USER}`);
  console.log(`Database: ${DB}`);
  
  for (const password of passwords) {
    const success = await testPassword(password);
    if (success) {
      console.log(`\n🎉 FOUND WORKING PASSWORD: "${success}"`);
      console.log(`📋 Use this DATABASE_URL:`);
      console.log(`DATABASE_URL="postgresql://${USER}:${encodeURIComponent(success)}@${HOST}:${PORT}/${DB}?sslmode=require"`);
      return;
    }
  }
  
  console.log('\n❌ No working password found!');
  console.log('💡 Please check:');
  console.log('   - Database server is running');
  console.log('   - User "postgres" exists');
  console.log('   - Correct password');
  console.log('   - Network connectivity');
}

testAllPasswords();