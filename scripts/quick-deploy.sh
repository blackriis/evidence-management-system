#!/bin/bash

# Quick Deploy Script for VPS
# This script handles the complete application deployment after VPS setup

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
DOMAIN=""
DB_PASSWORD=""
NEXTAUTH_SECRET=""
MINIO_ACCESS_KEY=""
MINIO_SECRET_KEY=""
RESEND_API_KEY=""

# Logging functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Check if running as deploy user
check_user() {
    if [ "$USER" != "deploy" ]; then
        error "This script must be run as the deploy user"
    fi
}

# Get configuration from user
get_configuration() {
    echo "=== Evidence Management System - Quick Deploy ==="
    echo ""
    
    read -p "Enter your domain name: " DOMAIN
    if [ -z "$DOMAIN" ]; then
        error "Domain name is required"
    fi
    
    # Generate secure passwords
    DB_PASSWORD=$(openssl rand -base64 32)
    NEXTAUTH_SECRET=$(openssl rand -base64 48)
    MINIO_ACCESS_KEY=$(openssl rand -hex 16)
    MINIO_SECRET_KEY=$(openssl rand -base64 32)
    
    read -p "Enter your Resend API key (for email): " RESEND_API_KEY
    if [ -z "$RESEND_API_KEY" ]; then
        warning "No Resend API key provided. Email notifications will be disabled."
        RESEND_API_KEY="dummy-key"
    fi
    
    echo ""
    echo "Configuration:"
    echo "• Domain: $DOMAIN"
    echo "• Database Password: [Generated]"
    echo "• NextAuth Secret: [Generated]"
    echo "• MinIO Credentials: [Generated]"
    echo "• Resend API Key: $([ "$RESEND_API_KEY" != "dummy-key" ] && echo "Provided" || echo "Not provided")"
    echo ""
    
    read -p "Continue with deployment? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        error "Deployment cancelled"
    fi
}

# Clone repository if not exists
clone_repository() {
    if [ ! -d "evidence-management-system" ]; then
        log "Cloning repository..."
        
        read -p "Enter repository URL (or press Enter for default): " REPO_URL
        if [ -z "$REPO_URL" ]; then
            REPO_URL="https://github.com/your-username/evidence-management-system.git"
        fi
        
        git clone "$REPO_URL"
        success "Repository cloned"
    else
        log "Repository already exists, pulling latest changes..."
        cd evidence-management-system
        git pull
        cd ..
        success "Repository updated"
    fi
}

