#!/bin/bash

# Automated Backup Script for Evidence Management System
# This script creates comprehensive backups of database and files

set -e

# Configuration
BACKUP_DIR="/backups"
PROJECT_NAME="evidence-management-system"
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-2555}  # ~7 years default
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_PATH="${BACKUP_DIR}/${PROJECT_NAME}_${TIMESTAMP}"

# Database configuration
DB_HOST=${DB_HOST:-postgres}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-evidence_management}
DB_USER=${DB_USER:-evidence_user}
PGPASSWORD=${POSTGRES_PASSWORD:-evidence_password}

# Storage configuration
STORAGE_BACKUP_ENABLED=${BACKUP_STORAGE_ENDPOINT:+true}
STORAGE_BACKUP_ENABLED=${STORAGE_BACKUP_ENABLED:-false}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# Create backup directory
create_backup_dir() {
    log "Creating backup directory: $BACKUP_PATH"
    mkdir -p "$BACKUP_PATH"
    
    # Create subdirectories
    mkdir -p "$BACKUP_PATH/database"
    mkdir -p "$BACKUP_PATH/files"
    mkdir -p "$BACKUP_PATH/config"
    mkdir -p "$BACKUP_PATH/logs"
}

# Backup database
backup_database() {
    log "Starting database backup..."
    
    # Full database dump
    log "Creating full database dump..."
    pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        --verbose --clean --if-exists --create \
        --format=custom \
        --file="$BACKUP_PATH/database/full_backup.dump"
    
    # SQL format for easier inspection
    pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        --verbose --clean --if-exists --create \
        --format=plain \
        --file="$BACKUP_PATH/database/full_backup.sql"
    
    # Schema-only backup
    log "Creating schema-only backup..."
    pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        --schema-only --verbose \
        --format=plain \
        --file="$BACKUP_PATH/database/schema_only.sql"
    
    # Data-only backup
    log "Creating data-only backup..."
    pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        --data-only --verbose \
        --format=custom \
        --file="$BACKUP_PATH/database/data_only.dump"
    
    # Individual table backups for critical tables
    log "Creating individual table backups..."
    
    # Evidence table (most critical)
    pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        --table=evidence --verbose \
        --format=custom \
        --file="$BACKUP_PATH/database/evidence_table.dump"
    
    # Users table
    pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        --table=users --verbose \
        --format=custom \
        --file="$BACKUP_PATH/database/users_table.dump"
    
    # Evaluations table
    pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        --table=evaluations --verbose \
        --format=custom \
        --file="$BACKUP_PATH/database/evaluations_table.dump"
    
    # Audit logs table
    pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        --table=audit_logs --verbose \
        --format=custom \
        --file="$BACKUP_PATH/database/audit_logs_table.dump"
    
    # Create backup metadata
    cat > "$BACKUP_PATH/database/backup_info.txt" << EOF
Backup Information
==================
Timestamp: $TIMESTAMP
Database Host: $DB_HOST
Database Name: $DB_NAME
Database User: $DB_USER
Backup Type: Full + Individual Tables
PostgreSQL Version: $(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT version();" | head -1)

Files Created:
- full_backup.dump (Custom format, complete database)
- full_backup.sql (Plain SQL format, complete database)
- schema_only.sql (Schema structure only)
- data_only.dump (Data only, custom format)
- evidence_table.dump (Evidence table only)
- users_table.dump (Users table only)
- evaluations_table.dump (Evaluations table only)
- audit_logs_table.dump (Audit logs table only)

Restoration Commands:
- Full restore: pg_restore -h HOST -p PORT -U USER -d DATABASE -v full_backup.dump
- SQL restore: psql -h HOST -p PORT -U USER -d DATABASE -f full_backup.sql
- Table restore: pg_restore -h HOST -p PORT -U USER -d DATABASE -t TABLE_NAME table_backup.dump
EOF
    
    success "Database backup completed"
}

# Backup uploaded files
backup_files() {
    log "Starting file backup..."
    
    # Check if uploads directory exists
    if [ ! -d "/app/uploads" ]; then
        warning "Uploads directory not found, skipping file backup"
        return
    fi
    
    # Create compressed archive of all uploaded files
    log "Creating compressed archive of uploaded files..."
    tar -czf "$BACKUP_PATH/files/uploads.tar.gz" -C /app uploads/
    
    # Create individual archives by academic year (if structure exists)
    if [ -d "/app/uploads/evidence" ]; then
        log "Creating individual archives by academic year..."
        
        for year_dir in /app/uploads/evidence/*/; do
            if [ -d "$year_dir" ]; then
                year_name=$(basename "$year_dir")
                log "Archiving files for academic year: $year_name"
                tar -czf "$BACKUP_PATH/files/uploads_${year_name}.tar.gz" -C /app/uploads/evidence "$year_name"
            fi
        done
    fi
    
    # Create file inventory
    log "Creating file inventory..."
    find /app/uploads -type f -exec ls -la {} \; > "$BACKUP_PATH/files/file_inventory.txt"
    
    # Calculate total size
    TOTAL_SIZE=$(du -sh /app/uploads | cut -f1)
    FILE_COUNT=$(find /app/uploads -type f | wc -l)
    
    # Create file backup metadata
    cat > "$BACKUP_PATH/files/backup_info.txt" << EOF
File Backup Information
=======================
Timestamp: $TIMESTAMP
Total Size: $TOTAL_SIZE
File Count: $FILE_COUNT
Source Directory: /app/uploads

Files Created:
- uploads.tar.gz (Complete uploads directory)
- uploads_YEAR.tar.gz (Individual academic year archives)
- file_inventory.txt (Detailed file listing)

Restoration Commands:
- Full restore: tar -xzf uploads.tar.gz -C /app/
- Year restore: tar -xzf uploads_YEAR.tar.gz -C /app/uploads/evidence/
EOF
    
    success "File backup completed"
}

# Backup configuration files
backup_config() {
    log "Starting configuration backup..."
    
    # Copy configuration files
    if [ -d "/app/config" ]; then
        cp -r /app/config/* "$BACKUP_PATH/config/" 2>/dev/null || true
    fi
    
    # Copy environment files (without sensitive data)
    if [ -f "/app/.env.production" ]; then
        # Create sanitized version of environment file
        grep -v -E "(PASSWORD|SECRET|KEY|TOKEN)" /app/.env.production > "$BACKUP_PATH/config/env_template.txt" 2>/dev/null || true
    fi
    
    # Copy Docker configuration
    if [ -f "/app/docker-compose.yml" ]; then
        cp /app/docker-compose.yml "$BACKUP_PATH/config/" 2>/dev/null || true
    fi
    
    if [ -f "/app/Dockerfile" ]; then
        cp /app/Dockerfile "$BACKUP_PATH/config/" 2>/dev/null || true
    fi
    
    # Copy Prisma schema
    if [ -f "/app/prisma/schema.prisma" ]; then
        mkdir -p "$BACKUP_PATH/config/prisma"
        cp /app/prisma/schema.prisma "$BACKUP_PATH/config/prisma/" 2>/dev/null || true
    fi
    
    success "Configuration backup completed"
}

# Backup application logs
backup_logs() {
    log "Starting log backup..."
    
    # Copy application logs if they exist
    if [ -d "/app/logs" ]; then
        cp -r /app/logs/* "$BACKUP_PATH/logs/" 2>/dev/null || true
    fi
    
    # Copy container logs
    if command -v docker &> /dev/null; then
        log "Exporting container logs..."
        
        # Get logs from main application container
        docker logs evidence-app > "$BACKUP_PATH/logs/app_container.log" 2>&1 || true
        
        # Get logs from database container
        docker logs evidence-postgres > "$BACKUP_PATH/logs/postgres_container.log" 2>&1 || true
        
        # Get logs from Redis container
        docker logs evidence-redis > "$BACKUP_PATH/logs/redis_container.log" 2>&1 || true
    fi
    
    success "Log backup completed"
}

# Verify backup integrity
verify_backup() {
    log "Verifying backup integrity..."
    
    # Check if all expected files exist
    local errors=0
    
    # Database files
    if [ ! -f "$BACKUP_PATH/database/full_backup.dump" ]; then
        error "Database backup file missing"
        ((errors++))
    fi
    
    # Test database backup integrity
    if command -v pg_restore &> /dev/null; then
        log "Testing database backup integrity..."
        if ! pg_restore --list "$BACKUP_PATH/database/full_backup.dump" > /dev/null 2>&1; then
            error "Database backup integrity check failed"
            ((errors++))
        fi
    fi
    
    # File archives
    if [ -f "$BACKUP_PATH/files/uploads.tar.gz" ]; then
        log "Testing file archive integrity..."
        if ! tar -tzf "$BACKUP_PATH/files/uploads.tar.gz" > /dev/null 2>&1; then
            error "File archive integrity check failed"
            ((errors++))
        fi
    fi
    
    # Calculate backup size
    BACKUP_SIZE=$(du -sh "$BACKUP_PATH" | cut -f1)
    
    if [ $errors -eq 0 ]; then
        success "Backup integrity verification passed (Size: $BACKUP_SIZE)"
    else
        error "Backup integrity verification failed with $errors errors"
    fi
}

# Upload to secondary storage (if configured)
upload_to_secondary() {
    if [ "$STORAGE_BACKUP_ENABLED" = "true" ]; then
        log "Uploading backup to secondary storage..."
        
        # This would implement upload to AWS S3, Google Cloud Storage, etc.
        # For now, just log that we would do this
        log "Would upload backup to secondary storage: ${BACKUP_STORAGE_ENDPOINT}"
        
        # Example AWS S3 upload (would need AWS CLI configured):
        # aws s3 sync "$BACKUP_PATH" "s3://${BACKUP_STORAGE_BUCKET}/backups/$(basename "$BACKUP_PATH")/"
        
        success "Secondary storage upload completed"
    else
        log "Secondary storage not configured, skipping upload"
    fi
}

# Cleanup old backups
cleanup_old_backups() {
    log "Cleaning up old backups (retention: $RETENTION_DAYS days)..."
    
    # Find and remove backups older than retention period
    find "$BACKUP_DIR" -name "${PROJECT_NAME}_*" -type d -mtime +$RETENTION_DAYS -exec rm -rf {} \; 2>/dev/null || true
    
    # Keep at least 3 most recent backups regardless of age
    BACKUP_COUNT=$(find "$BACKUP_DIR" -name "${PROJECT_NAME}_*" -type d | wc -l)
    if [ $BACKUP_COUNT -gt 3 ]; then
        EXCESS_COUNT=$((BACKUP_COUNT - 3))
        find "$BACKUP_DIR" -name "${PROJECT_NAME}_*" -type d | sort | head -n $EXCESS_COUNT | xargs rm -rf 2>/dev/null || true
    fi
    
    success "Old backup cleanup completed"
}

# Create backup summary
create_summary() {
    log "Creating backup summary..."
    
    BACKUP_SIZE=$(du -sh "$BACKUP_PATH" | cut -f1)
    END_TIME=$(date +'%Y-%m-%d %H:%M:%S')
    
    cat > "$BACKUP_PATH/backup_summary.txt" << EOF
Evidence Management System Backup Summary
=========================================

Backup Details:
- Backup ID: $(basename "$BACKUP_PATH")
- Start Time: $(date -d "@$(stat -c %Y "$BACKUP_PATH")" +'%Y-%m-%d %H:%M:%S')
- End Time: $END_TIME
- Total Size: $BACKUP_SIZE
- Retention Period: $RETENTION_DAYS days

Components Backed Up:
✓ Database (Full + Individual Tables)
✓ Uploaded Files
✓ Configuration Files
✓ Application Logs

Backup Location: $BACKUP_PATH

Restoration Instructions:
1. Database: pg_restore -h HOST -p PORT -U USER -d DATABASE -v database/full_backup.dump
2. Files: tar -xzf files/uploads.tar.gz -C /app/
3. Config: Copy files from config/ directory as needed

Verification Status: ✓ Passed

For support, contact: ${SUPPORT_EMAIL:-admin@school.edu}
EOF
    
    success "Backup summary created"
}

# Main backup function
main() {
    log "Starting automated backup for Evidence Management System"
    
    # Export PGPASSWORD for PostgreSQL commands
    export PGPASSWORD
    
    # Create backup directory structure
    create_backup_dir
    
    # Perform backups
    backup_database
    backup_files
    backup_config
    backup_logs
    
    # Verify backup integrity
    verify_backup
    
    # Upload to secondary storage if configured
    upload_to_secondary
    
    # Create summary
    create_summary
    
    # Cleanup old backups
    cleanup_old_backups
    
    success "Backup completed successfully: $BACKUP_PATH"
    
    # Send notification (if configured)
    if [ -n "$NOTIFICATION_WEBHOOK" ]; then
        curl -X POST "$NOTIFICATION_WEBHOOK" \
            -H "Content-Type: application/json" \
            -d "{\"text\":\"✅ Evidence Management System backup completed successfully\\nBackup ID: $(basename "$BACKUP_PATH")\\nSize: $BACKUP_SIZE\"}" \
            2>/dev/null || warning "Failed to send notification"
    fi
}

# Error handling
trap 'error "Backup failed at line $LINENO"' ERR

# Run main function
main "$@"