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

-- Students table indexes
CREATE INDEX IF NOT EXISTS idx_students_class_id 
ON {{schema}}.students(class_id) 
WHERE class_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_students_enrollment_status 
ON {{schema}}.students(enrollment_status) 
WHERE enrollment_status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_students_created_at 
ON {{schema}}.students(created_at DESC);

-- Teachers table indexes
CREATE INDEX IF NOT EXISTS idx_teachers_email 
ON {{schema}}.teachers(email);

CREATE INDEX IF NOT EXISTS idx_teachers_created_at 
ON {{schema}}.teachers(created_at DESC);

-- Classes table indexes
CREATE INDEX IF NOT EXISTS idx_classes_created_at 
ON {{schema}}.classes(created_at DESC);

-- Grades table indexes (if exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = '{{schema}}' AND table_name = 'grades'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_grades_class_id 
    ON {{schema}}.grades(class_id) 
    WHERE class_id IS NOT NULL;
    
    CREATE INDEX IF NOT EXISTS idx_grades_student_id 
    ON {{schema}}.grades(student_id) 
    WHERE student_id IS NOT NULL;
    
    CREATE INDEX IF NOT EXISTS idx_grades_subject_id 
    ON {{schema}}.grades(subject_id) 
    WHERE subject_id IS NOT NULL;
    
    CREATE INDEX IF NOT EXISTS idx_grades_created_at 
    ON {{schema}}.grades(created_at DESC);
  END IF;
END $$;

-- Fee invoices table indexes
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = '{{schema}}' AND table_name = 'fee_invoices'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_fee_invoices_student_id 
    ON {{schema}}.fee_invoices(student_id) 
    WHERE student_id IS NOT NULL;
    
    CREATE INDEX IF NOT EXISTS idx_fee_invoices_status 
    ON {{schema}}.fee_invoices(status);
    
    CREATE INDEX IF NOT EXISTS idx_fee_invoices_due_date 
    ON {{schema}}.fee_invoices(due_date) 
    WHERE due_date IS NOT NULL;
  END IF;
END $$;

