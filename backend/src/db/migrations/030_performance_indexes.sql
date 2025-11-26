-- Migration: Add performance indexes for frequently queried columns
-- Date: 2025-01-23
-- Phase: C2 - API Performance & Database Optimization
--
-- This migration adds indexes to improve query performance for:
-- - Tenant-scoped queries (tenant_id)
-- - User-scoped queries (user_id)
-- - Time-based queries (created_at, updated_at)
-- - Common filter columns (status, role, enrollment_status)

-- Shared schema indexes
-- =====================

-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_tenant_id_status 
ON shared.users(tenant_id, status) 
WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_tenant_id_role 
ON shared.users(tenant_id, role) 
WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_created_at 
ON shared.users(created_at DESC);

-- Audit logs indexes (additional to existing ones)
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created 
ON shared.audit_logs(tenant_id, created_at DESC) 
WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_resource 
ON shared.audit_logs(resource_type, resource_id) 
WHERE resource_type IS NOT NULL AND resource_id IS NOT NULL;

-- Login attempts indexes
CREATE INDEX IF NOT EXISTS idx_login_attempts_tenant_attempted 
ON shared.login_attempts(tenant_id, attempted_at DESC) 
WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_login_attempts_user_attempted 
ON shared.login_attempts(user_id, attempted_at DESC) 
WHERE user_id IS NOT NULL;

-- Additional roles indexes
CREATE INDEX IF NOT EXISTS idx_additional_roles_user_tenant 
ON shared.additional_roles(user_id, tenant_id) 
WHERE user_id IS NOT NULL AND tenant_id IS NOT NULL;

-- Tenant schema indexes (applied to each tenant schema)
-- =====================================================
-- NOTE: Tenant schema indexes are handled by tenant migrations
-- See migrations/tenants/026_add_attendance_indexes.sql and other tenant migration files
-- This migration only handles shared schema indexes

