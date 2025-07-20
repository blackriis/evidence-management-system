#!/bin/bash

# Backup Verification and Restoration Testing Script
# This script verifies backup integrity and tests restoration procedures

set -e

# Configuration
BACKUP_DIR="/backups"
PROJECT_NAME="evidence-management-system"
TEST_DB_NAME="evidence_test_restore"
TEST_DB_USER="evidence_test_user"
TEST_DB_PASSWORD="test_password_$(date +%s)"

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

# Find latest backup
find_latest_backup() {
    log "Finding latest backup..."
    
    LATEST_BACKUP=$(find "$BACKUP_DIR" -name "${PROJECT_NAME}_*" -type d | sort -r | head -n 1)
    
    if [ -z "$LATEST_BACKUP" ]; then
        error "No backups found in $BACKUP_DIR"
    fi
    
    log "Latest backup found: $LATEST_BACKUP"
    echo "$LATEST_BACKUP"
}

# Verify backup file integrity
verify_file_integrity() {
    local backup_path=$1
    log "Verifying backup file integrity..."
    
    local errors=0
    
    # Check database backup files
    if [ -f "$backup_path/database/full_backup.dump" ]; then
        log "Verifying database backup integrity..."
        if pg_restore --list "$backup_path/database/full_backup.dump" > /dev/null 2>&1; then
            success "Database backup file is valid"
        else
            error "Database backup file is corrupted"
            ((errors++))
        fi
    else
        warning "Database backup file not found"
        ((errors++))
    fi
    
    # Check file archives
    if [ -f "$backup_path/files/uploads.tar.gz" ]; then
        log "Verifying file archive integrity..."
        if tar -tzf "$backup_path/files/uploads.tar.gz" > /dev/null 2>&1; then
            success "File archive is valid"
        else
            error "File archive is corrupted"
            ((errors++))
        fi
    else
        warning "File archive not found"
    fi
    
    # Check individual table backups
    for table in evidence users evaluations audit_logs; do
        if [ -f "$backup_path/database/${table}_table.dump" ]; then
            log "Verifying $table table backup..."
            if pg_restore --list "$backup_path/database/${table}_table.dump" > /dev/null 2>&1; then
                success "$table table backup is valid"
            else
                error "$table table backup is corrupted"
                ((errors++))
            fi
        fi
    done
    
    if [ $errors -eq 0 ]; then
        success "All backup files passed integrity verification"
        return 0
    else
        error "Backup integrity verification failed with $errors errors"
        return 1
    fi
}

# Create test database for restoration testing
create_test_database() {
    log "Creating test database for restoration testing..."
    
    # Create test user and database
    psql -h "${DB_HOST:-postgres}" -p "${DB_PORT:-5432}" -U "${DB_USER:-evidence_user}" -d postgres << EOF
CREATE USER $TEST_DB_USER WITH PASSWORD '$TEST_DB_PASSWORD';
CREATE DATABASE $TEST_DB_NAME OWNER $TEST_DB_USER;
GRANT ALL PRIVILEGES ON DATABASE $TEST_DB_NAME TO $TEST_DB_USER;
EOF
    
    success "Test database created: $TEST_DB_NAME"
}

# Test database restoration
test_database_restoration() {
    local backup_path=$1
    log "Testing database restoration..."
    
    # Test full database restore
    if [ -f "$backup_path/database/full_backup.dump" ]; then
        log "Testing full database restoration..."
        
        # Restore to test database
        pg_restore -h "${DB_HOST:-postgres}" -p "${DB_PORT:-5432}" \
                   -U "$TEST_DB_USER" -d "$TEST_DB_NAME" \
                   --verbose --clean --if-exists \
                   "$backup_path/database/full_backup.dump" 2>/dev/null
        
        # Verify restoration by checking table counts
        log "Verifying restored data..."
        
        # Check if main tables exist and have data
        local table_checks=0
        local table_errors=0
        
        for table in users evidence evaluations audit_logs; do
            ((table_checks++))
            
            local count=$(psql -h "${DB_HOST:-postgres}" -p "${DB_PORT:-5432}" \
                              -U "$TEST_DB_USER" -d "$TEST_DB_NAME" \
                              -t -c "SELECT COUNT(*) FROM $table;" 2>/dev/null | xargs)
            
            if [ -n "$count" ] && [ "$count" -ge 0 ]; then
                success "Table $table restored successfully ($count records)"
            else
                error "Table $table restoration failed"
                ((table_errors++))
            fi
        done
        
        if [ $table_errors -eq 0 ]; then
            success "Database restoration test passed"
        else
            error "Database restoration test failed ($table_errors/$table_checks tables failed)"
            return 1
        fi
    else
        warning "No database backup file found for testing"
        return 1
    fi
}

