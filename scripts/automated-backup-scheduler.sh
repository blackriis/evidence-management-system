#!/bin/bash

# Automated Backup Scheduler for Evidence Management System
# This script sets up and manages automated backup schedules

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_SCRIPT="$SCRIPT_DIR/backup.sh"
VERIFICATION_SCRIPT="$SCRIPT_DIR/backup-verification.sh"
CRON_USER="root"
LOG_FILE="/var/log/evidence-backup-scheduler.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
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

# Check if running as root
check_permissions() {
    if [ "$EUID" -ne 0 ]; then
        error "This script must be run as root to manage cron jobs"
    fi
}

# Install backup schedules
install_backup_schedules() {
    log "Installing automated backup schedules..."
    
    # Create backup for current crontab
    crontab -l > /tmp/crontab_backup_$(date +%Y%m%d_%H%M%S) 2>/dev/null || true
    
    # Create new crontab entries
    cat > /tmp/evidence_backup_cron << EOF
# Evidence Management System Automated Backups
# Generated on $(date)

# Daily full backup at 2:00 AM
0 2 * * * $BACKUP_SCRIPT > /var/log/evidence-backup-daily.log 2>&1

# Incremental backup every 4 hours (6 AM, 10 AM, 2 PM, 6 PM, 10 PM)
0 6,10,14,18,22 * * * $BACKUP_SCRIPT --incremental > /var/log/evidence-backup-incremental.log 2>&1

# Weekly backup verification on Sundays at 3:00 AM
0 3 * * 0 $VERIFICATION_SCRIPT > /var/log/evidence-backup-verification.log 2>&1

# Monthly full system backup on the 1st of each month at 1:00 AM
0 1 1 * * $BACKUP_SCRIPT --full-system > /var/log/evidence-backup-monthly.log 2>&1

# Quarterly disaster recovery test on the 1st of Jan, Apr, Jul, Oct at 4:00 AM
0 4 1 1,4,7,10 * $SCRIPT_DIR/disaster-recovery-test.sh > /var/log/evidence-dr-test.log 2>&1

# Daily cleanup of old logs (keep 30 days)
0 5 * * * find /var/log -name "evidence-backup-*.log" -mtime +30 -delete

# Weekly backup space monitoring on Mondays at 6:00 AM
0 6 * * 1 $SCRIPT_DIR/backup-space-monitor.sh > /var/log/evidence-backup-space.log 2>&1

EOF
    
    # Install new crontab
    crontab /tmp/evidence_backup_cron
    
    # Cleanup temporary file
    rm /tmp/evidence_backup_cron
    
    success "Backup schedules installed successfully"
}

# Create backup space monitoring script
create_space_monitor() {
    log "Creating backup space monitoring script..."
    
    cat > "$SCRIPT_DIR/backup-space-monitor.sh" << 'EOF'
#!/bin/bash

# Backup Space Monitoring Script
# Monitors backup storage usage and sends alerts

BACKUP_DIR="/backups"
THRESHOLD_PERCENT=80
CRITICAL_PERCENT=90
ALERT_EMAIL="${ADMIN_EMAIL:-admin@school.edu}"

# Get disk usage
USAGE=$(df "$BACKUP_DIR" | awk 'NR==2 {print $5}' | sed 's/%//')

if [ "$USAGE" -ge "$CRITICAL_PERCENT" ]; then
    echo "CRITICAL: Backup storage is ${USAGE}% full" | \
    mail -s "CRITICAL: Backup Storage Almost Full" "$ALERT_EMAIL"
elif [ "$USAGE" -ge "$THRESHOLD_PERCENT" ]; then
    echo "WARNING: Backup storage is ${USAGE}% full" | \
    mail -s "WARNING: Backup Storage High Usage" "$ALERT_EMAIL"
fi

echo "Backup storage usage: ${USAGE}%"
EOF
    
    chmod +x "$SCRIPT_DIR/backup-space-monitor.sh"
    success "Backup space monitoring script created"
}

