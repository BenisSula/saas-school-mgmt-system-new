ALTER TABLE {{schema}}.audit_logs
  ADD COLUMN IF NOT EXISTS actor_role TEXT,
  ADD COLUMN IF NOT EXISTS target TEXT;

CREATE INDEX IF NOT EXISTS {{schema}}_audit_logs_actor_idx
  ON {{schema}}.audit_logs (actor_role, created_at DESC);