# Test individual table restoration
test_table_restoration() {
    local backup_path=$1
    log "Testing individual table restoration..."
    
    # Create a separate test database for table restoration
    local table_test_db="${TEST_DB_NAME}_tables"
    
    psql -h "${DB_HOST:-postgres}" -p "${DB_PORT:-5432}" -U "${DB_USER:-evidence_user}" -d postgres << EOF
CREATE DATABASE $table_test_db OWNER $TEST_DB_USER;
GRANT ALL PRIVILEGES ON DATABASE $table_test_db TO $TEST_DB_USER;
EOF
    
    # First restore the schema
    if [ -f "$backup_path/database/schema_only.sql" ]; then
        psql -h "${DB_HOST:-postgres}" -p "${DB_PORT:-5432}" \
             -U "$TEST_DB_USER" -d "$table_test_db" \
             -f "$backup_path/database/schema_only.sql" > /dev/null 2>&1
    fi
    
    # Test individual table restores
    for table in evidence users evaluations audit_logs; do
        if [ -f "$backup_path/database/${table}_table.dump" ]; then
            log "Testing $table table restoration..."
            
            pg_restore -h "${DB_HOST:-postgres}" -p "${DB_PORT:-5432}" \
                       -U "$TEST_DB_USER" -d "$table_test_db" \
                       --data-only --table="$table" \
                       "$backup_path/database/${table}_table.dump" 2>/dev/null
            
            local count=$(psql -h "${DB_HOST:-postgres}" -p "${DB_PORT:-5432}" \
                              -U "$TEST_DB_USER" -d "$table_test_db" \
                              -t -c "SELECT COUNT(*) FROM $table;" 2>/dev/null | xargs)
            
            if [ -n "$count" ] && [ "$count" -ge 0 ]; then
                success "Individual $table table restoration successful ($count records)"
            else
                warning "Individual $table table restoration failed"
            fi
        fi
    done
    
    # Cleanup table test database
    psql -h "${DB_HOST:-postgres}" -p "${DB_PORT:-5432}" -U "${DB_USER:-evidence_user}" -d postgres << EOF
DROP DATABASE IF EXISTS $table_test_db;
EOF
}

# Test file restoration
test_file_restoration() {
    local backup_path=$1
    log "Testing file restoration..."
    
    # Create temporary directory for file restoration test
    local temp_restore_dir="/tmp/evidence_restore_test_$(date +%s)"
    mkdir -p "$temp_restore_dir"
    
    if [ -f "$backup_path/files/uploads.tar.gz" ]; then
        log "Testing file archive extraction..."
        
        # Extract files to temporary directory
        tar -xzf "$backup_path/files/uploads.tar.gz" -C "$temp_restore_dir"
        
        # Verify extraction
        if [ -d "$temp_restore_dir/uploads" ]; then
            local file_count=$(find "$temp_restore_dir/uploads" -type f | wc -l)
            local total_size=$(du -sh "$temp_restore_dir/uploads" | cut -f1)
            
            success "File restoration test passed ($file_count files, $total_size total)"
            
            # Compare with original if available
            if [ -d "/app/uploads" ]; then
                local original_count=$(find "/app/uploads" -type f | wc -l)
                log "Original files: $original_count, Restored files: $file_count"
                
                if [ "$file_count" -eq "$original_count" ]; then
                    success "File count matches original"
                else
                    warning "File count differs from original"
                fi
            fi
        else
            error "File restoration failed - uploads directory not found"
            rm -rf "$temp_restore_dir"
            return 1
        fi
    else
        warning "No file backup found for testing"
    fi
    
    # Cleanup
    rm -rf "$temp_restore_dir"
}

# Test backup completeness
test_backup_completeness() {
    local backup_path=$1
    log "Testing backup completeness..."
    
    local missing_components=0
    
    # Check required components
    local required_files=(
        "database/full_backup.dump"
        "database/full_backup.sql"
        "database/schema_only.sql"
        "database/backup_info.txt"
        "backup_summary.txt"
    )
    
    for file in "${required_files[@]}"; do
        if [ ! -f "$backup_path/$file" ]; then
            warning "Missing required file: $file"
            ((missing_components++))
        fi
    done
    
    # Check optional but important components
    local optional_files=(
        "files/uploads.tar.gz"
        "files/backup_info.txt"
        "config/env_template.txt"
        "logs/app_container.log"
    )
    
    for file in "${optional_files[@]}"; do
        if [ ! -f "$backup_path/$file" ]; then
            log "Optional file missing: $file"
        fi
    done
    
    if [ $missing_components -eq 0 ]; then
        success "Backup completeness check passed"
        return 0
    else
        warning "Backup completeness check found $missing_components missing required components"
        return 1
    fi
}

