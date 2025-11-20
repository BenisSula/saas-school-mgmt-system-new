-- Email templates and sending tracking

CREATE TABLE IF NOT EXISTS shared.email_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_key TEXT NOT NULL UNIQUE,
  template_name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT, -- Plain text version
  variables JSONB DEFAULT '{}'::jsonb, -- Expected variables for template
  tenant_id UUID REFERENCES shared.tenants(id) ON DELETE CASCADE, -- NULL = platform-wide template
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, template_key, version)
);

CREATE INDEX idx_email_templates_template_key ON shared.email_templates(template_key);
CREATE INDEX idx_email_templates_tenant_id ON shared.email_templates(tenant_id);
CREATE INDEX idx_email_templates_active ON shared.email_templates(is_active) WHERE is_active = TRUE;

-- Email sending queue and tracking
CREATE TABLE IF NOT EXISTS shared.email_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES shared.tenants(id) ON DELETE SET NULL,
  template_key TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  variables JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'bounced')),
  priority INTEGER NOT NULL DEFAULT 5 CHECK (priority >= 1 AND priority <= 10), -- 1 = highest, 10 = lowest
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_reason TEXT,
  provider_message_id TEXT, -- External provider message ID
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_email_queue_status ON shared.email_queue(status) WHERE status IN ('pending', 'sending');
CREATE INDEX idx_email_queue_tenant_id ON shared.email_queue(tenant_id);
CREATE INDEX idx_email_queue_scheduled_at ON shared.email_queue(scheduled_at);
CREATE INDEX idx_email_queue_priority ON shared.email_queue(priority, scheduled_at);

-- Email sending history (for audit and analytics)
CREATE TABLE IF NOT EXISTS shared.email_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  queue_id UUID REFERENCES shared.email_queue(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES shared.tenants(id) ON DELETE SET NULL,
  template_key TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'bounced', 'opened', 'clicked')),
  provider_message_id TEXT,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  bounce_reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_email_history_tenant_id ON shared.email_history(tenant_id);
CREATE INDEX idx_email_history_template_key ON shared.email_history(template_key);
CREATE INDEX idx_email_history_recipient_email ON shared.email_history(recipient_email);
CREATE INDEX idx_email_history_created_at ON shared.email_history(created_at);
CREATE INDEX idx_email_history_status ON shared.email_history(status);

