-- Resource quotas and rate limiting per tenant

CREATE TABLE IF NOT EXISTS shared.quota_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES shared.tenants(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL, -- 'api_calls', 'storage_gb', 'users', 'students', 'api_requests_per_minute'
  limit_value NUMERIC(12, 2) NOT NULL,
  current_usage NUMERIC(12, 2) NOT NULL DEFAULT 0,
  reset_period TEXT NOT NULL CHECK (reset_period IN ('hourly', 'daily', 'monthly', 'yearly', 'never')),
  last_reset_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  warning_threshold NUMERIC(12, 2), -- Percentage (0-100) or absolute value
  is_enforced BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, resource_type)
);

CREATE INDEX idx_quota_limits_tenant_id ON shared.quota_limits(tenant_id);
CREATE INDEX idx_quota_limits_resource_type ON shared.quota_limits(resource_type);
CREATE INDEX idx_quota_limits_enforced ON shared.quota_limits(is_enforced) WHERE is_enforced = TRUE;

-- Quota usage tracking (for historical analysis)
CREATE TABLE IF NOT EXISTS shared.quota_usage_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES shared.tenants(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_quota_usage_logs_tenant_id ON shared.quota_usage_logs(tenant_id);
CREATE INDEX idx_quota_usage_logs_resource_type ON shared.quota_usage_logs(resource_type);
CREATE INDEX idx_quota_usage_logs_period ON shared.quota_usage_logs(period_start, period_end);

-- Rate limiting per tenant (for API endpoints)
CREATE TABLE IF NOT EXISTS shared.rate_limit_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES shared.tenants(id) ON DELETE CASCADE, -- NULL = platform-wide default
  endpoint_pattern TEXT NOT NULL, -- e.g., '/api/*', '/api/students', '/api/exams'
  method TEXT, -- 'GET', 'POST', 'PUT', 'DELETE', NULL = all methods
  requests_per_window INTEGER NOT NULL,
  window_seconds INTEGER NOT NULL,
  is_enforced BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rate_limit_rules_tenant_id ON shared.rate_limit_rules(tenant_id);
CREATE INDEX idx_rate_limit_rules_endpoint ON shared.rate_limit_rules(endpoint_pattern);

-- Rate limit tracking (sliding window)
CREATE TABLE IF NOT EXISTS shared.rate_limit_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES shared.tenants(id) ON DELETE CASCADE,
  endpoint_pattern TEXT NOT NULL,
  method TEXT,
  identifier TEXT NOT NULL, -- user_id or ip_address
  request_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, endpoint_pattern, method, identifier, window_start)
);

CREATE INDEX idx_rate_limit_tracking_tenant_id ON shared.rate_limit_tracking(tenant_id);
CREATE INDEX idx_rate_limit_tracking_window ON shared.rate_limit_tracking(window_start, window_end);
CREATE INDEX idx_rate_limit_tracking_identifier ON shared.rate_limit_tracking(identifier);

-- Quota violation warnings and notifications
CREATE TABLE IF NOT EXISTS shared.quota_warnings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES shared.tenants(id) ON DELETE CASCADE,
  quota_limit_id UUID NOT NULL REFERENCES shared.quota_limits(id) ON DELETE CASCADE,
  warning_type TEXT NOT NULL CHECK (warning_type IN ('threshold_reached', 'limit_exceeded', 'reset_required')),
  message TEXT NOT NULL,
  is_sent BOOLEAN NOT NULL DEFAULT FALSE,
  sent_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_quota_warnings_tenant_id ON shared.quota_warnings(tenant_id);
CREATE INDEX idx_quota_warnings_quota_limit_id ON shared.quota_warnings(quota_limit_id);
CREATE INDEX idx_quota_warnings_sent ON shared.quota_warnings(is_sent) WHERE is_sent = FALSE;

-- Insert default rate limit rules for platform
INSERT INTO shared.rate_limit_rules (tenant_id, endpoint_pattern, method, requests_per_window, window_seconds, is_enforced)
VALUES
  (NULL, '/api/*', NULL, 100, 60, TRUE), -- 100 requests per minute for all API endpoints
  (NULL, '/api/auth/*', NULL, 10, 60, TRUE), -- 10 requests per minute for auth endpoints
  (NULL, '/api/superuser/*', NULL, 50, 60, TRUE) -- 50 requests per minute for superuser endpoints
ON CONFLICT DO NOTHING;

