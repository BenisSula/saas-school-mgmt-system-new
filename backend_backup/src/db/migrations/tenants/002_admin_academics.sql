CREATE TABLE IF NOT EXISTS {{schema}}.subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS {{schema}}.class_subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID NOT NULL REFERENCES {{schema}}.classes(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES {{schema}}.subjects(id) ON DELETE CASCADE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (class_id, subject_id)
);

CREATE TABLE IF NOT EXISTS {{schema}}.teacher_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID NOT NULL REFERENCES {{schema}}.teachers(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES {{schema}}.classes(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES {{schema}}.subjects(id) ON DELETE CASCADE,
  is_class_teacher BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (teacher_id, class_id, subject_id)
);

CREATE TABLE IF NOT EXISTS {{schema}}.student_subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES {{schema}}.students(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES {{schema}}.subjects(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  UNIQUE (student_id, subject_id)
);

CREATE TABLE IF NOT EXISTS {{schema}}.student_promotions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES {{schema}}.students(id) ON DELETE CASCADE,
  from_class_id UUID REFERENCES {{schema}}.classes(id) ON DELETE SET NULL,
  to_class_id UUID REFERENCES {{schema}}.classes(id) ON DELETE SET NULL,
  promoted_on TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  promoted_by UUID,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS {{schema}}.term_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES {{schema}}.students(id) ON DELETE CASCADE,
  term_id UUID REFERENCES {{schema}}.academic_terms(id) ON DELETE SET NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  generated_by UUID,
  summary TEXT,
  pdf TEXT
);

