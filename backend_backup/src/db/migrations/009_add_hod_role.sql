-- Add 'hod' role to shared.users role constraint
-- This migration adds the 'hod' (Head of Department) role to the allowed roles
-- in the shared.users table, enabling HOD user creation and management.

ALTER TABLE shared.users DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE shared.users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('student', 'teacher', 'hod', 'admin', 'superadmin'));

