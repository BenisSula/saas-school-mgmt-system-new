-- Password Change History
-- Tracks all password changes for audit and security purposes
-- Enables superuser to view password change history and perform password resets

-- Password Change History Table
-- Records all password changes including admin-initiated resets
CREATE TABLE IF NOT EXISTS shared.password_change_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES shared.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES shared.tenants(id) ON DELETE SET NULL,
  changed_by UUID REFERENCES shared.users(id) ON DELETE SET NULL, -- NULL = self-initiated, UUID = admin/superuser who changed it
  change_type TEXT NOT NULL CHECK (change_type IN ('self_reset', 'admin_reset', 'admin_change', 'forced_reset')),
  ip_address INET,
  user_agent TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb -- Additional context (reason, notification sent, etc.)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_password_change_history_user_id ON shared.password_change_history(user_id);
CREATE INDEX IF NOT EXISTS idx_password_change_history_tenant_id ON shared.password_change_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_password_change_history_changed_by ON shared.password_change_history(changed_by);
CREATE INDEX IF NOT EXISTS idx_password_change_history_changed_at ON shared.password_change_history(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_password_change_history_change_type ON shared.password_change_history(change_type);
CREATE INDEX IF NOT EXISTS idx_password_change_history_user_changed_at ON shared.password_change_history(user_id, changed_at DESC);

