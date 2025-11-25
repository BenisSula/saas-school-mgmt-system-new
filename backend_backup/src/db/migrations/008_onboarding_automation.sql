-- Tenant onboarding automation

CREATE TABLE IF NOT EXISTS shared.tenant_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES shared.tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'teacher', 'student')),
  token_hash TEXT NOT NULL UNIQUE,
  invited_by UUID REFERENCES shared.users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_invitations_tenant_id ON shared.tenant_invitations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_invitations_email ON shared.tenant_invitations(email);
CREATE INDEX IF NOT EXISTS idx_tenant_invitations_token_hash ON shared.tenant_invitations(token_hash);
CREATE INDEX IF NOT EXISTS idx_tenant_invitations_expires_at ON shared.tenant_invitations(expires_at);

-- Onboarding progress tracking
CREATE TABLE IF NOT EXISTS shared.onboarding_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES shared.tenants(id) ON DELETE CASCADE,
  step TEXT NOT NULL, -- 'invitation_sent', 'admin_created', 'schema_created', 'seed_data', 'branding', 'first_user', 'completed'
  status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped', 'failed')),
  progress_percentage INTEGER NOT NULL DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, step)
);

CREATE INDEX IF NOT EXISTS idx_onboarding_progress_tenant_id ON shared.onboarding_progress(tenant_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_progress_status ON shared.onboarding_progress(status);

-- Onboarding wizard state (for multi-step onboarding)
CREATE TABLE IF NOT EXISTS shared.onboarding_wizard_state (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES shared.tenants(id) ON DELETE CASCADE,
  current_step INTEGER NOT NULL DEFAULT 1,
  completed_steps INTEGER[] DEFAULT ARRAY[]::INTEGER[],
  wizard_data JSONB DEFAULT '{}'::jsonb, -- Stores form data across steps
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_onboarding_wizard_state_tenant_id ON shared.onboarding_wizard_state(tenant_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_wizard_state_completed ON shared.onboarding_wizard_state(is_completed) WHERE is_completed = FALSE;

