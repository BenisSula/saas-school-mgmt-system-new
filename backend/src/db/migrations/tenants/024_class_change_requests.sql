-- Migration: Add class_change_requests table for student class change workflow
-- This table tracks class change requests that require approval

CREATE TABLE IF NOT EXISTS {{schema}}.class_change_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES {{schema}}.students(id) ON DELETE CASCADE,
  current_class_id TEXT,
  current_class_uuid UUID,
  requested_class_id TEXT NOT NULL,
  requested_class_uuid UUID NOT NULL,
  reason TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  requested_by UUID,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create partial unique index for preventing duplicate pending requests
CREATE UNIQUE INDEX IF NOT EXISTS idx_class_change_requests_no_duplicate_pending ON {{schema}}.class_change_requests(student_id, status) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_class_change_requests_student_id ON {{schema}}.class_change_requests(student_id);
CREATE INDEX IF NOT EXISTS idx_class_change_requests_status ON {{schema}}.class_change_requests(status);
CREATE INDEX IF NOT EXISTS idx_class_change_requests_created_at ON {{schema}}.class_change_requests(created_at DESC);

