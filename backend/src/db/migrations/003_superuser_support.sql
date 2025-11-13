CREATE TABLE IF NOT EXISTS shared.roles (
  name TEXT PRIMARY KEY,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO shared.roles (name, description)
VALUES
  ('superadmin', 'Platform owner with full access'),
  ('admin', 'School administrator'),
  ('teacher', 'Teacher role'),
  ('student', 'Student role')
ON CONFLICT (name) DO UPDATE
  SET description = EXCLUDED.description;

ALTER TABLE shared.users
  ADD CONSTRAINT shared_users_role_fk FOREIGN KEY (role) REFERENCES shared.roles(name) ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS shared.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES shared.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS shared_audit_logs_action_idx
  ON shared.audit_logs (action, created_at DESC);

CREATE TABLE IF NOT EXISTS shared.user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES shared.users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT UNIQUE,
  login_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  logout_at TIMESTAMPTZ,
  login_ip TEXT,
  login_user_agent TEXT,
  logout_ip TEXT,
  logout_user_agent TEXT
);

CREATE INDEX IF NOT EXISTS shared_user_sessions_user_idx
  ON shared.user_sessions (user_id, login_at DESC);

CREATE TABLE IF NOT EXISTS shared.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES shared.tenants(id) ON DELETE CASCADE,
  recipient_user_id UUID NOT NULL REFERENCES shared.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'archived')),
  metadata JSONB DEFAULT '{}'::jsonb,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS shared_notifications_recipient_idx
  ON shared.notifications (recipient_user_id, status);

