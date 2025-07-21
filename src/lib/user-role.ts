// UserRole enum fallback for production builds
// This ensures UserRole is available even if Prisma client fails to import

// Try to import from Prisma client first
let UserRole: any;

try {
  const prismaClient = require('@prisma/client');
  UserRole = prismaClient.UserRole;
} catch (error) {
  console.warn('Failed to import UserRole from @prisma/client, using fallback');
  
  // Fallback enum definition
  UserRole = {
    TEACHER: 'TEACHER',
    IQA_EVALUATOR: 'IQA_EVALUATOR',
    EQA_EVALUATOR: 'EQA_EVALUATOR', 
    EXECUTIVE: 'EXECUTIVE',
    ADMIN: 'ADMIN'
  } as const;
}

// Ensure the enum is properly defined
if (!UserRole || typeof UserRole !== 'object') {
  console.error('UserRole enum is not properly defined, creating fallback');
  UserRole = {
    TEACHER: 'TEACHER',
    IQA_EVALUATOR: 'IQA_EVALUATOR', 
    EQA_EVALUATOR: 'EQA_EVALUATOR',
    EXECUTIVE: 'EXECUTIVE',
    ADMIN: 'ADMIN'
  } as const;
}

// Type definition for TypeScript
export type UserRoleType = 'TEACHER' | 'IQA_EVALUATOR' | 'EQA_EVALUATOR' | 'EXECUTIVE' | 'ADMIN';

export { UserRole };
export default UserRole;