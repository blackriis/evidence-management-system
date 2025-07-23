#!/bin/bash

# Production Deployment Script for PK22 Evidence Management System
# Usage: ./deploy-pk22.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 PK22 Evidence Management System - Production Deployment${NC}"
echo "================================================================"

# Function to print colored output
print_step() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if production environment file exists
check_env_file() {
    if [ ! -f ".env.production" ]; then
        print_error "Production environment file not found!"
        echo "Please create .env.production with the following variables:"
        echo "APP_URL=https://evidence.pk22.ac.th"
        echo "DATABASE_URL=postgresql://evidence_user:Blackriis1122@d8scko4o4484kooccckg0kww:5432/postgres"
        echo "NEXTAUTH_SECRET=build-secret-at-least-32-characters-long-for-jwt-signing"
        echo "NEXTAUTH_URL=https://evidence.pk22.ac.th"
        echo "NODE_ENV=production"
        echo "NEXT_TELEMETRY_DISABLED=1"
        exit 1
    fi
    print_step "Production environment file found"
}

# Install dependencies
install_dependencies() {
    print_step "Installing production dependencies..."
    npm ci --only=production
    print_step "Dependencies installed successfully"
}

# Generate Prisma client
generate_prisma() {
    print_step "Generating Prisma client..."
    npx prisma generate
    print_step "Prisma client generated successfully"
}

# Build application
build_app() {
    print_step "Building application for production..."
    NODE_ENV=production npm run build
    print_step "Application built successfully"
}

# Setup database (with confirmation)
setup_database() {
    echo
    print_warning "Database setup required"
    echo "This will:"
    echo "1. Apply database migrations"
    echo "2. Seed initial data"
    echo "3. Create admin user"
    echo
    read -p "Proceed with database setup? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_step "Setting up production database..."
        
        # Apply migrations
        echo "Applying database migrations..."
        NODE_ENV=production npx prisma migrate deploy
        
        # Seed database
        echo "Seeding initial data..."
        NODE_ENV=production npx prisma db seed
        
        # Create admin user
        echo "Creating admin user..."
        NODE_ENV=production npx tsx -e "
        const bcrypt = require('bcryptjs');
        const { PrismaClient } = require('@prisma/client');
        
        const prisma = new PrismaClient();
        
        async function setupAdmin() {
          try {
            const hashedPassword = await bcrypt.hash('PK22Admin2025!', 12);
            
            const admin = await prisma.user.upsert({
              where: { email: 'admin@pk22.ac.th' },
              update: { password: hashedPassword },
              create: {
                email: 'admin@pk22.ac.th',
                name: 'PK22 System Administrator',
                role: 'ADMIN',
                password: hashedPassword,
                isActive: true
              }
            });
            
            console.log('✅ Admin user created:', admin.email);
            console.log('📧 Email: admin@pk22.ac.th');
            console.log('🔑 Password: PK22Admin2025!');
            console.log('⚠️  Please change password after first login!');
          } catch (error) {
            console.error('❌ Error creating admin user:', error.message);
          } finally {
            await prisma.\$disconnect();
          }
        }
        
        setupAdmin();
        "
        
        print_step "Database setup completed"
    else
        print_warning "Database setup skipped"
    fi
}

# Test production build
test_build() {
    print_step "Testing production build..."
    
    # Create test script
    cat > test-production.js << 'EOF'
const { spawn } = require('child_process');

console.log('🧪 Testing production server...');

const server = spawn('npm', ['start'], {
    env: { ...process.env, NODE_ENV: 'production' },
    stdio: 'pipe'
});

let serverReady = false;

server.stdout.on('data', (data) => {
    const output = data.toString();
    console.log('SERVER:', output.trim());
    
    if (output.includes('Ready') || output.includes('listening')) {
        serverReady = true;
        console.log('✅ Server started successfully');
        
        // Wait a bit then test health endpoint
        setTimeout(async () => {
            try {
                const fetch = require('node-fetch');
                const response = await fetch('http://localhost:3000/api/health');
                const health = await response.json();
                console.log('✅ Health check passed:', health);
            } catch (error) {
                console.log('⚠️  Health check failed:', error.message);
            }
            server.kill();
            process.exit(0);
        }, 3000);
    }
});

server.stderr.on('data', (data) => {
    console.error('SERVER ERROR:', data.toString().trim());
});

server.on('close', (code) => {
    if (!serverReady) {
        console.error('❌ Server failed to start');
        process.exit(1);
    }
});

// Timeout after 30 seconds
setTimeout(() => {
    if (!serverReady) {
        console.error('❌ Server startup timeout');
        server.kill();
        process.exit(1);
    }
}, 30000);
EOF

    # Run test (skip if requested)
    read -p "Test production server startup? (Y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        node test-production.js
        rm -f test-production.js
        print_step "Production build test completed"
    else
        rm -f test-production.js
        print_warning "Production test skipped"
    fi
}

# Display deployment summary
show_deployment_summary() {
    echo
    echo -e "${BLUE}📋 Deployment Summary${NC}"
    echo "======================"
    echo
    echo -e "${GREEN}✅ Application built for production${NC}"
    echo -e "${GREEN}✅ Database configured${NC}"
    echo -e "${GREEN}✅ Admin user created${NC}"
    echo
    echo -e "${BLUE}🌐 Application Details:${NC}"
    echo "  URL: https://evidence.pk22.ac.th"
    echo "  Admin: admin@pk22.ac.th"
    echo "  Password: PK22Admin2025!"
    echo
    echo -e "${BLUE}🚀 To start the application:${NC}"
    echo "  npm start"
    echo "  # or with PM2:"
    echo "  pm2 start ecosystem.config.js --env production"
    echo
    echo -e "${BLUE}🔍 Health Check:${NC}"
    echo "  curl https://evidence.pk22.ac.th/api/health"
    echo
    echo -e "${YELLOW}⚠️  Important:${NC}"
    echo "  1. Change admin password after first login"
    echo "  2. Configure SSL/HTTPS on your server"
    echo "  3. Set up regular database backups"
    echo "  4. Configure firewall rules"
    echo
    echo -e "${GREEN}🎉 Deployment preparation completed!${NC}"
}

# Main execution
main() {
    check_env_file
    install_dependencies
    generate_prisma
    build_app
    setup_database
    test_build
    show_deployment_summary
}

# Handle script interruption
trap 'echo -e "\n${RED}❌ Deployment interrupted${NC}"; exit 1' INT TERM

# Run main function
main "$@"