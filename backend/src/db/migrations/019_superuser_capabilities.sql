-- Migration: SuperUser capabilities - subscriptions, overrides, permission overrides
-- Date: 2025-01-XX
-- Phase: 8 - SuperUser Feature Implementation

-- Subscription management
CREATE TABLE IF NOT EXISTS shared.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES shared.tenants(id) ON DELETE CASCADE,
  tier VARCHAR(20) NOT NULL CHECK (tier IN ('free', 'trial', 'paid')),
  status VARCHAR(20) NOT NULL CHECK (status IN ('active', 'suspended', 'cancelled', 'expired')),
  billing_period VARCHAR(20),
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  trial_end_date TIMESTAMP,
  custom_limits JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_id ON shared.subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON shared.subscriptions(status);

-- Subscription history
CREATE TABLE IF NOT EXISTS shared.subscription_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES shared.subscriptions(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES shared.users(id),
  change_type VARCHAR(50) NOT NULL,
  old_value JSONB,
  new_value JSONB,
  reason TEXT,
  changed_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_history_subscription_id ON shared.subscription_history(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_history_changed_at ON shared.subscription_history(changed_at);

-- Manual overrides
CREATE TABLE IF NOT EXISTS shared.manual_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  override_type VARCHAR(50) NOT NULL,
  target_id UUID NOT NULL,
  action VARCHAR(100) NOT NULL,
  reason TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES shared.users(id),
  expires_at TIMESTAMP,
  metadata JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMP,
  revoked_by UUID REFERENCES shared.users(id)
);

CREATE INDEX IF NOT EXISTS idx_overrides_type_target ON shared.manual_overrides(override_type, target_id);
CREATE INDEX IF NOT EXISTS idx_overrides_active ON shared.manual_overrides(is_active);
CREATE INDEX IF NOT EXISTS idx_overrides_expires_at ON shared.manual_overrides(expires_at);

-- Permission overrides
CREATE TABLE IF NOT EXISTS shared.permission_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES shared.users(id) ON DELETE CASCADE,
  permission VARCHAR(100) NOT NULL,
  granted BOOLEAN NOT NULL,
  granted_by UUID NOT NULL REFERENCES shared.users(id),
  reason TEXT,
  expires_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, permission)
);

CREATE INDEX IF NOT EXISTS idx_permission_overrides_user_id ON shared.permission_overrides(user_id);
CREATE INDEX IF NOT EXISTS idx_permission_overrides_expires_at ON shared.permission_overrides(expires_at);

-- Enhance audit_logs table
ALTER TABLE shared.audit_logs 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES shared.tenants(id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON shared.audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON shared.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON shared.audit_logs(severity);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON shared.audit_logs(created_at);

