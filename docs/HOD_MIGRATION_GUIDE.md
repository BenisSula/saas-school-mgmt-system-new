# HOD Role Migration Guide

## Overview

This migration moves HOD (Head of Department) users from having `role='hod'` as their primary role to having `role='teacher'` with an `additional_roles` entry for `'hod'`.

## Migration File

**File**: `backend/src/db/migrations/025_migrate_hod_role_to_additional_roles.sql`

## Pre-Migration Checklist

1. ✅ Backup database
2. ✅ Verify `shared.additional_roles` table exists
3. ✅ Check for any users with `role='hod'`
4. ✅ Review audit log table structure

## Running the Migration

### Option 1: Run All Migrations
```bash
cd backend
npm run migrate
```

### Option 2: Run Single Migration
```bash
cd backend
ts-node src/scripts/runSingleMigration.ts 025_migrate_hod_role_to_additional_roles.sql
```

### Option 3: Manual SQL Execution
```sql
-- Connect to your database and run:
\i backend/src/db/migrations/025_migrate_hod_role_to_additional_roles.sql
```

## What the Migration Does

1. **Finds all users with `role='hod'`**
2. **Updates their role to `'teacher'`**
3. **Creates `additional_roles` entry** with:
   - `role = 'hod'`
   - `granted_at = user's original created_at`
   - `granted_by = first available admin/superadmin user ID`
   - `tenant_id = user's tenant_id`
4. **Creates audit log entries** for each migration
5. **Adds performance index** on `additional_roles(user_id, tenant_id, role)`

## Post-Migration Verification

### Check Migration Results
```sql
-- Verify no users have role='hod' anymore
SELECT COUNT(*) FROM shared.users WHERE role = 'hod';
-- Should return 0

-- Verify HOD users now have role='teacher' with additional_roles
SELECT 
  u.id,
  u.email,
  u.role,
  ar.role as additional_role
FROM shared.users u
JOIN shared.additional_roles ar ON ar.user_id = u.id
WHERE ar.role = 'hod';
-- Should show all migrated HOD users

-- Check audit logs
SELECT 
  action,
  COUNT(*) as count
FROM shared.audit_logs
WHERE action = 'user_role_migrated'
GROUP BY action;
-- Should show count of migrated users
```

### Verify Application Functionality

1. **HOD Login**: Verify HOD users can still log in
2. **HOD Dashboard**: Check `/dashboard/hod/dashboard` loads
3. **Permission Checks**: Verify HOD permissions work correctly
4. **Department Access**: Verify HOD can only see their department

## Rollback Plan

If migration needs to be rolled back:

```sql
-- WARNING: Only run if absolutely necessary
-- This will revert HOD users back to role='hod'

DO $$
DECLARE
  hod_user RECORD;
BEGIN
  FOR hod_user IN
    SELECT ar.user_id, ar.tenant_id
    FROM shared.additional_roles ar
    WHERE ar.role = 'hod'
  LOOP
    -- Revert role back to 'hod'
    UPDATE shared.users
    SET role = 'hod'
    WHERE id = hod_user.user_id;
    
    -- Remove additional_roles entry
    DELETE FROM shared.additional_roles
    WHERE user_id = hod_user.user_id AND role = 'hod';
  END LOOP;
END $$;
```

## Troubleshooting

### Issue: Migration fails with "relation does not exist"
**Solution**: Ensure `shared.additional_roles` table exists. Run migration `018_additional_roles.sql` first.

### Issue: No admin user found for granted_by
**Solution**: Migration will use `NULL` for `granted_by` if no admin exists. This is acceptable.

### Issue: Duplicate additional_roles entries
**Solution**: Migration uses `ON CONFLICT DO NOTHING`, so duplicates are prevented.

## Support

If you encounter issues:
1. Check database logs
2. Review audit_logs table for migration entries
3. Verify `additional_roles` table structure
4. Contact development team with error details

