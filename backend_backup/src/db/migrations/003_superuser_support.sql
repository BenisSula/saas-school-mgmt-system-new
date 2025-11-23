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
  ('student', 'Student role'),
  ('hod', 'Head of department role')
ON CONFLICT (name) DO UPDATE
  SET description = EXCLUDED.description;

ALTER TABLE shared.users
  DROP CONSTRAINT IF EXISTS shared_users_role_fk;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'shared_users_role_fk' 
    AND conrelid = 'shared.users'::regclass
  ) THEN
    ALTER TABLE shared.users
      ADD CONSTRAINT shared_users_role_fk FOREIGN KEY (role)
        REFERENCES shared.roles(name)
        ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS shared.schools (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES shared.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  contact_phone TEXT,
  contact_email TEXT,
  registration_code TEXT UNIQUE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
  recipient_user_id UUID REFERENCES shared.users(id) ON DELETE SET NULL,
  target_role TEXT,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'unread', 'read', 'archived')),
  metadata JSONB DEFAULT '{}'::jsonb,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS shared_notifications_recipient_idx
  ON shared.notifications (recipient_user_id, status);

