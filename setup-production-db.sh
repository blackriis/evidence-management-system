#!/bin/bash

# Production Database Setup Script
echo "🚀 Setting up production database..."

# Set production environment
export NODE_ENV=production
export DATABASE_URL="postgresql://postgres:Blackriis1122%23@twg0gwswggwkwsgsook40s44:5432/postgres?sslmode=require"

echo "📊 Generating Prisma client..."
npx prisma generate

echo "🔧 Pushing database schema..."
npx prisma db push --accept-data-loss

echo "🌱 Seeding database with initial data..."
npx tsx prisma/seed.ts

echo "✅ Production database setup completed!"
echo ""
echo "👥 Test users created:"
echo "  - admin@school.edu (Admin)"
echo "  - teacher1@school.edu (Teacher)"
echo "  - iqa1@school.edu (IQA Evaluator)"
echo "  - eqa1@school.edu (EQA Evaluator)"
echo "  - executive1@school.edu (Executive)"
echo ""
echo "🔑 Use any password for login in development mode"