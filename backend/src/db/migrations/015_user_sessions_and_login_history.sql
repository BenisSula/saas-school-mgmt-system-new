-- User Sessions and Login History Tracking
-- Enables superuser to track user logins, sessions, and login attempts across the platform
--
-- Note: This complements existing shared.sessions (token-based) and shared.failed_login_attempts
-- - shared.sessions: Token sessions for authentication (JWT refresh tokens)
-- - shared.user_sessions: Login session events (login/logout tracking for audit)
-- - shared.login_attempts: Comprehensive login attempt tracking (successful + failed)
-- - shared.failed_login_attempts: Legacy table for failed attempts only (can be deprecated)

-- User Sessions Table
-- Tracks active and historical user login/logout events with IP, device, and timing information
-- This is separate from shared.sessions which tracks token-based authentication sessions
-- Note: This migration enhances the existing shared.user_sessions table from migration 003

-- Add new columns to existing user_sessions table if they don't exist
DO $$
BEGIN
  -- Add tenant_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'shared' AND table_name = 'user_sessions' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE shared.user_sessions ADD COLUMN tenant_id UUID REFERENCES shared.tenants(id) ON DELETE SET NULL;
  END IF;

  -- Add ip_address if it doesn't exist (complements existing login_ip/logout_ip)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'shared' AND table_name = 'user_sessions' AND column_name = 'ip_address'
  ) THEN
    ALTER TABLE shared.user_sessions ADD COLUMN ip_address INET;
  END IF;

  -- Add user_agent if it doesn't exist (complements existing login_user_agent/logout_user_agent)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'shared' AND table_name = 'user_sessions' AND column_name = 'user_agent'
  ) THEN
    ALTER TABLE shared.user_sessions ADD COLUMN user_agent TEXT;
  END IF;

  -- Add device_info if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'shared' AND table_name = 'user_sessions' AND column_name = 'device_info'
  ) THEN
    ALTER TABLE shared.user_sessions ADD COLUMN device_info JSONB DEFAULT '{}'::jsonb;
  END IF;

  -- Add expires_at if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'shared' AND table_name = 'user_sessions' AND column_name = 'expires_at'
  ) THEN
    ALTER TABLE shared.user_sessions ADD COLUMN expires_at TIMESTAMPTZ;
  END IF;

  -- Add is_active if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'shared' AND table_name = 'user_sessions' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE shared.user_sessions ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;
  END IF;

  -- Add created_at if it doesn't exist (use login_at as default)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'shared' AND table_name = 'user_sessions' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE shared.user_sessions ADD COLUMN created_at TIMESTAMPTZ;
    -- Set default for new rows
    ALTER TABLE shared.user_sessions ALTER COLUMN created_at SET DEFAULT NOW();
    -- Backfill existing records
    UPDATE shared.user_sessions SET created_at = login_at WHERE created_at IS NULL;
    -- Make NOT NULL after backfill
    ALTER TABLE shared.user_sessions ALTER COLUMN created_at SET NOT NULL;
  END IF;

  -- Add updated_at if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'shared' AND table_name = 'user_sessions' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE shared.user_sessions ADD COLUMN updated_at TIMESTAMPTZ;
    -- Set default for new rows
    ALTER TABLE shared.user_sessions ALTER COLUMN updated_at SET DEFAULT NOW();
    -- Backfill existing records
    UPDATE shared.user_sessions SET updated_at = COALESCE(logout_at, login_at) WHERE updated_at IS NULL;
    -- Make NOT NULL after backfill
    ALTER TABLE shared.user_sessions ALTER COLUMN updated_at SET NOT NULL;
  END IF;
END $$;

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON shared.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_tenant_id ON shared.user_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON shared.user_sessions(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_user_sessions_login_at ON shared.user_sessions(login_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_active ON shared.user_sessions(user_id, is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON shared.user_sessions(expires_at) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_user_sessions_ip_address ON shared.user_sessions(ip_address);

-- Login Attempts Table
-- Tracks all login attempts (successful and failed) for security monitoring
-- This complements shared.failed_login_attempts by tracking both successful and failed attempts
-- Note: shared.failed_login_attempts exists but only tracks failures
CREATE TABLE IF NOT EXISTS shared.login_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  user_id UUID REFERENCES shared.users(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES shared.tenants(id) ON DELETE SET NULL,
  ip_address INET,
  user_agent TEXT,
  success BOOLEAN NOT NULL,
  failure_reason TEXT,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying and security analysis
CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON shared.login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_login_attempts_user_id ON shared.login_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_login_attempts_tenant_id ON shared.login_attempts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_login_attempts_attempted_at ON shared.login_attempts(attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_address ON shared.login_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_login_attempts_success ON shared.login_attempts(success);
CREATE INDEX IF NOT EXISTS idx_login_attempts_failed ON shared.login_attempts(email, ip_address, attempted_at) WHERE success = FALSE;

-- Add updated_at trigger for user_sessions
CREATE OR REPLACE FUNCTION update_user_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_user_sessions_updated_at ON shared.user_sessions;
CREATE TRIGGER trigger_user_sessions_updated_at
  BEFORE UPDATE ON shared.user_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_user_sessions_updated_at();