# Create disaster recovery test script
create_dr_test_script() {
    log "Creating disaster recovery test script..."
    
    cat > "$SCRIPT_DIR/disaster-recovery-test.sh" << 'EOF'
#!/bin/bash

# Quarterly Disaster Recovery Test Script
# Performs automated DR testing and reporting

set -e

LOG_FILE="/var/log/evidence-dr-test-$(date +%Y%m%d).log"
REPORT_EMAIL="${ADMIN_EMAIL:-admin@school.edu}"

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Test 1: Backup integrity verification
log "Starting quarterly disaster recovery test"
log "Test 1: Backup integrity verification"

if ./backup-verification.sh; then
    log "✓ Backup integrity test passed"
    BACKUP_TEST="PASSED"
else
    log "✗ Backup integrity test failed"
    BACKUP_TEST="FAILED"
fi

# Test 2: Database restoration simulation
log "Test 2: Database restoration simulation"

# Create test database for restoration
TEST_DB="evidence_dr_test_$(date +%s)"
if psql -h postgres -U evidence_user -d postgres -c "CREATE DATABASE $TEST_DB;"; then
    log "✓ Test database created: $TEST_DB"
    
    # Find latest backup
    LATEST_BACKUP=$(find /backups -name "evidence-management-system_*" -type d | sort -r | head -n 1)
    
    if [ -n "$LATEST_BACKUP" ] && [ -f "$LATEST_BACKUP/database/full_backup.dump" ]; then
        if pg_restore -h postgres -U evidence_user -d "$TEST_DB" "$LATEST_BACKUP/database/full_backup.dump" 2>/dev/null; then
            log "✓ Database restoration test passed"
            DB_RESTORE_TEST="PASSED"
        else
            log "✗ Database restoration test failed"
            DB_RESTORE_TEST="FAILED"
        fi
    else
        log "✗ No backup found for restoration test"
        DB_RESTORE_TEST="FAILED"
    fi
    
    # Cleanup test database
    psql -h postgres -U evidence_user -d postgres -c "DROP DATABASE $TEST_DB;" 2>/dev/null || true
else
    log "✗ Failed to create test database"
    DB_RESTORE_TEST="FAILED"
fi

# Test 3: File restoration simulation
log "Test 3: File restoration simulation"

if [ -n "$LATEST_BACKUP" ] && [ -f "$LATEST_BACKUP/files/uploads.tar.gz" ]; then
    TEST_DIR="/tmp/dr_test_$(date +%s)"
    mkdir -p "$TEST_DIR"
    
    if tar -xzf "$LATEST_BACKUP/files/uploads.tar.gz" -C "$TEST_DIR" 2>/dev/null; then
        log "✓ File restoration test passed"
        FILE_RESTORE_TEST="PASSED"
    else
        log "✗ File restoration test failed"
        FILE_RESTORE_TEST="FAILED"
    fi
    
    rm -rf "$TEST_DIR"
else
    log "✗ No file backup found for restoration test"
    FILE_RESTORE_TEST="FAILED"
fi

# Generate test report
REPORT_FILE="/tmp/dr_test_report_$(date +%Y%m%d).txt"
cat > "$REPORT_FILE" << REPORT_EOF
Quarterly Disaster Recovery Test Report
======================================

Test Date: $(date +'%Y-%m-%d %H:%M:%S')
Test Duration: Automated quarterly test

Test Results:
- Backup Integrity: $BACKUP_TEST
- Database Restoration: $DB_RESTORE_TEST
- File Restoration: $FILE_RESTORE_TEST

Overall Status: $([ "$BACKUP_TEST" = "PASSED" ] && [ "$DB_RESTORE_TEST" = "PASSED" ] && [ "$FILE_RESTORE_TEST" = "PASSED" ] && echo "PASSED" || echo "FAILED")

Recommendations:
$([ "$BACKUP_TEST" = "FAILED" ] && echo "- Review backup procedures and integrity checks")
$([ "$DB_RESTORE_TEST" = "FAILED" ] && echo "- Investigate database backup and restoration process")
$([ "$FILE_RESTORE_TEST" = "FAILED" ] && echo "- Check file backup and storage systems")

Next Test Due: $(date -d '+3 months' +'%Y-%m-%d')

Detailed logs available at: $LOG_FILE

System Administrator
Evidence Management System
REPORT_EOF

# Send report via email
if command -v mail &> /dev/null; then
    mail -s "Quarterly DR Test Report - $(date +'%Y-%m-%d')" "$REPORT_EMAIL" < "$REPORT_FILE"
    log "DR test report sent to $REPORT_EMAIL"
else
    log "Mail command not available, report saved to $REPORT_FILE"
fi

log "Quarterly disaster recovery test completed"
EOF
    
    chmod +x "$SCRIPT_DIR/disaster-recovery-test.sh"
    success "Disaster recovery test script created"
}

