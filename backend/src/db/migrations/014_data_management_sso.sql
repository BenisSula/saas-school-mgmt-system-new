-- Data Management & SSO Integration

-- Backup Jobs
CREATE TABLE IF NOT EXISTS shared.backup_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES shared.tenants(id) ON DELETE CASCADE, -- NULL = platform-wide backup
  backup_type TEXT NOT NULL CHECK (backup_type IN ('full', 'incremental', 'schema_only', 'data_only')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  storage_location TEXT NOT NULL, -- S3 path, local path, etc.
  storage_provider TEXT NOT NULL CHECK (storage_provider IN ('local', 's3', 'azure', 'gcs')),
  file_size_bytes BIGINT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb, -- Backup configuration, tables included, etc.
  created_by UUID REFERENCES shared.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_backup_jobs_tenant_id ON shared.backup_jobs(tenant_id);
CREATE INDEX idx_backup_jobs_status ON shared.backup_jobs(status);
CREATE INDEX idx_backup_jobs_created_at ON shared.backup_jobs(created_at);

-- Backup Schedules
CREATE TABLE IF NOT EXISTS shared.backup_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES shared.tenants(id) ON DELETE CASCADE, -- NULL = platform-wide schedule
  name TEXT NOT NULL,
  backup_type TEXT NOT NULL CHECK (backup_type IN ('full', 'incremental', 'schema_only', 'data_only')),
  schedule_cron TEXT NOT NULL, -- Cron expression
  retention_days INTEGER NOT NULL DEFAULT 30,
  storage_provider TEXT NOT NULL CHECK (storage_provider IN ('local', 's3', 'azure', 'gcs')),
  storage_config JSONB DEFAULT '{}'::jsonb, -- Provider-specific config (bucket, credentials, etc.)
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_by UUID REFERENCES shared.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_backup_schedules_tenant_id ON shared.backup_schedules(tenant_id);
CREATE INDEX idx_backup_schedules_is_active ON shared.backup_schedules(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_backup_schedules_next_run_at ON shared.backup_schedules(next_run_at) WHERE is_active = TRUE;

-- Data Export Jobs
CREATE TABLE IF NOT EXISTS shared.data_export_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES shared.tenants(id) ON DELETE CASCADE,
  export_type TEXT NOT NULL CHECK (export_type IN ('full', 'partial', 'gdpr', 'custom')),
  format TEXT NOT NULL CHECK (format IN ('json', 'csv', 'sql', 'excel')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  file_url TEXT,
  file_size_bytes BIGINT,
  tables_included TEXT[] DEFAULT ARRAY[]::TEXT[],
  filters JSONB DEFAULT '{}'::jsonb, -- Export filters (date ranges, user IDs, etc.)
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ, -- Auto-delete after expiration
  error_message TEXT,
  requested_by UUID REFERENCES shared.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_data_export_jobs_tenant_id ON shared.data_export_jobs(tenant_id);
CREATE INDEX idx_data_export_jobs_status ON shared.data_export_jobs(status);
CREATE INDEX idx_data_export_jobs_expires_at ON shared.data_export_jobs(expires_at);

-- Data Import Jobs
CREATE TABLE IF NOT EXISTS shared.data_import_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES shared.tenants(id) ON DELETE CASCADE,
  import_type TEXT NOT NULL CHECK (import_type IN ('full', 'merge', 'update_only')),
  format TEXT NOT NULL CHECK (format IN ('json', 'csv', 'sql', 'excel')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'validating', 'processing', 'completed', 'failed', 'rolled_back')),
  file_url TEXT NOT NULL,
  file_size_bytes BIGINT,
  tables_targeted TEXT[] DEFAULT ARRAY[]::TEXT[],
  records_processed INTEGER DEFAULT 0,
  records_succeeded INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  validation_errors JSONB DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  rollback_data JSONB, -- Store original data for rollback if needed
  requested_by UUID REFERENCES shared.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_data_import_jobs_tenant_id ON shared.data_import_jobs(tenant_id);
CREATE INDEX idx_data_import_jobs_status ON shared.data_import_jobs(status);

-- GDPR Erasure Requests
CREATE TABLE IF NOT EXISTS shared.gdpr_erasure_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES shared.tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES shared.users(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL CHECK (request_type IN ('full_erasure', 'anonymize', 'export_only')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'rejected', 'cancelled')),
  reason TEXT,
  data_categories TEXT[] DEFAULT ARRAY[]::TEXT[], -- Which data categories to erase
  verification_token TEXT, -- Token for user verification
  verified_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  erasure_report JSONB, -- What was erased, anonymized, etc.
  requested_by UUID REFERENCES shared.users(id) ON DELETE SET NULL,
  processed_by UUID REFERENCES shared.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_gdpr_erasure_requests_tenant_id ON shared.gdpr_erasure_requests(tenant_id);
CREATE INDEX idx_gdpr_erasure_requests_user_id ON shared.gdpr_erasure_requests(user_id);
CREATE INDEX idx_gdpr_erasure_requests_status ON shared.gdpr_erasure_requests(status);
CREATE INDEX idx_gdpr_erasure_requests_verification_token ON shared.gdpr_erasure_requests(verification_token);

-- SSO Providers
CREATE TABLE IF NOT EXISTS shared.sso_providers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES shared.tenants(id) ON DELETE CASCADE, -- NULL = platform-wide SSO
  provider_name TEXT NOT NULL,
  provider_type TEXT NOT NULL CHECK (provider_type IN ('saml2', 'oauth2', 'oidc', 'custom')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_default BOOLEAN NOT NULL DEFAULT FALSE, -- Default provider for tenant
  metadata_url TEXT, -- SAML metadata URL
  entity_id TEXT, -- SAML entity ID
  sso_url TEXT, -- SSO endpoint URL
  slo_url TEXT, -- Single Logout URL
  certificate TEXT, -- SAML certificate or OAuth public key
  client_id TEXT, -- OAuth2/OIDC client ID
  client_secret_encrypted TEXT, -- Encrypted client secret
  scopes TEXT[] DEFAULT ARRAY[]::TEXT[], -- OAuth2 scopes
  authorization_url TEXT, -- OAuth2 authorization endpoint
  token_url TEXT, -- OAuth2 token endpoint
  userinfo_url TEXT, -- OAuth2/OIDC userinfo endpoint
  jit_provisioning BOOLEAN NOT NULL DEFAULT FALSE, -- Just-in-Time user provisioning
  jit_default_role TEXT, -- Default role for JIT-provisioned users
  attribute_mapping JSONB DEFAULT '{}'::jsonb, -- Map SSO attributes to user fields
  created_by UUID REFERENCES shared.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, provider_name)
);

CREATE INDEX idx_sso_providers_tenant_id ON shared.sso_providers(tenant_id);
CREATE INDEX idx_sso_providers_is_active ON shared.sso_providers(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_sso_providers_is_default ON shared.sso_providers(is_default) WHERE is_default = TRUE;

-- SSO Sessions
CREATE TABLE IF NOT EXISTS shared.sso_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES shared.tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES shared.users(id) ON DELETE CASCADE,
  provider_id UUID REFERENCES shared.sso_providers(id) ON DELETE CASCADE,
  sso_session_id TEXT NOT NULL, -- External SSO session ID
  access_token_encrypted TEXT, -- Encrypted OAuth2 access token
  refresh_token_encrypted TEXT, -- Encrypted OAuth2 refresh token
  id_token TEXT, -- OIDC ID token (JWT)
  expires_at TIMESTAMPTZ,
  attributes JSONB DEFAULT '{}'::jsonb, -- SSO attributes received
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, user_id, provider_id, sso_session_id)
);

