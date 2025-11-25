CREATE TABLE IF NOT EXISTS {{schema}}.student_drop_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL,
  subject_id UUID NOT NULL REFERENCES {{schema}}.subjects(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS student_drop_requests_unique_pending
  ON {{schema}}.student_drop_requests (student_id, subject_id)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS {{schema}}.student_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  class_name TEXT,
  status TEXT NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'info')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS student_messages_student_idx
  ON {{schema}}.student_messages (student_id, sent_at DESC);

