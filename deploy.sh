#!/bin/bash

# Production Deployment Script for Evidence Management System
# This script handles the complete deployment process with safety checks

set -e  # Exit on any error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_NAME="evidence-management-system"
BACKUP_DIR="/backups"
LOG_FILE="/var/log/evidence-deployment.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
    exit 1
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if Docker is installed and running
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed"
    fi
    
    if ! docker info &> /dev/null; then
        error "Docker is not running"
    fi
    
    # Check if Docker Compose is installed
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose is not installed"
    fi
    
    # Check if required environment files exist
    if [ ! -f ".env.production" ]; then
        error ".env.production file not found"
    fi
    
    # Check if SSL certificates exist (if HTTPS is enabled)
    if [ "${HTTPS_ENABLED:-false}" = "true" ]; then
        if [ ! -f "config/ssl/cert.pem" ] || [ ! -f "config/ssl/private.key" ]; then
            error "SSL certificates not found in config/ssl/"
        fi
    fi
    
    success "Prerequisites check passed"
}

# Backup existing data
backup_data() {
    log "Creating backup of existing data..."
    
    BACKUP_TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_PATH="${BACKUP_DIR}/${PROJECT_NAME}_${BACKUP_TIMESTAMP}"
    
    mkdir -p "$BACKUP_PATH"
    
    # Backup database if container is running
    if docker-compose ps postgres | grep -q "Up"; then
        log "Backing up database..."
        docker-compose exec -T postgres pg_dump -U evidence_user evidence_management > "$BACKUP_PATH/database.sql"
        success "Database backup completed"
    fi
    
    # Backup uploaded files
    if [ -d "uploads" ]; then
        log "Backing up uploaded files..."
        tar -czf "$BACKUP_PATH/uploads.tar.gz" uploads/
        success "Files backup completed"
    fi
    
    # Backup configuration
    log "Backing up configuration..."
    cp -r config/ "$BACKUP_PATH/" 2>/dev/null || true
    cp .env.production "$BACKUP_PATH/" 2>/dev/null || true
    
    success "Backup completed: $BACKUP_PATH"
    echo "$BACKUP_PATH" > .last_backup
}

# Health check function
health_check() {
    local service=$1
    local max_attempts=30
    local attempt=1
    
    log "Performing health check for $service..."
    
    while [ $attempt -le $max_attempts ]; do
        if docker-compose ps "$service" | grep -q "healthy\|Up"; then
            success "$service is healthy"
            return 0
        fi
        
        log "Attempt $attempt/$max_attempts: Waiting for $service to be healthy..."
        sleep 10
        ((attempt++))
    done
    
    error "$service failed health check after $max_attempts attempts"
}

# Deploy application
deploy() {
    log "Starting deployment process..."
    
    # Load environment variables
    if [ -f ".env.production" ]; then
        export $(cat .env.production | grep -v '^#' | xargs)
    fi
    
    # Pull latest images
    log "Pulling latest Docker images..."
    docker-compose pull
    
    # Build application image
    log "Building application image..."
    docker-compose build --no-cache app
    
    # Stop existing containers gracefully
    log "Stopping existing containers..."
    docker-compose down --timeout 30
    
    # Start infrastructure services first
    log "Starting infrastructure services..."
    docker-compose up -d postgres redis minio
    
    # Wait for infrastructure to be ready
    health_check postgres
    health_check redis
    health_check minio
    
    # Run database migrations
    log "Running database migrations..."
    docker-compose run --rm app npm run db:migrate
    
    # Start application
    log "Starting application..."
    docker-compose up -d app
    
    # Wait for application to be ready
    health_check app
    
    # Start reverse proxy
    if docker-compose config --services | grep -q nginx; then
        log "Starting reverse proxy..."
        docker-compose up -d nginx
        health_check nginx
    fi
    
    # Start monitoring services
    if docker-compose config --services | grep -q prometheus; then
        log "Starting monitoring services..."
        docker-compose up -d prometheus loki
    fi
    
    success "Deployment completed successfully"
}

# Post-deployment tasks
post_deploy() {
    log "Running post-deployment tasks..."
    
    # Warm up cache
    log "Warming up application cache..."
    docker-compose exec -T app npm run cache:warm || warning "Cache warming failed"
    
    # Run database optimization
    log "Running database optimization..."
    docker-compose exec -T postgres psql -U evidence_user -d evidence_management -c "ANALYZE;" || warning "Database optimization failed"
    
    # Test critical endpoints
    log "Testing critical endpoints..."
    sleep 30  # Give app time to fully start
    
    local app_url="${APP_URL:-http://localhost:3000}"
    
    if curl -f "$app_url/api/health" > /dev/null 2>&1; then
        success "Health endpoint is responding"
    else
        warning "Health endpoint is not responding"
    fi
    
    # Display deployment summary
    log "Deployment Summary:"
    docker-compose ps
    
    success "Post-deployment tasks completed"
}

# Rollback function
rollback() {
    log "Starting rollback process..."
    
    if [ ! -f ".last_backup" ]; then
        error "No backup found for rollback"
    fi
    
    BACKUP_PATH=$(cat .last_backup)
    
    if [ ! -d "$BACKUP_PATH" ]; then
        error "Backup directory not found: $BACKUP_PATH"
    fi
    
    # Stop current containers
    docker-compose down
    
    # Restore database
    if [ -f "$BACKUP_PATH/database.sql" ]; then
        log "Restoring database..."
        docker-compose up -d postgres
        sleep 30
        docker-compose exec -T postgres psql -U evidence_user -d evidence_management < "$BACKUP_PATH/database.sql"
    fi
    
    # Restore files
    if [ -f "$BACKUP_PATH/uploads.tar.gz" ]; then
        log "Restoring uploaded files..."
        rm -rf uploads/
        tar -xzf "$BACKUP_PATH/uploads.tar.gz"
    fi
    
    # Restore configuration
    if [ -d "$BACKUP_PATH/config" ]; then
        log "Restoring configuration..."
        cp -r "$BACKUP_PATH/config/" .
        cp "$BACKUP_PATH/.env.production" . 2>/dev/null || true
    fi
    
    # Start services
    docker-compose up -d
    
    success "Rollback completed"
}

# Cleanup old backups
cleanup_backups() {
    log "Cleaning up old backups..."
    
    # Keep only last 10 backups
    find "$BACKUP_DIR" -name "${PROJECT_NAME}_*" -type d | sort -r | tail -n +11 | xargs rm -rf
    
    success "Backup cleanup completed"
}

# Main execution
main() {
    log "Starting Evidence Management System deployment"
    
    case "${1:-deploy}" in
        "deploy")
            check_prerequisites
            backup_data
            deploy
            post_deploy
            cleanup_backups
            success "Deployment completed successfully!"
            ;;
        "rollback")
            rollback
            ;;
        "backup")
            backup_data
            ;;
        "health")
            health_check app
            ;;
        "logs")
            docker-compose logs -f "${2:-app}"
            ;;
        "status")
            docker-compose ps
            ;;
        *)
            echo "Usage: $0 {deploy|rollback|backup|health|logs|status}"
            echo ""
            echo "Commands:"
            echo "  deploy   - Deploy the application (default)"
            echo "  rollback - Rollback to the last backup"
            echo "  backup   - Create a backup of current data"
            echo "  health   - Check application health"
            echo "  logs     - Show application logs"
            echo "  status   - Show container status"
            exit 1
            ;;
    esac
}

# Create log directory
mkdir -p "$(dirname "$LOG_FILE")"

# Run main function
main "$@"