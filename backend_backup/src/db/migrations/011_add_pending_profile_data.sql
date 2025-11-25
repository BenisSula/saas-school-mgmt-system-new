-- Add pending_profile_data column to store registration profile data
-- This allows us to store student/teacher profile information during registration
-- and create the actual profile records when the user is approved by admin

ALTER TABLE shared.users
ADD COLUMN IF NOT EXISTS pending_profile_data JSONB DEFAULT NULL;

-- Add index for querying users with pending profile data
CREATE INDEX IF NOT EXISTS idx_users_pending_profile_data 
ON shared.users (tenant_id, status) 
WHERE pending_profile_data IS NOT NULL;

COMMENT ON COLUMN shared.users.pending_profile_data IS 'Stores profile data submitted during registration. Used to create student/teacher records upon admin approval.';

