-- Migration: Migrate HOD role from primary role to additional_roles
-- Date: 2025-01-XX
-- Phase: 6 - HOD Layer Implementation
-- Description: Moves users with role='hod' to role='teacher' and creates additional_roles entry

DO $$
DECLARE
  hod_user RECORD;
  admin_user_id UUID;
BEGIN
  -- Get a system admin user ID for granted_by (or use NULL if none exists)
  SELECT id INTO admin_user_id
  FROM shared.users
  WHERE role = 'admin' OR role = 'superadmin'
  LIMIT 1;

  -- Find all users with role='hod'
  FOR hod_user IN
    SELECT id, tenant_id, created_at
    FROM shared.users
    WHERE role = 'hod'
  LOOP
    -- Update user role to 'teacher'
    UPDATE shared.users
    SET role = 'teacher'
    WHERE id = hod_user.id;

    -- Create additional_roles entry if it doesn't exist
    INSERT INTO shared.additional_roles (user_id, role, granted_at, granted_by, tenant_id)
    VALUES (
      hod_user.id,
      'hod',
      hod_user.created_at, -- Use original creation date
      admin_user_id,
      hod_user.tenant_id
    )
    ON CONFLICT (user_id, role, tenant_id) DO NOTHING;

    -- Create audit log entry for the migration
    INSERT INTO shared.audit_logs (
      tenant_id,
      user_id,
      action,
      resource_type,
      resource_id,
      details,
      severity,
      tags,
      created_at
    )
    VALUES (
      hod_user.tenant_id,
      hod_user.id,
      'user_role_migrated',
      'user',
      hod_user.id,
      jsonb_build_object(
        'old_role', 'hod',
        'new_role', 'teacher',
        'additional_role', 'hod',
        'migration', '025_migrate_hod_role_to_additional_roles'
      ),
      'info',
      ARRAY['migration', 'role_change', 'hod'],
      NOW()
    );
  END LOOP;

  RAISE NOTICE 'Migrated % users from role=hod to role=teacher with additional_roles=hod', 
    (SELECT COUNT(*) FROM shared.users WHERE role = 'hod' AND EXISTS (
      SELECT 1 FROM shared.additional_roles WHERE user_id = shared.users.id AND role = 'hod'
    ));
END $$;

-- Add index if not exists for performance
CREATE INDEX IF NOT EXISTS idx_additional_roles_user_tenant_role 
  ON shared.additional_roles(user_id, tenant_id, role);

-- Add comment
COMMENT ON TABLE shared.additional_roles IS 
  'Stores additional roles for users. HOD is stored here, not as primary role.';

