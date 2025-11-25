-- Add status column to shared.users if it doesn't exist
ALTER TABLE shared.users
  ADD COLUMN IF NOT EXISTS status TEXT;

-- Set default status for existing users
UPDATE shared.users
SET status = CASE
  WHEN is_verified = TRUE THEN 'active'
  ELSE 'pending'
END
WHERE status IS NULL;

-- Set NOT NULL constraint with default
ALTER TABLE shared.users
  ALTER COLUMN status SET DEFAULT 'pending';

ALTER TABLE shared.users
  ALTER COLUMN status SET NOT NULL;

-- Add check constraint for valid status values
ALTER TABLE shared.users DROP CONSTRAINT IF EXISTS users_status_check;
ALTER TABLE shared.users
  ADD CONSTRAINT users_status_check CHECK (status IN ('pending', 'active', 'rejected', 'suspended'));

-- Create index for status filtering
CREATE INDEX IF NOT EXISTS shared_users_status_idx ON shared.users(status);
CREATE INDEX IF NOT EXISTS shared_users_tenant_status_idx ON shared.users(tenant_id, status);

