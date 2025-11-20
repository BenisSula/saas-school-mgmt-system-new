-- Security enhancements: MFA, sessions, password policies, IP whitelisting

-- Multi-Factor Authentication (MFA)
CREATE TABLE IF NOT EXISTS shared.mfa_devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES shared.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('totp', 'sms', 'email', 'backup_code')),
  name TEXT NOT NULL, -- User-friendly name (e.g., "iPhone", "Google Authenticator")
  secret TEXT NOT NULL, -- Encrypted secret for TOTP
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  last_used_at TIMESTAMPTZ,
  backup_codes TEXT[], -- Array of hashed backup codes
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, type, name)
);

CREATE INDEX idx_mfa_devices_user_id ON shared.mfa_devices(user_id);
CREATE INDEX idx_mfa_devices_enabled ON shared.mfa_devices(is_enabled) WHERE is_enabled = TRUE;

-- MFA verification attempts (for rate limiting and security)
CREATE TABLE IF NOT EXISTS shared.mfa_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES shared.users(id) ON DELETE CASCADE,
  device_id UUID REFERENCES shared.mfa_devices(id) ON DELETE SET NULL,
  code TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mfa_attempts_user_id ON shared.mfa_attempts(user_id);
CREATE INDEX idx_mfa_attempts_created_at ON shared.mfa_attempts(created_at);

-- Enhanced session management
CREATE TABLE IF NOT EXISTS shared.sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES shared.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  ip_address TEXT,
  user_agent TEXT,
  device_info JSONB DEFAULT '{}'::jsonb,
  mfa_verified BOOLEAN NOT NULL DEFAULT FALSE,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_user_id ON shared.sessions(user_id);
CREATE INDEX idx_sessions_token_hash ON shared.sessions(token_hash);
CREATE INDEX idx_sessions_expires_at ON shared.sessions(expires_at);
CREATE INDEX idx_sessions_revoked_at ON shared.sessions(revoked_at) WHERE revoked_at IS NULL;

-- Password policies per tenant
CREATE TABLE IF NOT EXISTS shared.password_policies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES shared.tenants(id) ON DELETE CASCADE, -- NULL = platform-wide default
  min_length INTEGER NOT NULL DEFAULT 8,
  require_uppercase BOOLEAN NOT NULL DEFAULT TRUE,
  require_lowercase BOOLEAN NOT NULL DEFAULT TRUE,
  require_numbers BOOLEAN NOT NULL DEFAULT TRUE,
  require_special_chars BOOLEAN NOT NULL DEFAULT FALSE,
  max_age_days INTEGER, -- NULL = no expiration
  prevent_reuse_count INTEGER DEFAULT 5, -- Prevent reusing last N passwords
  lockout_attempts INTEGER DEFAULT 5,
  lockout_duration_minutes INTEGER DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id)
);

CREATE INDEX idx_password_policies_tenant_id ON shared.password_policies(tenant_id);

-- Password history for preventing reuse
CREATE TABLE IF NOT EXISTS shared.password_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES shared.users(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_password_history_user_id ON shared.password_history(user_id);
CREATE INDEX idx_password_history_created_at ON shared.password_history(created_at);

-- Account lockout tracking
CREATE TABLE IF NOT EXISTS shared.account_lockouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES shared.users(id) ON DELETE CASCADE,
  locked_until TIMESTAMPTZ NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);

CREATE INDEX idx_account_lockouts_user_id ON shared.account_lockouts(user_id);
CREATE INDEX idx_account_lockouts_locked_until ON shared.account_lockouts(locked_until);

-- IP whitelisting for tenants
CREATE TABLE IF NOT EXISTS shared.ip_whitelist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES shared.tenants(id) ON DELETE CASCADE,
  ip_address TEXT NOT NULL, -- CIDR notation supported (e.g., "192.168.1.0/24")
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES shared.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, ip_address)
);

CREATE INDEX idx_ip_whitelist_tenant_id ON shared.ip_whitelist(tenant_id);
CREATE INDEX idx_ip_whitelist_active ON shared.ip_whitelist(is_active) WHERE is_active = TRUE;

-- Failed login attempts tracking (for lockout)
CREATE TABLE IF NOT EXISTS shared.failed_login_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES shared.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL, -- Store email even if user doesn't exist (prevent enumeration)
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_failed_login_attempts_user_id ON shared.failed_login_attempts(user_id);
CREATE INDEX idx_failed_login_attempts_email ON shared.failed_login_attempts(email);
CREATE INDEX idx_failed_login_attempts_created_at ON shared.failed_login_attempts(created_at);

-- Insert default platform-wide password policy
INSERT INTO shared.password_policies (tenant_id, min_length, require_uppercase, require_lowercase, require_numbers, require_special_chars, max_age_days, prevent_reuse_count, lockout_attempts, lockout_duration_minutes)
VALUES (NULL, 8, TRUE, TRUE, TRUE, FALSE, 90, 5, 5, 30)
ON CONFLICT (tenant_id) DO NOTHING;