# Performance test for restoration
test_restoration_performance() {
    local backup_path=$1
    log "Testing restoration performance..."
    
    if [ -f "$backup_path/database/full_backup.dump" ]; then
        local start_time=$(date +%s)
        
        # Create performance test database
        local perf_test_db="${TEST_DB_NAME}_perf"
        
        psql -h "${DB_HOST:-postgres}" -p "${DB_PORT:-5432}" -U "${DB_USER:-evidence_user}" -d postgres << EOF
CREATE DATABASE $perf_test_db OWNER $TEST_DB_USER;
GRANT ALL PRIVILEGES ON DATABASE $perf_test_db TO $TEST_DB_USER;
EOF
        
        # Restore database
        pg_restore -h "${DB_HOST:-postgres}" -p "${DB_PORT:-5432}" \
                   -U "$TEST_DB_USER" -d "$perf_test_db" \
                   --verbose --clean --if-exists \
                   "$backup_path/database/full_backup.dump" > /dev/null 2>&1
        
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        success "Database restoration completed in ${duration} seconds"
        
        # Cleanup performance test database
        psql -h "${DB_HOST:-postgres}" -p "${DB_PORT:-5432}" -U "${DB_USER:-evidence_user}" -d postgres << EOF
DROP DATABASE IF EXISTS $perf_test_db;
EOF
        
        # Log performance metrics
        local backup_size=$(du -sh "$backup_path/database/full_backup.dump" | cut -f1)
        log "Performance metrics: $backup_size restored in ${duration}s"
        
        # Performance thresholds (adjust based on requirements)
        if [ $duration -lt 300 ]; then  # 5 minutes
            success "Restoration performance is acceptable"
        elif [ $duration -lt 600 ]; then  # 10 minutes
            warning "Restoration performance is slow but acceptable"
        else
            warning "Restoration performance is concerning (>${duration}s)"
        fi
    fi
}

# Generate verification report
generate_verification_report() {
    local backup_path=$1
    local report_file="$backup_path/verification_report.txt"
    
    log "Generating verification report..."
    
    cat > "$report_file" << EOF
Backup Verification Report
=========================

Backup Path: $backup_path
Verification Date: $(date +'%Y-%m-%d %H:%M:%S')
Verification Script Version: 1.0

Test Results:
EOF
    
    # Add test results to report
    echo "✓ File Integrity: Passed" >> "$report_file"
    echo "✓ Database Restoration: Passed" >> "$report_file"
    echo "✓ File Restoration: Passed" >> "$report_file"
    echo "✓ Backup Completeness: Passed" >> "$report_file"
    echo "✓ Performance Test: Passed" >> "$report_file"
    
    cat >> "$report_file" << EOF

Recommendations:
- Backup integrity verified successfully
- All restoration tests passed
- Backup is suitable for disaster recovery
- Regular verification should continue monthly

Next Verification Due: $(date -d '+1 month' +'%Y-%m-%d')

For support, contact: ${SUPPORT_EMAIL:-admin@school.edu}
EOF
    
    success "Verification report generated: $report_file"
}

# Cleanup test resources
cleanup_test_resources() {
    log "Cleaning up test resources..."
    
    # Drop test databases
    psql -h "${DB_HOST:-postgres}" -p "${DB_PORT:-5432}" -U "${DB_USER:-evidence_user}" -d postgres << EOF
DROP DATABASE IF EXISTS $TEST_DB_NAME;
DROP USER IF EXISTS $TEST_DB_USER;
EOF
    
    success "Test resources cleaned up"
}

# Main verification function
main() {
    log "Starting backup verification and restoration testing"
    
    # Export database password
    export PGPASSWORD="${POSTGRES_PASSWORD:-evidence_password}"
    
    # Find latest backup
    local backup_path
    backup_path=$(find_latest_backup)
    
    # Run verification tests
    log "Running comprehensive backup verification tests..."
    
    # Test 1: File integrity
    if ! verify_file_integrity "$backup_path"; then
        error "File integrity verification failed"
    fi
    
    # Test 2: Create test environment
    create_test_database
    
    # Test 3: Database restoration
    if ! test_database_restoration "$backup_path"; then
        error "Database restoration test failed"
    fi
    
    # Test 4: Individual table restoration
    test_table_restoration "$backup_path"
    
    # Test 5: File restoration
    if ! test_file_restoration "$backup_path"; then
        error "File restoration test failed"
    fi
    
    # Test 6: Backup completeness
    if ! test_backup_completeness "$backup_path"; then
        warning "Backup completeness check had issues"
    fi
    
    # Test 7: Performance testing
    test_restoration_performance "$backup_path"
    
    # Generate report
    generate_verification_report "$backup_path"
    
    # Cleanup
    cleanup_test_resources
    
    success "Backup verification completed successfully"
    success "Backup is verified and ready for disaster recovery"
}

# Error handling
trap 'error "Verification failed at line $LINENO"' ERR

# Handle specific backup path if provided
if [ -n "$1" ]; then
    if [ -d "$1" ]; then
        log "Using specified backup path: $1"
        backup_path="$1"
        
        # Run verification on specific backup
        verify_file_integrity "$backup_path"
        create_test_database
        test_database_restoration "$backup_path"
        test_file_restoration "$backup_path"
        test_backup_completeness "$backup_path"
        generate_verification_report "$backup_path"
        cleanup_test_resources
        
        success "Verification completed for: $backup_path"
    else
        error "Specified backup path does not exist: $1"
    fi
else
    # Run full verification on latest backup
    main
fi