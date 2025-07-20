#!/bin/bash

# Production Database Initialization Script for Evidence Management System
# This script should be run after deploying to Dokploy

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_step() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

echo -e "${BLUE}🔧 Initializing Evidence Management System Database${NC}"
echo "=================================================="

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    print_error "DATABASE_URL environment variable is not set"
    exit 1
fi

print_step "DATABASE_URL is configured"

# Check if Prisma is available
if ! command -v npx &> /dev/null; then
    print_error "npx is not available"
    exit 1
fi

print_step "Node.js and npx are available"

# Generate Prisma client
print_step "Generating Prisma client..."
npx prisma generate

# Check database connection
print_step "Testing database connection..."
if npx prisma db pull --preview-feature > /dev/null 2>&1; then
    print_step "Database connection successful"
else
    print_warning "Could not connect to database. Proceeding with migration..."
fi

# Run database migrations
print_step "Running database migrations..."
npx prisma migrate deploy

# Check if data already exists
print_step "Checking if database is already seeded..."
USER_COUNT=$(npx prisma db execute --stdin <<< "SELECT COUNT(*) as count FROM \"User\";" 2>/dev/null | grep -o '[0-9]\+' | tail -1 || echo "0")

if [ "$USER_COUNT" -gt "0" ]; then
    print_warning "Database already contains $USER_COUNT users. Skipping seed."
    
    read -p "Force re-seed the database? This will add duplicate data. (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_step "Running database seed..."
        npx prisma db seed
    else
        print_step "Skipping database seed"
    fi
else
    print_step "Running database seed..."
    npx prisma db seed
fi

# Verify installation
print_step "Verifying database setup..."

# Check if admin user exists
ADMIN_COUNT=$(npx prisma db execute --stdin <<< "SELECT COUNT(*) as count FROM \"User\" WHERE role = 'ADMIN';" 2>/dev/null | grep -o '[0-9]\+' | tail -1 || echo "0")

if [ "$ADMIN_COUNT" -gt "0" ]; then
    print_step "Admin user(s) found: $ADMIN_COUNT"
else
    print_error "No admin users found in database"
    exit 1
fi

# Check if academic years exist
YEAR_COUNT=$(npx prisma db execute --stdin <<< "SELECT COUNT(*) as count FROM \"AcademicYear\";" 2>/dev/null | grep -o '[0-9]\+' | tail -1 || echo "0")

if [ "$YEAR_COUNT" -gt "0" ]; then
    print_step "Academic years found: $YEAR_COUNT"
else
    print_warning "No academic years found in database"
fi

# Check if indicators exist
INDICATOR_COUNT=$(npx prisma db execute --stdin <<< "SELECT COUNT(*) as count FROM \"Indicator\";" 2>/dev/null | grep -o '[0-9]\+' | tail -1 || echo "0")

if [ "$INDICATOR_COUNT" -gt "0" ]; then
    print_step "Indicators found: $INDICATOR_COUNT"
else
    print_warning "No indicators found in database"
fi

echo
echo -e "${GREEN}🎉 Database initialization completed successfully!${NC}"
echo
echo -e "${BLUE}📋 Default Login Credentials:${NC}"
echo "=============================="
echo "Admin User:"
echo "  Email: admin@example.com"
echo "  Password: admin123"
echo
echo "Test Teacher:"
echo "  Email: teacher1@example.com"
echo "  Password: teacher123"
echo
echo "Test IQA Evaluator:"
echo "  Email: iqa1@example.com"
echo "  Password: iqa123"
echo
echo "Test EQA Evaluator:"
echo "  Email: eqa1@example.com"
echo "  Password: eqa123"
echo
echo -e "${YELLOW}⚠️  IMPORTANT SECURITY NOTES:${NC}"
echo "1. Change all default passwords immediately"
echo "2. Create proper user accounts for your organization"
echo "3. Delete or disable test accounts in production"
echo "4. Review and configure proper indicators and academic years"
echo
echo -e "${BLUE}✅ System is ready for use!${NC}"