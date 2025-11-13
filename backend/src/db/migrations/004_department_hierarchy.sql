CREATE TABLE IF NOT EXISTS shared.departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES shared.schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  contact_email TEXT,
  contact_phone TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (school_id, slug)
);

CREATE INDEX IF NOT EXISTS shared_departments_school_idx
  ON shared.departments (school_id);

ALTER TABLE shared.users
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES shared.schools(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES shared.departments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_teaching_staff BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS shared_users_department_idx
  ON shared.users (department_id);

INSERT INTO shared.roles (name, description)
VALUES ('hod', 'Head of department with department-level access')
ON CONFLICT (name) DO UPDATE
  SET description = EXCLUDED.description;

CREATE TABLE IF NOT EXISTS shared.user_roles (
  user_id UUID NOT NULL REFERENCES shared.users(id) ON DELETE CASCADE,
  role_name TEXT NOT NULL REFERENCES shared.roles(name) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by UUID REFERENCES shared.users(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  PRIMARY KEY (user_id, role_name)
);

CREATE INDEX IF NOT EXISTS shared_user_roles_role_idx
  ON shared.user_roles (role_name);

CREATE TABLE IF NOT EXISTS shared.role_permissions (
  role_name TEXT NOT NULL REFERENCES shared.roles(name) ON DELETE CASCADE,
  permission TEXT NOT NULL,
  PRIMARY KEY (role_name, permission)
);

ALTER TABLE shared.notifications
  ADD COLUMN IF NOT EXISTS target_roles TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