# Create backup notification script
create_notification_script() {
    log "Creating backup notification script..."
    
    cat > "$SCRIPT_DIR/backup-notification.sh" << 'EOF'
#!/bin/bash

# Backup Notification Script
# Sends notifications about backup status

BACKUP_LOG="/var/log/evidence-backup-daily.log"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@school.edu}"
WEBHOOK_URL="${BACKUP_WEBHOOK_URL:-}"

# Check if backup was successful
if tail -n 20 "$BACKUP_LOG" | grep -q "SUCCESS.*Backup completed successfully"; then
    STATUS="SUCCESS"
    MESSAGE="Daily backup completed successfully"
    
    # Get backup details
    BACKUP_SIZE=$(tail -n 50 "$BACKUP_LOG" | grep -o "Size: [^)]*" | tail -n 1 | cut -d' ' -f2-)
    BACKUP_PATH=$(tail -n 50 "$BACKUP_LOG" | grep -o "Backup completed successfully: [^)]*" | tail -n 1 | cut -d':' -f2- | xargs)
    
    DETAILS="Backup Size: $BACKUP_SIZE\nBackup Location: $BACKUP_PATH"
else
    STATUS="FAILED"
    MESSAGE="Daily backup failed"
    DETAILS="Check backup logs for details: $BACKUP_LOG"
fi

# Send email notification
if command -v mail &> /dev/null; then
    echo -e "$MESSAGE\n\n$DETAILS\n\nTimestamp: $(date)" | \
    mail -s "Evidence Management System - Backup $STATUS" "$ADMIN_EMAIL"
fi

# Send webhook notification (if configured)
if [ -n "$WEBHOOK_URL" ]; then
    curl -X POST "$WEBHOOK_URL" \
         -H "Content-Type: application/json" \
         -d "{\"text\":\"📦 Evidence Management System Backup $STATUS\\n$MESSAGE\\n$DETAILS\"}" \
         2>/dev/null || true
fi

echo "Backup notification sent: $STATUS"
EOF
    
    chmod +x "$SCRIPT_DIR/backup-notification.sh"
    success "Backup notification script created"
}

# Update backup script to include notifications
update_backup_script() {
    log "Updating backup script to include notifications..."
    
    # Add notification call to backup script
    if ! grep -q "backup-notification.sh" "$BACKUP_SCRIPT"; then
        cat >> "$BACKUP_SCRIPT" << 'EOF'

# Send backup notification
if [ -f "$(dirname "$0")/backup-notification.sh" ]; then
    "$(dirname "$0")/backup-notification.sh" &
fi
EOF
        success "Backup script updated with notification support"
    else
        log "Backup script already includes notification support"
    fi
}

# Create log rotation configuration
create_log_rotation() {
    log "Creating log rotation configuration..."
    
    cat > /etc/logrotate.d/evidence-backup << 'EOF'
/var/log/evidence-backup-*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 root root
    postrotate
        # Restart rsyslog if needed
        /bin/kill -HUP `cat /var/run/rsyslogd.pid 2> /dev/null` 2> /dev/null || true
    endscript
}

