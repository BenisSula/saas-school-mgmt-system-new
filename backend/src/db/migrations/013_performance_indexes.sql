-- Phase 7: Database Indexing & Performance Optimization
-- Add missing indexes for common query patterns

-- ============================================================================
-- 1. Index on shared.users(email)
-- ============================================================================
-- Note: UNIQUE constraint on email already creates an index, but we'll verify
-- and create explicitly if needed for clarity and to ensure it exists
CREATE INDEX IF NOT EXISTS shared_users_email_idx ON shared.users(email);

-- ============================================================================
-- 2. Index on shared.users(tenant_id, role)
-- ============================================================================
-- Critical for queries filtering users by tenant and role (e.g., "get all admins in tenant")
-- This is a composite index that supports queries filtering by tenant_id alone or tenant_id + role
CREATE INDEX IF NOT EXISTS shared_users_tenant_role_idx 
  ON shared.users(tenant_id, role)
  WHERE tenant_id IS NOT NULL;

-- ============================================================================
-- 3. Enhanced index on pending_profile_data
-- ============================================================================
-- The existing partial index covers (tenant_id, status) WHERE pending_profile_data IS NOT NULL
-- We'll add a more specific index for common query patterns
CREATE INDEX IF NOT EXISTS shared_users_pending_profile_tenant_role_idx
  ON shared.users(tenant_id, role, status)
  WHERE pending_profile_data IS NOT NULL;

-- Also add a GIN index for JSONB queries on pending_profile_data
CREATE INDEX IF NOT EXISTS shared_users_pending_profile_data_gin_idx
  ON shared.users USING GIN (pending_profile_data)
  WHERE pending_profile_data IS NOT NULL;

-- ============================================================================
-- 4. Index on shared.tenants(schema_name)
-- ============================================================================
-- Note: UNIQUE constraint on schema_name already creates an index, but we'll verify
-- This is critical for tenant resolution queries
CREATE INDEX IF NOT EXISTS shared_tenants_schema_name_idx 
  ON shared.tenants(schema_name);

-- Also add index on domain for tenant lookup by domain
CREATE INDEX IF NOT EXISTS shared_tenants_domain_idx 
  ON shared.tenants(domain)
  WHERE domain IS NOT NULL;

-- ============================================================================
-- 5. Additional performance indexes
-- ============================================================================

-- Index for user lookups by tenant_id and status (common for pending user lists)
-- Note: This may overlap with existing index, but ensures optimal performance
CREATE INDEX IF NOT EXISTS shared_users_tenant_status_role_idx
  ON shared.users(tenant_id, status, role)
  WHERE tenant_id IS NOT NULL;

-- Index for refresh token lookups with user join
CREATE INDEX IF NOT EXISTS shared_refresh_tokens_user_id_expires_idx
  ON shared.refresh_tokens(user_id, expires_at);

-- Index for email verification token lookups
CREATE INDEX IF NOT EXISTS shared_email_verification_tokens_user_id_expires_idx
  ON shared.email_verification_tokens(user_id, expires_at);

-- Index for password reset token lookups
CREATE INDEX IF NOT EXISTS shared_password_reset_tokens_user_id_expires_idx
  ON shared.password_reset_tokens(user_id, expires_at);

-- ============================================================================
-- 6. Analyze tables to update statistics
-- ============================================================================
-- This helps PostgreSQL query planner make better decisions
ANALYZE shared.users;
ANALYZE shared.tenants;
ANALYZE shared.refresh_tokens;
ANALYZE shared.email_verification_tokens;
ANALYZE shared.password_reset_tokens;

