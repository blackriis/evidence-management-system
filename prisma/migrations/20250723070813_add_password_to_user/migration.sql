-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'SECURITY_VIOLATION';
ALTER TYPE "AuditAction" ADD VALUE 'RATE_LIMIT_EXCEEDED';
ALTER TYPE "AuditAction" ADD VALUE 'CSRF_VIOLATION';
ALTER TYPE "AuditAction" ADD VALUE 'MALWARE_DETECTED';
ALTER TYPE "AuditAction" ADD VALUE 'UNAUTHORIZED_ACCESS';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "password" TEXT;
