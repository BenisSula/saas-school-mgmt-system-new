-- Support, Communication & Notification Center

-- Support Tickets
CREATE TABLE IF NOT EXISTS shared.support_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES shared.tenants(id) ON DELETE CASCADE, -- NULL = platform-level ticket
  ticket_number TEXT NOT NULL UNIQUE,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'in_progress', 'resolved', 'closed', 'pending')),
  priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  category TEXT NOT NULL CHECK (category IN ('technical', 'billing', 'feature_request', 'bug', 'other')),
  created_by UUID REFERENCES shared.users(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES shared.users(id) ON DELETE SET NULL,
  resolved_by UUID REFERENCES shared.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_tenant_id ON shared.support_tickets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON shared.support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_priority ON shared.support_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_by ON shared.support_tickets(created_by);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned_to ON shared.support_tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_support_tickets_ticket_number ON shared.support_tickets(ticket_number);

-- Ticket Comments/Replies
CREATE TABLE IF NOT EXISTS shared.ticket_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID NOT NULL REFERENCES shared.support_tickets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES shared.users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT FALSE, -- Internal notes visible only to support staff
  attachments JSONB DEFAULT '[]'::jsonb, -- Array of attachment URLs/metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket_id ON shared.ticket_comments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_user_id ON shared.ticket_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_created_at ON shared.ticket_comments(created_at);

-- Ticket Attachments
CREATE TABLE IF NOT EXISTS shared.ticket_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID NOT NULL REFERENCES shared.support_tickets(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES shared.ticket_comments(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  file_url TEXT NOT NULL,
  uploaded_by UUID REFERENCES shared.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_attachments_ticket_id ON shared.ticket_attachments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_attachments_comment_id ON shared.ticket_attachments(comment_id);

-- Platform Announcements
CREATE TABLE IF NOT EXISTS shared.announcements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES shared.tenants(id) ON DELETE CASCADE, -- NULL = platform-wide announcement
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  content_html TEXT, -- Rich HTML content
  type TEXT NOT NULL CHECK (type IN ('info', 'warning', 'success', 'error', 'maintenance')),
  priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  target_roles TEXT[] DEFAULT ARRAY[]::TEXT[], -- Empty = all roles
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  created_by UUID REFERENCES shared.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_announcements_tenant_id ON shared.announcements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_announcements_type ON shared.announcements(type);
CREATE INDEX IF NOT EXISTS idx_announcements_is_active ON shared.announcements(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_announcements_is_pinned ON shared.announcements(is_pinned) WHERE is_pinned = TRUE;
CREATE INDEX IF NOT EXISTS idx_announcements_dates ON shared.announcements(start_date, end_date);

-- Announcement Views (track who has seen announcements)
CREATE TABLE IF NOT EXISTS shared.announcement_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  announcement_id UUID NOT NULL REFERENCES shared.announcements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES shared.users(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (announcement_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_announcement_views_announcement_id ON shared.announcement_views(announcement_id);
CREATE INDEX IF NOT EXISTS idx_announcement_views_user_id ON shared.announcement_views(user_id);

-- In-App Messaging (Admin-to-Admin, Admin-to-User)
CREATE TABLE IF NOT EXISTS shared.messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES shared.tenants(id) ON DELETE CASCADE, -- NULL = platform-wide message
  sender_id UUID NOT NULL REFERENCES shared.users(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES shared.users(id) ON DELETE SET NULL, -- NULL = broadcast to role
  recipient_role TEXT, -- If recipient_id is NULL, message goes to all users with this role
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  content_html TEXT,
  message_type TEXT NOT NULL CHECK (message_type IN ('direct', 'broadcast', 'system')),
  priority TEXT NOT NULL CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  archived_at TIMESTAMPTZ,
  attachments JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_tenant_id ON shared.messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON shared.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_id ON shared.messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_role ON shared.messages(recipient_role);
CREATE INDEX IF NOT EXISTS idx_messages_is_read ON shared.messages(is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_messages_is_archived ON shared.messages(is_archived) WHERE is_archived = FALSE;
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON shared.messages(created_at);

-- Message Threads (for conversation tracking)
CREATE TABLE IF NOT EXISTS shared.message_threads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES shared.tenants(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  participants UUID[] NOT NULL DEFAULT ARRAY[]::UUID[], -- Array of user IDs
  last_message_id UUID REFERENCES shared.messages(id) ON DELETE SET NULL,
  last_message_at TIMESTAMPTZ,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_message_threads_tenant_id ON shared.message_threads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_message_threads_participants ON shared.message_threads USING GIN(participants);
CREATE INDEX IF NOT EXISTS idx_message_threads_last_message_at ON shared.message_threads(last_message_at);

-- Knowledge Base Categories (must be created before articles)
CREATE TABLE IF NOT EXISTS shared.kb_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES shared.tenants(id) ON DELETE CASCADE, -- NULL = platform-wide category
  parent_id UUID REFERENCES shared.kb_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_kb_categories_tenant_id ON shared.kb_categories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_kb_categories_parent_id ON shared.kb_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_kb_categories_slug ON shared.kb_categories(slug);

-- Knowledge Base Articles
CREATE TABLE IF NOT EXISTS shared.kb_articles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES shared.tenants(id) ON DELETE CASCADE, -- NULL = platform-wide article
  category_id UUID REFERENCES shared.kb_categories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  content TEXT NOT NULL,
  content_html TEXT,
  summary TEXT,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  view_count INTEGER NOT NULL DEFAULT 0,
  helpful_count INTEGER NOT NULL DEFAULT 0,
  not_helpful_count INTEGER NOT NULL DEFAULT 0,
  author_id UUID REFERENCES shared.users(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_kb_articles_tenant_id ON shared.kb_articles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_kb_articles_category_id ON shared.kb_articles(category_id);
CREATE INDEX IF NOT EXISTS idx_kb_articles_slug ON shared.kb_articles(slug);
CREATE INDEX IF NOT EXISTS idx_kb_articles_is_published ON shared.kb_articles(is_published) WHERE is_published = TRUE;
CREATE INDEX IF NOT EXISTS idx_kb_articles_is_featured ON shared.kb_articles(is_featured) WHERE is_featured = TRUE;
CREATE INDEX IF NOT EXISTS idx_kb_articles_tags ON shared.kb_articles USING GIN(tags);


-- KB Article Feedback
CREATE TABLE IF NOT EXISTS shared.kb_article_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id UUID NOT NULL REFERENCES shared.kb_articles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES shared.users(id) ON DELETE SET NULL,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('helpful', 'not_helpful', 'comment')),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (article_id, user_id, feedback_type)
);

CREATE INDEX IF NOT EXISTS idx_kb_article_feedback_article_id ON shared.kb_article_feedback(article_id);
CREATE INDEX IF NOT EXISTS idx_kb_article_feedback_user_id ON shared.kb_article_feedback(user_id);

-- Status Page (Uptime, Incidents, Maintenance)
CREATE TABLE IF NOT EXISTS shared.status_incidents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES shared.tenants(id) ON DELETE CASCADE, -- NULL = platform-wide incident
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('investigating', 'identified', 'monitoring', 'resolved')),
  severity TEXT NOT NULL CHECK (severity IN ('minor', 'major', 'critical')),
  affected_services TEXT[] DEFAULT ARRAY[]::TEXT[], -- List of affected services
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  created_by UUID REFERENCES shared.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_status_incidents_tenant_id ON shared.status_incidents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_status_incidents_status ON shared.status_incidents(status);
CREATE INDEX IF NOT EXISTS idx_status_incidents_severity ON shared.status_incidents(severity);
CREATE INDEX IF NOT EXISTS idx_status_incidents_started_at ON shared.status_incidents(started_at);

-- Incident Updates
CREATE TABLE IF NOT EXISTS shared.incident_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  incident_id UUID NOT NULL REFERENCES shared.status_incidents(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('investigating', 'identified', 'monitoring', 'resolved')),
  message TEXT NOT NULL,
  created_by UUID REFERENCES shared.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incident_updates_incident_id ON shared.incident_updates(incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_updates_created_at ON shared.incident_updates(created_at);

-- Scheduled Maintenance
CREATE TABLE IF NOT EXISTS shared.scheduled_maintenance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES shared.tenants(id) ON DELETE CASCADE, -- NULL = platform-wide maintenance
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  affected_services TEXT[] DEFAULT ARRAY[]::TEXT[],
  scheduled_start TIMESTAMPTZ NOT NULL,
  scheduled_end TIMESTAMPTZ NOT NULL,
  actual_start TIMESTAMPTZ,
  actual_end TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  created_by UUID REFERENCES shared.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_maintenance_tenant_id ON shared.scheduled_maintenance(tenant_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_maintenance_status ON shared.scheduled_maintenance(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_maintenance_scheduled_start ON shared.scheduled_maintenance(scheduled_start);

-- System Uptime Tracking
CREATE TABLE IF NOT EXISTS shared.uptime_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES shared.tenants(id) ON DELETE CASCADE, -- NULL = platform-wide
  service_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('up', 'down', 'degraded')),
  response_time_ms INTEGER,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_uptime_records_tenant_id ON shared.uptime_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_uptime_records_service_name ON shared.uptime_records(service_name);
CREATE INDEX IF NOT EXISTS idx_uptime_records_checked_at ON shared.uptime_records(checked_at);
CREATE INDEX IF NOT EXISTS idx_uptime_records_status ON shared.uptime_records(status);

-- Generate ticket numbers function
CREATE OR REPLACE FUNCTION generate_ticket_number() RETURNS TEXT AS $$
DECLARE
  prefix TEXT := 'TICKET';
  year_part TEXT := TO_CHAR(NOW(), 'YYYY');
  sequence_num INTEGER;
BEGIN
  -- Get next sequence number for today
  SELECT COALESCE(MAX(CAST(SUBSTRING(ticket_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
  INTO sequence_num
  FROM shared.support_tickets
  WHERE ticket_number LIKE prefix || '-' || year_part || '-%';
  
  RETURN prefix || '-' || year_part || '-' || LPAD(sequence_num::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

