-- Migration: Create class_resources table for teacher file uploads
-- Date: 2025-01-XX
-- Phase: 7 - Teacher Layer Enhancements

CREATE TABLE IF NOT EXISTS {{schema}}.class_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  teacher_id UUID NOT NULL,
  class_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  size BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_class_resources_tenant_id ON {{schema}}.class_resources(tenant_id);
CREATE INDEX IF NOT EXISTS idx_class_resources_teacher_id ON {{schema}}.class_resources(teacher_id);
CREATE INDEX IF NOT EXISTS idx_class_resources_class_id ON {{schema}}.class_resources(class_id);
CREATE INDEX IF NOT EXISTS idx_class_resources_created_at ON {{schema}}.class_resources(created_at DESC);

-- Foreign key constraints
-- Note: Teachers table should exist by this migration (created in 001_core_tables.sql)
-- Drop constraint if it exists (for idempotency)
ALTER TABLE {{schema}}.class_resources DROP CONSTRAINT IF EXISTS fk_class_resources_teacher;
-- Add foreign key constraint
ALTER TABLE {{schema}}.class_resources 
ADD CONSTRAINT fk_class_resources_teacher 
FOREIGN KEY (teacher_id) REFERENCES {{schema}}.teachers(id) ON DELETE CASCADE;

