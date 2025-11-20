-- Advanced reporting and analytics system

-- Report definitions/templates
CREATE TABLE IF NOT EXISTS shared.report_definitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES shared.tenants(id) ON DELETE CASCADE, -- NULL = platform-wide template
  name TEXT NOT NULL,
  description TEXT,
  report_type TEXT NOT NULL CHECK (report_type IN ('attendance', 'grades', 'fees', 'users', 'analytics', 'custom')),
  data_source TEXT NOT NULL, -- SQL query or data source identifier
  query_template TEXT NOT NULL, -- SQL template with variables
  parameters JSONB DEFAULT '{}'::jsonb, -- Expected parameters and their types
  columns JSONB DEFAULT '[]'::jsonb, -- Column definitions for custom reports
  filters JSONB DEFAULT '{}'::jsonb, -- Available filters
  visualization_config JSONB DEFAULT '{}'::jsonb, -- Chart/graph configuration
  role_permissions TEXT[] DEFAULT ARRAY[]::TEXT[], -- Roles that can view this report
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_template BOOLEAN NOT NULL DEFAULT FALSE, -- If true, can be used as template for custom reports
  created_by UUID REFERENCES shared.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_report_definitions_tenant_id ON shared.report_definitions(tenant_id);
CREATE INDEX idx_report_definitions_report_type ON shared.report_definitions(report_type);
CREATE INDEX idx_report_definitions_is_template ON shared.report_definitions(is_template) WHERE is_template = TRUE;
CREATE INDEX idx_report_definitions_active ON shared.report_definitions(is_active) WHERE is_active = TRUE;

-- Scheduled reports
CREATE TABLE IF NOT EXISTS shared.scheduled_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES shared.tenants(id) ON DELETE CASCADE,
  report_definition_id UUID NOT NULL REFERENCES shared.report_definitions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('daily', 'weekly', 'monthly', 'custom')),
  schedule_config JSONB NOT NULL, -- Cron expression or schedule details
  parameters JSONB DEFAULT '{}'::jsonb, -- Report parameters
  export_format TEXT NOT NULL CHECK (export_format IN ('csv', 'pdf', 'excel', 'json')),
  recipients TEXT[] NOT NULL, -- Email addresses
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ NOT NULL,
  created_by UUID REFERENCES shared.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scheduled_reports_tenant_id ON shared.scheduled_reports(tenant_id);
CREATE INDEX idx_scheduled_reports_report_definition_id ON shared.scheduled_reports(report_definition_id);
CREATE INDEX idx_scheduled_reports_next_run_at ON shared.scheduled_reports(next_run_at) WHERE is_active = TRUE;
CREATE INDEX idx_scheduled_reports_active ON shared.scheduled_reports(is_active) WHERE is_active = TRUE;

-- Report execution history
CREATE TABLE IF NOT EXISTS shared.report_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES shared.tenants(id) ON DELETE CASCADE,
  report_definition_id UUID REFERENCES shared.report_definitions(id) ON DELETE SET NULL,
  scheduled_report_id UUID REFERENCES shared.scheduled_reports(id) ON DELETE SET NULL,
  executed_by UUID REFERENCES shared.users(id),
  parameters JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  row_count INTEGER,
  execution_time_ms INTEGER,
  error_message TEXT,
  export_format TEXT CHECK (export_format IN ('csv', 'pdf', 'excel', 'json')),
  export_url TEXT, -- URL to download export
  export_expires_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_report_executions_tenant_id ON shared.report_executions(tenant_id);
CREATE INDEX idx_report_executions_report_definition_id ON shared.report_executions(report_definition_id);
CREATE INDEX idx_report_executions_scheduled_report_id ON shared.report_executions(scheduled_report_id);
CREATE INDEX idx_report_executions_status ON shared.report_executions(status);
CREATE INDEX idx_report_executions_started_at ON shared.report_executions(started_at);

-- Report data snapshots (for historical trend comparison)
CREATE TABLE IF NOT EXISTS shared.report_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES shared.tenants(id) ON DELETE CASCADE,
  report_definition_id UUID NOT NULL REFERENCES shared.report_definitions(id) ON DELETE CASCADE,
  execution_id UUID REFERENCES shared.report_executions(id) ON DELETE SET NULL,
  snapshot_date DATE NOT NULL,
  data JSONB NOT NULL, -- Snapshot of report data
  summary_metrics JSONB DEFAULT '{}'::jsonb, -- Pre-calculated metrics for quick comparison
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, report_definition_id, snapshot_date)
);

CREATE INDEX idx_report_snapshots_tenant_id ON shared.report_snapshots(tenant_id);
CREATE INDEX idx_report_snapshots_report_definition_id ON shared.report_snapshots(report_definition_id);
CREATE INDEX idx_report_snapshots_snapshot_date ON shared.report_snapshots(snapshot_date);
CREATE INDEX idx_report_snapshots_execution_id ON shared.report_snapshots(execution_id);

-- Custom report builder configurations
CREATE TABLE IF NOT EXISTS shared.custom_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES shared.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  base_template_id UUID REFERENCES shared.report_definitions(id) ON DELETE SET NULL,
  data_sources TEXT[] NOT NULL, -- Multiple data sources
  joins JSONB DEFAULT '[]'::jsonb, -- Join configurations
  selected_columns JSONB NOT NULL, -- Selected columns with aliases
  filters JSONB DEFAULT '{}'::jsonb, -- Applied filters
  group_by TEXT[],
  order_by JSONB DEFAULT '[]'::jsonb,
  aggregations JSONB DEFAULT '[]'::jsonb, -- SUM, AVG, COUNT, etc.
  visualization_type TEXT CHECK (visualization_type IN ('table', 'bar', 'line', 'pie', 'area')),
  role_permissions TEXT[] DEFAULT ARRAY[]::TEXT[],
  is_shared BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES shared.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_custom_reports_tenant_id ON shared.custom_reports(tenant_id);
CREATE INDEX idx_custom_reports_created_by ON shared.custom_reports(created_by);
CREATE INDEX idx_custom_reports_shared ON shared.custom_reports(is_shared) WHERE is_shared = TRUE;

-- Report favorites (for quick access)
CREATE TABLE IF NOT EXISTS shared.report_favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES shared.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES shared.users(id) ON DELETE CASCADE,
  report_definition_id UUID REFERENCES shared.report_definitions(id) ON DELETE CASCADE,
  custom_report_id UUID REFERENCES shared.custom_reports(id) ON DELETE CASCADE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (report_definition_id IS NOT NULL AND custom_report_id IS NULL) OR
    (report_definition_id IS NULL AND custom_report_id IS NOT NULL)
  ),
  UNIQUE (user_id, report_definition_id, custom_report_id)
);

CREATE INDEX idx_report_favorites_user_id ON shared.report_favorites(user_id);
CREATE INDEX idx_report_favorites_tenant_id ON shared.report_favorites(tenant_id);

