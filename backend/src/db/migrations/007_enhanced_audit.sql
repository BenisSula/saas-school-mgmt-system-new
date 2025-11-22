-- Enhanced audit logging with search, filter, export, and GDPR compliance

-- Enhanced audit log table (extends existing audit_logs if present)
-- If audit_logs already exists, we'll add new columns via ALTER TABLE

-- Check if audit_logs exists and enhance it
DO $$
BEGIN
  -- Add new columns if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'shared' AND table_name = 'audit_logs' AND column_name = 'ip_address'
  ) THEN
    ALTER TABLE shared.audit_logs ADD COLUMN ip_address TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'shared' AND table_name = 'audit_logs' AND column_name = 'user_agent'
  ) THEN
    ALTER TABLE shared.audit_logs ADD COLUMN user_agent TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'shared' AND table_name = 'audit_logs' AND column_name = 'request_id'
  ) THEN
    ALTER TABLE shared.audit_logs ADD COLUMN request_id TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'shared' AND table_name = 'audit_logs' AND column_name = 'resource_type'
  ) THEN
    ALTER TABLE shared.audit_logs ADD COLUMN resource_type TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'shared' AND table_name = 'audit_logs' AND column_name = 'resource_id'
  ) THEN
    ALTER TABLE shared.audit_logs ADD COLUMN resource_id TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'shared' AND table_name = 'audit_logs' AND column_name = 'severity'
  ) THEN
    ALTER TABLE shared.audit_logs ADD COLUMN severity TEXT CHECK (severity IN ('info', 'warning', 'error', 'critical'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'shared' AND table_name = 'audit_logs' AND column_name = 'tags'
  ) THEN
    ALTER TABLE shared.audit_logs ADD COLUMN tags TEXT[];
  END IF;
END $$;

-- Create audit_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS shared.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES shared.tenants(id) ON DELETE SET NULL,
  user_id UUID REFERENCES shared.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  request_id TEXT,
  severity TEXT CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  tags TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient searching and filtering
-- Only create indexes if the columns exist
DO $$
BEGIN
  -- Check if tenant_id column exists before creating index
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'shared' 
    AND table_name = 'audit_logs' 
    AND column_name = 'tenant_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON shared.audit_logs(tenant_id);
  END IF;

  -- Check if user_id column exists before creating index
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'shared' 
    AND table_name = 'audit_logs' 
    AND column_name = 'user_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON shared.audit_logs(user_id);
  END IF;

  -- These columns should always exist if table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'shared' 
    AND table_name = 'audit_logs'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON shared.audit_logs(action);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON shared.audit_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON shared.audit_logs(severity);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_request_id ON shared.audit_logs(request_id);
    
    -- Check if resource_type and resource_id exist before creating composite index
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'shared' 
      AND table_name = 'audit_logs' 
      AND column_name = 'resource_type'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'shared' 
      AND table_name = 'audit_logs' 
      AND column_name = 'resource_id'
    ) THEN
      CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON shared.audit_logs(resource_type, resource_id);
    END IF;
    
    -- Check if tags column exists before creating GIN index
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'shared' 
      AND table_name = 'audit_logs' 
      AND column_name = 'tags'
    ) THEN
      CREATE INDEX IF NOT EXISTS idx_audit_logs_tags ON shared.audit_logs USING GIN(tags);
    END IF;
  END IF;
END $$;

-- Data retention policies
CREATE TABLE IF NOT EXISTS shared.audit_retention_policies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES shared.tenants(id) ON DELETE CASCADE, -- NULL = platform-wide default
  resource_type TEXT, -- NULL = all resources
  action_pattern TEXT, -- Pattern to match actions (e.g., 'user.*', 'payment.*')
  retention_days INTEGER NOT NULL,
  archive_before_delete BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_retention_policies_tenant_id ON shared.audit_retention_policies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_retention_policies_active ON shared.audit_retention_policies(is_active) WHERE is_active = TRUE;

-- Insert default retention policy (90 days for all logs)
INSERT INTO shared.audit_retention_policies (tenant_id, resource_type, action_pattern, retention_days, archive_before_delete, is_active)
VALUES (NULL, NULL, NULL, 90, TRUE, TRUE)
ON CONFLICT DO NOTHING;

-- Archived audit logs (for compliance and historical analysis)
CREATE TABLE IF NOT EXISTS shared.audit_logs_archive (
  id UUID PRIMARY KEY,
  tenant_id UUID,
  user_id UUID,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  request_id TEXT,
  severity TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ NOT NULL,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_archive_tenant_id ON shared.audit_logs_archive(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_archive_created_at ON shared.audit_logs_archive(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_archive_archived_at ON shared.audit_logs_archive(archived_at);

-- GDPR data export requests
CREATE TABLE IF NOT EXISTS shared.gdpr_export_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES shared.tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES shared.users(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL CHECK (request_type IN ('export', 'erasure', 'rectification')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  requested_by UUID REFERENCES shared.users(id),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  export_url TEXT, -- S3 URL or similar for export file
  export_expires_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_gdpr_export_requests_tenant_id ON shared.gdpr_export_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_gdpr_export_requests_user_id ON shared.gdpr_export_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_gdpr_export_requests_status ON shared.gdpr_export_requests(status);
CREATE INDEX IF NOT EXISTS idx_gdpr_export_requests_requested_at ON shared.gdpr_export_requests(requested_at);

-- GDPR data erasure log (for compliance tracking)
CREATE TABLE IF NOT EXISTS shared.gdpr_erasure_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES shared.tenants(id) ON DELETE SET NULL,
  user_id UUID REFERENCES shared.users(id) ON DELETE SET NULL,
  request_id UUID REFERENCES shared.gdpr_export_requests(id),
  data_type TEXT NOT NULL, -- 'user_data', 'audit_logs', 'invoices', etc.
  records_deleted INTEGER NOT NULL DEFAULT 0,
  anonymized BOOLEAN NOT NULL DEFAULT FALSE, -- If true, data was anonymized instead of deleted
  executed_by UUID REFERENCES shared.users(id),
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_gdpr_erasure_log_tenant_id ON shared.gdpr_erasure_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_gdpr_erasure_log_user_id ON shared.gdpr_erasure_log(user_id);
CREATE INDEX IF NOT EXISTS idx_gdpr_erasure_log_executed_at ON shared.gdpr_erasure_log(executed_at);

