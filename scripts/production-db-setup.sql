-- Production Database Setup and Optimization Script
-- This script should be run after initial database creation

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create optimized indexes for production performance
-- User table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_active ON users(email) WHERE is_active = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role_active ON users(role) WHERE is_active = true AND deleted_at IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_created_at ON users(created_at);

-- Evidence table indexes (most critical for performance)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_evidence_uploader_year ON evidence(uploader_id, academic_year_id) WHERE deleted_at IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_evidence_subindicator_latest ON evidence(sub_indicator_id, is_latest) WHERE deleted_at IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_evidence_uploaded_at ON evidence(uploaded_at) WHERE deleted_at IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_evidence_storage_key ON evidence(storage_key) WHERE deleted_at IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_evidence_filename_search ON evidence USING gin(to_tsvector('english', original_name)) WHERE deleted_at IS NULL;

-- Evaluation table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_evaluations_evidence_evaluator ON evaluations(evidence_id, evaluator_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_evaluations_evaluator_date ON evaluations(evaluator_id, evaluated_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_evaluations_evidence_date ON evaluations(evidence_id, evaluated_at);

-- Academic year indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_academic_years_active ON academic_years(is_active, start_date, end_date);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_academic_years_windows ON academic_years(upload_window_open, evaluation_window_open);

-- Sub-indicator indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sub_indicators_owner ON sub_indicators(owner_id) WHERE owner_id IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sub_indicators_indicator ON sub_indicators(indicator_id);

-- Notification indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read, created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_scheduled ON notifications(scheduled_for) WHERE scheduled_for IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_type_created ON notifications(type, created_at);

-- Audit log indexes (for compliance and monitoring)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_user_timestamp ON audit_logs(user_id, timestamp);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_action_timestamp ON audit_logs(action, timestamp);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_resource_timestamp ON audit_logs(resource, resource_id, timestamp);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_timestamp_only ON audit_logs(timestamp);

-- Partial indexes for soft-deleted records
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_evidence_deleted ON evidence(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_deleted ON users(deleted_at) WHERE deleted_at IS NOT NULL;

-- Database configuration optimizations for production
-- Connection and memory settings
ALTER SYSTEM SET max_connections = '200';
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = '0.9';
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = '100';
ALTER SYSTEM SET random_page_cost = '1.1';
ALTER SYSTEM SET effective_io_concurrency = '200';

-- Query optimization settings
ALTER SYSTEM SET work_mem = '4MB';
ALTER SYSTEM SET max_worker_processes = '8';
ALTER SYSTEM SET max_parallel_workers_per_gather = '2';
ALTER SYSTEM SET max_parallel_workers = '8';
ALTER SYSTEM SET max_parallel_maintenance_workers = '2';

-- Logging and monitoring
ALTER SYSTEM SET log_destination = 'stderr';
ALTER SYSTEM SET logging_collector = 'on';
ALTER SYSTEM SET log_directory = 'pg_log';
ALTER SYSTEM SET log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log';
ALTER SYSTEM SET log_rotation_age = '1d';
ALTER SYSTEM SET log_rotation_size = '100MB';
ALTER SYSTEM SET log_min_duration_statement = '1000ms';
ALTER SYSTEM SET log_checkpoints = 'on';
ALTER SYSTEM SET log_connections = 'on';
ALTER SYSTEM SET log_disconnections = 'on';
ALTER SYSTEM SET log_lock_waits = 'on';
ALTER SYSTEM SET log_temp_files = '0';

-- Security settings
ALTER SYSTEM SET ssl = 'on';
ALTER SYSTEM SET password_encryption = 'scram-sha-256';
ALTER SYSTEM SET row_security = 'on';

-- Reload configuration
SELECT pg_reload_conf();

-- Create database maintenance functions
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs(retention_days INTEGER DEFAULT 2555) -- ~7 years
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM audit_logs 
    WHERE timestamp < NOW() - INTERVAL '1 day' * retention_days;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Log the cleanup action
    INSERT INTO audit_logs (action, resource, metadata, timestamp)
    VALUES ('SYSTEM_CONFIG', 'audit_logs', 
            json_build_object('action', 'cleanup', 'deleted_count', deleted_count, 'retention_days', retention_days),
            NOW());
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION cleanup_old_notifications(retention_days INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM notifications 
    WHERE created_at < NOW() - INTERVAL '1 day' * retention_days
    AND is_read = true;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Log the cleanup action
    INSERT INTO audit_logs (action, resource, metadata, timestamp)
    VALUES ('SYSTEM_CONFIG', 'notifications', 
            json_build_object('action', 'cleanup', 'deleted_count', deleted_count, 'retention_days', retention_days),
            NOW());
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION permanent_delete_evidence(retention_days INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM evidence 
    WHERE deleted_at IS NOT NULL 
    AND deleted_at < NOW() - INTERVAL '1 day' * retention_days;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Log the cleanup action
    INSERT INTO audit_logs (action, resource, metadata, timestamp)
    VALUES ('SYSTEM_CONFIG', 'evidence', 
            json_build_object('action', 'permanent_delete', 'deleted_count', deleted_count, 'retention_days', retention_days),
            NOW());
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create monitoring views
CREATE OR REPLACE VIEW v_database_performance AS
SELECT 
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation,
    most_common_vals,
    most_common_freqs
FROM pg_stats 
WHERE schemaname = 'public'
ORDER BY tablename, attname;

CREATE OR REPLACE VIEW v_slow_queries AS
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    rows,
    100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
FROM pg_stat_statements 
ORDER BY total_time DESC
LIMIT 20;

-- Grant permissions for monitoring
GRANT SELECT ON v_database_performance TO evidence_user;
GRANT SELECT ON v_slow_queries TO evidence_user;
GRANT EXECUTE ON FUNCTION cleanup_old_audit_logs(INTEGER) TO evidence_user;
GRANT EXECUTE ON FUNCTION cleanup_old_notifications(INTEGER) TO evidence_user;
GRANT EXECUTE ON FUNCTION permanent_delete_evidence(INTEGER) TO evidence_user;

-- Create scheduled maintenance (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-audit-logs', '0 2 * * 0', 'SELECT cleanup_old_audit_logs();');
-- SELECT cron.schedule('cleanup-notifications', '0 3 * * 0', 'SELECT cleanup_old_notifications();');
-- SELECT cron.schedule('cleanup-evidence', '0 4 * * 0', 'SELECT permanent_delete_evidence();');

COMMENT ON FUNCTION cleanup_old_audit_logs IS 'Cleans up audit logs older than specified retention period (default 7 years)';
COMMENT ON FUNCTION cleanup_old_notifications IS 'Cleans up read notifications older than specified retention period (default 90 days)';
COMMENT ON FUNCTION permanent_delete_evidence IS 'Permanently deletes soft-deleted evidence older than specified retention period (default 90 days)';