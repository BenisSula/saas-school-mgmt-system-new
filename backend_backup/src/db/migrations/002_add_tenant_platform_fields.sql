ALTER TABLE shared.tenants
  ADD COLUMN IF NOT EXISTS status TEXT;

ALTER TABLE shared.tenants
  ADD COLUMN IF NOT EXISTS subscription_type TEXT;

ALTER TABLE shared.tenants
  ADD COLUMN IF NOT EXISTS billing_email TEXT;

ALTER TABLE shared.tenants
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE shared.tenants
SET status = COALESCE(status, 'active');

UPDATE shared.tenants
SET subscription_type = COALESCE(subscription_type, 'trial');

ALTER TABLE shared.tenants
  ALTER COLUMN status SET DEFAULT 'active';

ALTER TABLE shared.tenants
  ALTER COLUMN status SET NOT NULL;

ALTER TABLE shared.tenants
  ALTER COLUMN subscription_type SET DEFAULT 'trial';

ALTER TABLE shared.tenants
  ALTER COLUMN subscription_type SET NOT NULL;

ALTER TABLE shared.tenants DROP CONSTRAINT IF EXISTS tenants_status_check;
ALTER TABLE shared.tenants
  ADD CONSTRAINT tenants_status_check CHECK (status IN ('active', 'suspended', 'deleted'));

ALTER TABLE shared.tenants DROP CONSTRAINT IF EXISTS tenants_subscription_type_check;
ALTER TABLE shared.tenants
  ADD CONSTRAINT tenants_subscription_type_check CHECK (subscription_type IN ('free', 'trial', 'paid'));

