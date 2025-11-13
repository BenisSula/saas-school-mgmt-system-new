ALTER TABLE shared.users
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES shared.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS audit_log_enabled BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE shared.users
SET status = 'active'
WHERE status IS NULL OR status = 'inactive';

ALTER TABLE shared.audit_logs
  ADD COLUMN IF NOT EXISTS actor_role TEXT,
  ADD COLUMN IF NOT EXISTS target TEXT;

CREATE INDEX IF NOT EXISTS shared_audit_logs_actor_idx
  ON shared.audit_logs (actor_role, created_at DESC);

