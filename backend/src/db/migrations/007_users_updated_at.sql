ALTER TABLE shared.users
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE shared.users
SET updated_at = COALESCE(updated_at, NOW());