/var/log/evidence-dr-test-*.log {
    monthly
    rotate 12
    compress
    delaycompress
    missingok
    notifempty
    create 644 root root
}
EOF
    
    success "Log rotation configuration created"
}

# Verify backup schedule installation
verify_installation() {
    log "Verifying backup schedule installation..."
    
    # Check if cron jobs are installed
    if crontab -l | grep -q "Evidence Management System"; then
        success "Backup schedules are installed"
        
        # Display installed schedules
        log "Installed backup schedules:"
        crontab -l | grep -A 20 "Evidence Management System"
    else
        error "Backup schedules are not installed"
    fi
    
    # Check if scripts are executable
    local scripts=(
        "$BACKUP_SCRIPT"
        "$VERIFICATION_SCRIPT"
        "$SCRIPT_DIR/backup-space-monitor.sh"
        "$SCRIPT_DIR/disaster-recovery-test.sh"
        "$SCRIPT_DIR/backup-notification.sh"
    )
    
    for script in "${scripts[@]}"; do
        if [ -x "$script" ]; then
            success "Script is executable: $(basename "$script")"
        else
            warning "Script is not executable: $(basename "$script")"
        fi
    done
    
    # Check backup directory
    if [ -d "/backups" ]; then
        success "Backup directory exists: /backups"
        
        # Check permissions
        if [ -w "/backups" ]; then
            success "Backup directory is writable"
        else
            warning "Backup directory is not writable"
        fi
    else
        warning "Backup directory does not exist: /backups"
        log "Creating backup directory..."
        mkdir -p /backups
        chmod 755 /backups
        success "Backup directory created"
    fi
}

# Remove backup schedules
remove_backup_schedules() {
    log "Removing backup schedules..."
    
    # Create backup of current crontab
    crontab -l > /tmp/crontab_backup_$(date +%Y%m%d_%H%M%S) 2>/dev/null || true
    
    # Remove Evidence Management System entries
    crontab -l 2>/dev/null | grep -v "Evidence Management System" | grep -v "$BACKUP_SCRIPT" | grep -v "$VERIFICATION_SCRIPT" | crontab -
    
    success "Backup schedules removed"
}

# Show current backup schedules
show_schedules() {
    log "Current backup schedules:"
    
    if crontab -l 2>/dev/null | grep -q "Evidence Management System"; then
        crontab -l | grep -A 20 "Evidence Management System"
    else
        log "No Evidence Management System backup schedules found"
    fi
}

# Test backup schedule
test_backup() {
    log "Testing backup execution..."
    
    if [ -x "$BACKUP_SCRIPT" ]; then
        log "Running backup script test..."
        "$BACKUP_SCRIPT" --test
        success "Backup test completed"
    else
        error "Backup script not found or not executable: $BACKUP_SCRIPT"
    fi
}

# Main function
main() {
    case "${1:-install}" in
        "install")
            check_permissions
            install_backup_schedules
            create_space_monitor
            create_dr_test_script
            create_notification_script
            update_backup_script
            create_log_rotation
            verify_installation
            success "Automated backup scheduler installation completed"
            ;;
        "remove")
            check_permissions
            remove_backup_schedules
            success "Backup schedules removed"
            ;;
        "show")
            show_schedules
            ;;
        "verify")
            verify_installation
            ;;
        "test")
            test_backup
            ;;
        *)
            echo "Usage: $0 {install|remove|show|verify|test}"
            echo ""
            echo "Commands:"
            echo "  install - Install automated backup schedules (default)"
            echo "  remove  - Remove backup schedules"
            echo "  show    - Show current backup schedules"
            echo "  verify  - Verify installation"
            echo "  test    - Test backup execution"
            exit 1
            ;;
    esac
}

# Create log directory
mkdir -p "$(dirname "$LOG_FILE")"

# Run main function
main "$@"