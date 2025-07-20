#!/bin/bash

# Debug build script for Evidence Management System
echo "🔍 Debug Build Script for Evidence Management System"
echo "=================================================="

# Show environment
echo "📋 Environment Variables:"
echo "NODE_ENV: $NODE_ENV"
echo "SKIP_ENV_VALIDATION: $SKIP_ENV_VALIDATION"
echo "NEXT_TELEMETRY_DISABLED: $NEXT_TELEMETRY_DISABLED"
echo "DISABLE_REDIS_CACHE: $DISABLE_REDIS_CACHE"

# Check Node.js version
echo "📦 Node.js version:"
node --version
npm --version

# Check if package.json exists
echo "📄 Checking package.json:"
if [ -f "package.json" ]; then
    echo "✅ package.json found"
    echo "📋 Build script: $(jq -r '.scripts.build' package.json)"
else
    echo "❌ package.json not found"
    exit 1
fi

# Check if node_modules exists
echo "📦 Checking node_modules:"
if [ -d "node_modules" ]; then
    echo "✅ node_modules found"
    echo "📋 node_modules size: $(du -sh node_modules 2>/dev/null || echo 'Unable to calculate')"
else
    echo "❌ node_modules not found"
    echo "Running npm ci..."
    npm ci --only=production --no-audit --no-fund
fi

# Check Prisma
echo "🗄️ Checking Prisma:"
if [ -f "prisma/schema.prisma" ]; then
    echo "✅ Prisma schema found"
    echo "Generating Prisma client..."
    npx prisma generate || echo "⚠️ Prisma generate failed"
else
    echo "⚠️ Prisma schema not found"
fi

# Check Next.js config
echo "⚙️ Checking Next.js config:"
if [ -f "next.config.ts" ]; then
    echo "✅ next.config.ts found"
elif [ -f "next.config.js" ]; then
    echo "✅ next.config.js found"
else
    echo "⚠️ No Next.js config found"
fi

# Check environment
echo "🌍 Checking environment file:"
if [ -f ".env.local" ]; then
    echo "✅ .env.local found"
    echo "📋 Environment variables in .env.local:"
    grep -v "SECRET\|KEY\|PASSWORD" .env.local 2>/dev/null | head -5 || echo "Unable to show env vars"
else
    echo "⚠️ No .env.local found"
fi

# Try building
echo "🏗️ Starting Next.js build..."
echo "Command: npm run build"

set -e  # Exit on error
npm run build

echo "✅ Build completed successfully!"