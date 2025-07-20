#!/bin/bash

# Dokploy Deployment Script for Evidence Management System
# Usage: ./dokploy-deploy.sh [environment]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-production}
APP_NAME="evidence-management-system"
DOCKER_IMAGE="evidence-management:latest"

echo -e "${BLUE}🚀 Starting Dokploy deployment for Evidence Management System${NC}"
echo -e "${BLUE}Environment: ${ENVIRONMENT}${NC}"

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

# Check if required tools are installed
check_dependencies() {
    print_step "Checking dependencies..."
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"
        exit 1
    fi
    
    if ! command -v git &> /dev/null; then
        print_error "Git is not installed"
        exit 1
    fi
    
    print_step "All dependencies are available"
}

# Validate environment variables
validate_env() {
    print_step "Validating environment variables..."
    
    if [ -f ".env.${ENVIRONMENT}" ]; then
        source ".env.${ENVIRONMENT}"
        print_step "Loaded environment from .env.${ENVIRONMENT}"
    elif [ -f ".env" ]; then
        source ".env"
        print_step "Loaded environment from .env"
    else
        print_warning "No environment file found. Make sure environment variables are set in Dokploy."
    fi
    
    # Check critical environment variables
    if [ -z "$DATABASE_URL" ]; then
        print_warning "DATABASE_URL not set - will need to be configured in Dokploy"
    fi
    
    if [ -z "$NEXTAUTH_SECRET" ]; then
        print_warning "NEXTAUTH_SECRET not set - will need to be configured in Dokploy"
    fi
}

# Build Docker image locally for testing
build_image() {
    print_step "Building Docker image..."
    
    # Generate Prisma client before building
    if [ -f "package.json" ]; then
        echo "Installing dependencies and generating Prisma client..."
        npm ci --only=production
        npx prisma generate
    fi
    
    # Build the image
    docker build -t $DOCKER_IMAGE .
    
    print_step "Docker image built successfully"
}

# Test the Docker image locally
test_image() {
    print_step "Testing Docker image..."
    
    # Create test environment file
    cat > .env.test << EOF
DATABASE_URL=postgresql://test:test@localhost:5432/test
NEXTAUTH_SECRET=test-secret-for-local-testing-only
NEXTAUTH_URL=http://localhost:3000
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
STORAGE_ENDPOINT=local
STORAGE_ACCESS_KEY=local
STORAGE_SECRET_KEY=local
STORAGE_BUCKET=evidence-files
STORAGE_REGION=local
EOF

    # Run container for testing
    echo "Starting test container..."
    CONTAINER_ID=$(docker run -d \
        --env-file .env.test \
        -p 3001:3000 \
        $DOCKER_IMAGE)
    
    # Wait for container to start
    echo "Waiting for container to start..."
    sleep 10
    
    # Test health endpoint
    if curl -f http://localhost:3001/api/health > /dev/null 2>&1; then
        print_step "Health check passed"
    else
        print_error "Health check failed"
        docker logs $CONTAINER_ID
        docker stop $CONTAINER_ID
        rm -f .env.test
        exit 1
    fi
    
    # Clean up
    docker stop $CONTAINER_ID
    rm -f .env.test
    
    print_step "Docker image test completed successfully"
}

# Prepare for Dokploy deployment
prepare_deployment() {
    print_step "Preparing for Dokploy deployment..."
    
    # Check if git repository is clean
    if [ -n "$(git status --porcelain)" ]; then
        print_warning "Git repository has uncommitted changes"
        echo "Uncommitted files:"
        git status --porcelain
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
    
    # Ensure we're on the correct branch
    CURRENT_BRANCH=$(git branch --show-current)
    if [ "$CURRENT_BRANCH" != "main" ] && [ "$CURRENT_BRANCH" != "master" ]; then
        print_warning "Current branch is '$CURRENT_BRANCH', not 'main' or 'master'"
        read -p "Continue with current branch? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
    
    # Check if remote repository is configured
    REMOTE_URL=$(git config --get remote.origin.url 2>/dev/null || echo "")
    if [ -z "$REMOTE_URL" ]; then
        print_warning "No Git remote 'origin' configured"
        print_warning "Please follow GIT-SETUP.md to configure your repository"
        print_warning "For now, you'll need to manually specify repository URL in Dokploy"
    fi
    
    print_step "Repository is ready for deployment"
}

