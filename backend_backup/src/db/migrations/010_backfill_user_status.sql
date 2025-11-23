-- Backfill missing user status values
-- This migration ensures all users have a valid status based on their role and context

-- Set status for superadmins (should be active)
UPDATE shared.users
SET status = 'active'
WHERE role = 'superadmin' AND (status IS NULL OR status = '');

-- Set status for existing admins based on is_verified flag
-- Verified admins are likely already active, unverified are pending
UPDATE shared.users
SET status = CASE
  WHEN is_verified = TRUE THEN 'active'
  ELSE 'pending'
END
WHERE role = 'admin' 
  AND (status IS NULL OR status = '');

-- Set status for teachers, students, and hods to pending (requires admin approval)
UPDATE shared.users
SET status = 'pending'
WHERE role IN ('teacher', 'student', 'hod') 
  AND (status IS NULL OR status = '');

-- Final safety check: set any remaining null/empty statuses to 'pending'
UPDATE shared.users
SET status = 'pending'
WHERE status IS NULL OR status = '';

-- Verify no null statuses remain
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM shared.users WHERE status IS NULL OR status = '') THEN
    RAISE EXCEPTION 'Migration failed: Some users still have null or empty status';
  END IF;
END $$;