CREATE INDEX idx_sso_sessions_tenant_id ON shared.sso_sessions(tenant_id);
CREATE INDEX idx_sso_sessions_user_id ON shared.sso_sessions(user_id);
CREATE INDEX idx_sso_sessions_provider_id ON shared.sso_sessions(provider_id);
CREATE INDEX idx_sso_sessions_expires_at ON shared.sso_sessions(expires_at);

-- SSO User Mappings (for JIT provisioning)
CREATE TABLE IF NOT EXISTS shared.sso_user_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES shared.tenants(id) ON DELETE CASCADE,
  provider_id UUID REFERENCES shared.sso_providers(id) ON DELETE CASCADE,
  external_user_id TEXT NOT NULL, -- User ID from SSO provider
  user_id UUID REFERENCES shared.users(id) ON DELETE CASCADE,
  external_email TEXT, -- Email from SSO provider
  attributes JSONB DEFAULT '{}'::jsonb, -- Cached SSO attributes
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, provider_id, external_user_id)
);

CREATE INDEX idx_sso_user_mappings_tenant_id ON shared.sso_user_mappings(tenant_id);
CREATE INDEX idx_sso_user_mappings_provider_id ON shared.sso_user_mappings(provider_id);
CREATE INDEX idx_sso_user_mappings_user_id ON shared.sso_user_mappings(user_id);
CREATE INDEX idx_sso_user_mappings_external_user_id ON shared.sso_user_mappings(external_user_id);

-- Data Retention Policies
CREATE TABLE IF NOT EXISTS shared.data_retention_policies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES shared.tenants(id) ON DELETE CASCADE, -- NULL = platform-wide policy
  policy_name TEXT NOT NULL,
  table_name TEXT NOT NULL, -- Which table this policy applies to
  retention_days INTEGER NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('delete', 'anonymize', 'archive')),
  conditions JSONB DEFAULT '{}'::jsonb, -- Conditions for applying policy (e.g., status = 'closed')
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_run_at TIMESTAMPTZ,
  records_affected INTEGER DEFAULT 0,
  created_by UUID REFERENCES shared.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_data_retention_policies_tenant_id ON shared.data_retention_policies(tenant_id);
CREATE INDEX idx_data_retention_policies_is_active ON shared.data_retention_policies(is_active) WHERE is_active = TRUE;

