-- Add preparation status to tenants table
-- Tracks tenant setup progress for async provisioning

ALTER TABLE shared.tenants
  ADD COLUMN IF NOT EXISTS preparation_status TEXT DEFAULT 'ready' 
    CHECK (preparation_status IN ('pending', 'preparing', 'ready', 'failed'));

ALTER TABLE shared.tenants
  ADD COLUMN IF NOT EXISTS preparation_error TEXT;

ALTER TABLE shared.tenants
  ADD COLUMN IF NOT EXISTS preparation_started_at TIMESTAMPTZ;

ALTER TABLE shared.tenants
  ADD COLUMN IF NOT EXISTS preparation_completed_at TIMESTAMPTZ;

-- Index for querying tenants by preparation status
CREATE INDEX IF NOT EXISTS shared_tenants_preparation_status_idx 
  ON shared.tenants(preparation_status) 
  WHERE preparation_status IN ('pending', 'preparing');

-- Update existing tenants to 'ready' status
UPDATE shared.tenants 
SET preparation_status = 'ready' 
WHERE preparation_status IS NULL;