# Setup SSL certificates
setup_ssl_certificates() {
    log "Setting up SSL certificates..."
    
    cd evidence-management-system
    
    # Create SSL directory
    mkdir -p config/ssl
    
    # Check if certificates exist
    if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
        sudo cp "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" config/ssl/cert.pem
        sudo cp "/etc/letsencrypt/live/$DOMAIN/privkey.pem" config/ssl/private.key
        sudo chown $USER:$USER config/ssl/*
        chmod 600 config/ssl/private.key
        chmod 644 config/ssl/cert.pem
        success "SSL certificates configured"
    else
        warning "SSL certificates not found. Generating self-signed certificates for testing..."
        
        # Generate self-signed certificate for testing
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout config/ssl/private.key \
            -out config/ssl/cert.pem \
            -subj "/C=TH/ST=Bangkok/L=Bangkok/O=School/CN=$DOMAIN"
        
        chmod 600 config/ssl/private.key
        chmod 644 config/ssl/cert.pem
        
        warning "Self-signed certificate generated. Please setup proper SSL certificate later."
    fi
}

# Configure environment variables
configure_environment() {
    log "Configuring environment variables..."
    
    cd evidence-management-system
    
    # Create production environment file
    cat > .env.production << EOF
# Application Configuration
NODE_ENV=production
APP_URL=https://$DOMAIN
PORT=3000

# Database Configuration
DATABASE_URL=postgresql://evidence_user:$DB_PASSWORD@postgres:5432/evidence_management
POSTGRES_PASSWORD=$DB_PASSWORD

# NextAuth Configuration
NEXTAUTH_URL=https://$DOMAIN
NEXTAUTH_SECRET=$NEXTAUTH_SECRET

# File Storage Configuration (MinIO)
STORAGE_ENDPOINT=http://minio:9000
STORAGE_ACCESS_KEY=$MINIO_ACCESS_KEY
STORAGE_SECRET_KEY=$MINIO_SECRET_KEY
STORAGE_BUCKET=evidence-files
STORAGE_REGION=us-east-1

# Email Configuration
RESEND_API_KEY=$RESEND_API_KEY
FROM_EMAIL=noreply@$DOMAIN

# Security Configuration
HTTPS_ENABLED=true
ENABLE_SECURITY_HEADERS=true
ENABLE_AUDIT_LOGGING=true
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=900000
BCRYPT_ROUNDS=12

# Feature Flags
ENABLE_PERFORMANCE_MONITORING=true
ENABLE_FILE_VERSIONING=true
ENABLE_AUTOMATIC_BACKUPS=true

# File Upload Configuration
MAX_FILE_SIZE=104857600
ALLOWED_FILE_TYPES=pdf,doc,docx,xls,xlsx,ppt,pptx,jpg,jpeg,png,gif,txt,zip,rar

# Cache Configuration
CACHE_TTL=3600
API_TIMEOUT=30000

# Backup Configuration
BACKUP_ENABLED=true
BACKUP_RETENTION_DAYS=2555
BACKUP_VERIFICATION=true

# Monitoring Configuration
LOG_LEVEL=info
SENTRY_DSN=

# MinIO Console Configuration
MINIO_CONSOLE_PORT=9001
EOF
    
    success "Environment variables configured"
}

# Update nginx configuration
update_nginx_config() {
    log "Updating nginx configuration..."
    
    # Update domain in nginx config
    sed -i "s/your-domain.com/$DOMAIN/g" config/nginx.conf
    
    success "Nginx configuration updated"
}

# Create necessary directories
create_directories() {
    log "Creating necessary directories..."
    
    mkdir -p uploads logs
    sudo mkdir -p /backups
    sudo chown $USER:$USER /backups
    
    success "Directories created"
}

# Deploy application
deploy_application() {
    log "Deploying application..."
    
    # Make deployment script executable
    chmod +x deploy.sh
    
    # Run deployment
    ./deploy.sh deploy
    
    success "Application deployed"
}

# Setup database
setup_database() {
    log "Setting up database..."
    
    # Wait for services to start
    sleep 60
    
    # Check if services are running
    if ! docker-compose ps | grep -q "Up"; then
        error "Services are not running properly"
    fi
    
    # Run database migrations
    log "Running database migrations..."
    docker-compose exec -T app npm run db:migrate:deploy
    
    # Seed initial data
    log "Seeding initial data..."
    docker-compose exec -T app npm run db:seed
    
    success "Database setup completed"
}

# Setup automated backups
setup_backups() {
    log "Setting up automated backups..."
    
    # Install backup scheduler
    sudo ./scripts/automated-backup-scheduler.sh install
    
    # Run initial backup
    sudo ./scripts/backup.sh
    
    success "Backup system configured"
}

# Verify deployment
verify_deployment() {
    log "Verifying deployment..."
    
    # Check service status
    docker-compose ps
    
    # Test health endpoint
    sleep 30
    if curl -f -k "https://$DOMAIN/api/health" > /dev/null 2>&1; then
        success "Health endpoint is responding"
    else
        warning "Health endpoint is not responding yet"
    fi
    
    # Check logs for errors
    if docker-compose logs app | grep -i error | tail -5; then
        warning "Some errors found in logs (check above)"
    fi
    
    success "Deployment verification completed"
}

# Display deployment summary
display_summary() {
    echo ""
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                 Deployment Complete!                        ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo ""
    echo "Application Details:"
    echo "• URL: https://$DOMAIN"
    echo "• Admin Email: admin@school.edu"
    echo "• Admin Password: admin123 (change after first login)"
    echo ""
    echo "Service Status:"
    docker-compose ps
    echo ""
    echo "Generated Credentials (SAVE THESE SECURELY):"
    echo "• Database Password: $DB_PASSWORD"
    echo "• NextAuth Secret: $NEXTAUTH_SECRET"
    echo "• MinIO Access Key: $MINIO_ACCESS_KEY"
    echo "• MinIO Secret Key: $MINIO_SECRET_KEY"
    echo ""
    echo "Useful Commands:"
    echo "• Check status: ./deploy.sh status"
    echo "• View logs: ./deploy.sh logs app"
    echo "• Create backup: sudo ./scripts/backup.sh"
    echo "• Monitor system: ~/monitor.sh"
    echo ""
    echo "Next Steps:"
    echo "1. Visit https://$DOMAIN and login"
    echo "2. Change default admin password"
    echo "3. Configure users and academic years"
    echo "4. Test file upload functionality"
    echo "5. Setup monitoring alerts"
    echo ""
    warning "Save the generated credentials in a secure location!"
}

# Main execution
main() {
    log "Starting Evidence Management System deployment"
    
    check_user
    get_configuration
    clone_repository
    setup_ssl_certificates
    configure_environment
    update_nginx_config
    create_directories
    deploy_application
    setup_database
    setup_backups
    verify_deployment
    display_summary
    
    success "Deployment completed successfully!"
    echo ""
    echo "Access your application at: https://$DOMAIN"
}

# Error handling
trap 'error "Deployment failed at line $LINENO"' ERR

# Run main function
main "$@"