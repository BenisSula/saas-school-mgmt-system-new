-- Migration: Create class_resources table (if not exists)
-- Date: 2025-01-24
-- Description: Creates table for managing class resources (documents, links, files, videos)
-- Note: If table already exists from migration 027, migration 033 will consolidate schemas

-- Only create if table doesn't exist (migration 027 may have already created it)
-- Migration 033 will handle full consolidation of both schemas
CREATE TABLE IF NOT EXISTS {{schema}}.class_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id TEXT NOT NULL, -- Keep flexible (can be UUID or text identifier)
  title TEXT NOT NULL,
  description TEXT,
  resource_type TEXT,
  resource_url TEXT,
  file_name TEXT,
  file_size INTEGER,
  mime_type TEXT,
  -- Legacy fields (for backward compatibility with 027)
  tenant_id UUID,
  teacher_id UUID REFERENCES {{schema}}.teachers(id) ON DELETE SET NULL,
  -- New fields
  created_by UUID REFERENCES shared.users(id),
  updated_by UUID REFERENCES shared.users(id),
  -- Legacy fields from 027
  file_url TEXT,
  file_type TEXT,
  size BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add constraint if column exists and constraint doesn't exist
-- Migration 033 will ensure proper constraints
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = '{{schema}}' 
    AND table_name = 'class_resources' 
    AND column_name = 'resource_type'
  ) AND NOT EXISTS (
    SELECT FROM pg_constraint 
    WHERE conname = 'check_resource_type' 
    AND conrelid = '{{schema}}.class_resources'::regclass
  ) THEN
    ALTER TABLE {{schema}}.class_resources
      ADD CONSTRAINT check_resource_type 
      CHECK (resource_type IN ('document', 'link', 'file', 'video'));
  END IF;
END $$;

-- Indexes (only create if columns exist)
CREATE INDEX IF NOT EXISTS idx_class_resources_class_id ON {{schema}}.class_resources(class_id);
CREATE INDEX IF NOT EXISTS idx_class_resources_created_at ON {{schema}}.class_resources(created_at);

-- Conditional indexes (only if columns exist)
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = '{{schema}}' 
    AND table_name = 'class_resources' 
    AND column_name = 'resource_type'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_class_resources_resource_type ON {{schema}}.class_resources(resource_type);
  END IF;
  
  IF EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = '{{schema}}' 
    AND table_name = 'class_resources' 
    AND column_name = 'teacher_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_class_resources_teacher_id ON {{schema}}.class_resources(teacher_id) WHERE teacher_id IS NOT NULL;
  END IF;
END $$;

-- Add comments
COMMENT ON TABLE {{schema}}.class_resources IS 'Stores resources (documents, links, files, videos) associated with classes. Migration 033 consolidates schemas.';
