-- Migration: Create class_announcements table for teacher-to-student messaging
-- Date: 2025-01-XX
-- Phase: 7 - Teacher Layer Enhancements

CREATE TABLE IF NOT EXISTS {{schema}}.class_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  class_id TEXT NOT NULL,
  teacher_id UUID NOT NULL,
  message TEXT NOT NULL,
  attachments JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_class_announcements_tenant_id ON {{schema}}.class_announcements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_class_announcements_class_id ON {{schema}}.class_announcements(class_id);
CREATE INDEX IF NOT EXISTS idx_class_announcements_teacher_id ON {{schema}}.class_announcements(teacher_id);
CREATE INDEX IF NOT EXISTS idx_class_announcements_created_at ON {{schema}}.class_announcements(created_at DESC);

-- Foreign key constraints
-- Note: Teachers table should exist by this migration (created in 001_core_tables.sql)
-- Drop constraint if it exists (for idempotency)
ALTER TABLE {{schema}}.class_announcements DROP CONSTRAINT IF EXISTS fk_class_announcements_teacher;
-- Add foreign key constraint
ALTER TABLE {{schema}}.class_announcements 
ADD CONSTRAINT fk_class_announcements_teacher 
FOREIGN KEY (teacher_id) REFERENCES {{schema}}.teachers(id) ON DELETE CASCADE;

