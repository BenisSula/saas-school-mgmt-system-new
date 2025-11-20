-- Feature flags system

CREATE TABLE IF NOT EXISTS shared.feature_flags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  flag_key TEXT NOT NULL UNIQUE,
  flag_name TEXT NOT NULL,
  description TEXT,
  is_enabled_globally BOOLEAN NOT NULL DEFAULT FALSE,
  rollout_percentage INTEGER NOT NULL DEFAULT 0 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
  enabled_tenant_ids UUID[] DEFAULT ARRAY[]::UUID[], -- Explicitly enabled tenants
  disabled_tenant_ids UUID[] DEFAULT ARRAY[]::UUID[], -- Explicitly disabled tenants
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_feature_flags_flag_key ON shared.feature_flags(flag_key);
CREATE INDEX idx_feature_flags_enabled_globally ON shared.feature_flags(is_enabled_globally) WHERE is_enabled_globally = TRUE;

-- Feature flag history for audit
CREATE TABLE IF NOT EXISTS shared.feature_flag_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  flag_id UUID NOT NULL REFERENCES shared.feature_flags(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES shared.tenants(id) ON DELETE CASCADE, -- NULL = global change
  action TEXT NOT NULL CHECK (action IN ('created', 'enabled', 'disabled', 'rollout_changed', 'tenant_added', 'tenant_removed')),
  old_value JSONB,
  new_value JSONB,
  actor_id UUID REFERENCES shared.users(id),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_feature_flag_history_flag_id ON shared.feature_flag_history(flag_id);
CREATE INDEX idx_feature_flag_history_tenant_id ON shared.feature_flag_history(tenant_id);
CREATE INDEX idx_feature_flag_history_created_at ON shared.feature_flag_history(created_at);

-- Per-tenant feature flag overrides (for fine-grained control)
CREATE TABLE IF NOT EXISTS shared.tenant_feature_flags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES shared.tenants(id) ON DELETE CASCADE,
  flag_key TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL,
  enabled_at TIMESTAMPTZ,
  disabled_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, flag_key)
);

CREATE INDEX idx_tenant_feature_flags_tenant_id ON shared.tenant_feature_flags(tenant_id);
CREATE INDEX idx_tenant_feature_flags_flag_key ON shared.tenant_feature_flags(flag_key);
CREATE INDEX idx_tenant_feature_flags_enabled ON shared.tenant_feature_flags(is_enabled) WHERE is_enabled = TRUE;

