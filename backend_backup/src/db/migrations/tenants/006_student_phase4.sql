ALTER TABLE {{schema}}.classes
  ADD COLUMN IF NOT EXISTS school_id UUID,
  ADD COLUMN IF NOT EXISTS department_id UUID,
  ADD COLUMN IF NOT EXISTS grade_level TEXT,
  ADD COLUMN IF NOT EXISTS section TEXT,
  ADD COLUMN IF NOT EXISTS class_teacher_id UUID,
  ADD COLUMN IF NOT EXISTS capacity INTEGER,
  ADD COLUMN IF NOT EXISTS academic_year TEXT;

CREATE INDEX IF NOT EXISTS {{schema}}_classes_department_idx
  ON {{schema}}.classes (department_id);

ALTER TABLE {{schema}}.students
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES shared.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('M', 'F') OR gender IS NULL),
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS school_id UUID,
  ADD COLUMN IF NOT EXISTS department_id UUID,
  ADD COLUMN IF NOT EXISTS class_uuid UUID REFERENCES {{schema}}.classes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS enrollment_date DATE,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS {{schema}}_students_user_idx
  ON {{schema}}.students (user_id);

CREATE UNIQUE INDEX IF NOT EXISTS {{schema}}_students_email_idx
  ON {{schema}}.students (email)
  WHERE email IS NOT NULL;

ALTER TABLE {{schema}}.student_subjects
  ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES {{schema}}.classes(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS academic_year TEXT,
  ADD COLUMN IF NOT EXISTS enrollment_status TEXT NOT NULL DEFAULT 'enrolled';

CREATE UNIQUE INDEX IF NOT EXISTS {{schema}}_student_subjects_unique
  ON {{schema}}.student_subjects (student_id, subject_id, academic_year);

ALTER TABLE {{schema}}.fee_invoices
  ADD COLUMN IF NOT EXISTS balance NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS academic_year TEXT;

ALTER TABLE {{schema}}.fee_items
  ADD COLUMN IF NOT EXISTS term TEXT;

CREATE TABLE IF NOT EXISTS {{schema}}.student_concerns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES {{schema}}.students(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'in_progress')),
  handled_by UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS {{schema}}_student_concerns_student_idx
  ON {{schema}}.student_concerns (student_id, status);