# Generate Dokploy configuration
generate_dokploy_config() {
    print_step "Generating Dokploy configuration..."
    
    cat > dokploy-config.json << EOF
{
  "name": "${APP_NAME}",
  "type": "docker",
  "source": {
    "type": "git",
    "repository": "${REMOTE_URL:-YOUR_REPOSITORY_URL_HERE}",
    "branch": "$(git branch --show-current)"
  },
  "build": {
    "dockerfile": "Dockerfile",
    "context": "."
  },
  "deployment": {
    "port": 3000,
    "healthCheck": {
      "path": "/api/health",
      "interval": "30s",
      "timeout": "30s",
      "retries": 3
    }
  },
  "environment": [
    {
      "key": "NODE_ENV",
      "value": "production"
    },
    {
      "key": "NEXT_TELEMETRY_DISABLED",
      "value": "1"
    }
  ],
  "volumes": [
    {
      "source": "/var/dokploy/evidence/uploads",
      "target": "/app/uploads",
      "type": "bind"
    }
  ]
}
EOF
    
    print_step "Dokploy configuration generated (dokploy-config.json)"
}

# Display deployment instructions
show_deployment_instructions() {
    echo
    echo -e "${BLUE}📋 Dokploy Deployment Instructions${NC}"
    echo "=================================="
    echo
    echo "1. Login to your Dokploy dashboard"
    echo "2. Create a new application:"
    echo "   - Name: ${APP_NAME}"
    echo "   - Type: Git Repository"
    if [ -n "$REMOTE_URL" ]; then
        echo "   - Repository: $REMOTE_URL"
    else
        echo "   - Repository: [SET UP GIT REMOTE FIRST - see GIT-SETUP.md]"
    fi
    echo "   - Branch: $(git branch --show-current)"
    echo
    echo "3. Configure build settings:"
    echo "   - Build Type: Dockerfile"
    echo "   - Dockerfile Path: Dockerfile"
    echo "   - Build Context: /"
    echo
    echo "4. Set environment variables (copy from .env.example):"
    echo "   - DATABASE_URL (required)"
    echo "   - NEXTAUTH_SECRET (required)"
    echo "   - NEXTAUTH_URL (required)"
    echo "   - And other variables as needed"
    echo
    echo "5. Configure volumes:"
    echo "   - Host Path: /var/dokploy/evidence/uploads"
    echo "   - Container Path: /app/uploads"
    echo
    echo "6. Set up domain and SSL"
    echo
    echo "7. Deploy the application"
    echo
    echo "8. After deployment, run database migrations:"
    echo "   - Access the container terminal"
    echo "   - Run: npx prisma migrate deploy"
    echo "   - Run: npx prisma db seed"
    echo
    echo -e "${GREEN}✅ All preparation completed!${NC}"
    echo -e "${BLUE}Generated files:${NC}"
    echo "  - dokploy-config.json (reference configuration)"
    echo "  - DOKPLOY-DEPLOYMENT.md (detailed guide)"
}

# Main execution
main() {
    echo -e "${BLUE}Evidence Management System - Dokploy Deployment${NC}"
    echo "================================================="
    
    check_dependencies
    validate_env
    
    # Ask if user wants to build and test locally
    read -p "Build and test Docker image locally? (Y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        build_image
        test_image
    fi
    
    prepare_deployment
    generate_dokploy_config
    show_deployment_instructions
    
    echo
    echo -e "${GREEN}🎉 Deployment preparation completed successfully!${NC}"
    echo -e "${BLUE}Next step: Follow the instructions above to deploy in Dokploy${NC}"
}

# Handle script interruption
trap 'echo -e "\n${RED}❌ Deployment preparation interrupted${NC}"; exit 1' INT TERM

# Run main function
main "$@"