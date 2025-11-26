-- Migration: Consolidate class_resources tables
-- Date: 2025-01-24
-- Description: Merges old teacher-scoped class_resources (027) with new admin-scoped class_resources (032)
--              into a unified schema that supports both use cases
-- 
-- This migration is idempotent and handles:
-- 1. Tables created by migration 027 (old schema)
-- 2. Tables created by migration 032 (new schema)
-- 3. Tables that don't exist yet (creates unified schema)

-- Step 1: Ensure table exists (create if it doesn't)
CREATE TABLE IF NOT EXISTS {{schema}}.class_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  -- New unified schema fields
  resource_type TEXT,
  resource_url TEXT,
  file_name TEXT,
  file_size INTEGER,
  mime_type TEXT,
  created_by UUID REFERENCES shared.users(id),
  updated_by UUID REFERENCES shared.users(id),
  -- Legacy fields (for backward compatibility)
  tenant_id UUID,
  teacher_id UUID REFERENCES {{schema}}.teachers(id) ON DELETE SET NULL,
  file_url TEXT,
  file_type TEXT,
  size BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Add missing columns (idempotent - uses IF NOT EXISTS)
ALTER TABLE {{schema}}.class_resources
  ADD COLUMN IF NOT EXISTS resource_type TEXT,
  ADD COLUMN IF NOT EXISTS resource_url TEXT,
  ADD COLUMN IF NOT EXISTS file_name TEXT,
  ADD COLUMN IF NOT EXISTS file_size INTEGER,
  ADD COLUMN IF NOT EXISTS mime_type TEXT,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES shared.users(id),
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES shared.users(id),
  ADD COLUMN IF NOT EXISTS tenant_id UUID,
  ADD COLUMN IF NOT EXISTS teacher_id UUID REFERENCES {{schema}}.teachers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS file_url TEXT,
  ADD COLUMN IF NOT EXISTS file_type TEXT,
  ADD COLUMN IF NOT EXISTS size BIGINT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Step 3: Migrate data from old schema to new schema (if old columns exist and new columns are NULL)
-- Map file_type to resource_type
UPDATE {{schema}}.class_resources
SET resource_type = CASE 
  WHEN resource_type IS NULL AND file_type LIKE 'video%' THEN 'video'
  WHEN resource_type IS NULL AND file_type LIKE 'image%' THEN 'file'
  WHEN resource_type IS NULL AND (file_url LIKE 'http://%' OR file_url LIKE 'https://%') THEN 'link'
  WHEN resource_type IS NULL THEN 'document'
  ELSE resource_type
END
WHERE resource_type IS NULL AND file_type IS NOT NULL;

-- Map file_url to resource_url
UPDATE {{schema}}.class_resources
SET resource_url = COALESCE(resource_url, file_url)
WHERE resource_url IS NULL AND file_url IS NOT NULL;

-- Map size to file_size
UPDATE {{schema}}.class_resources
SET file_size = COALESCE(file_size, size::INTEGER)
WHERE file_size IS NULL AND size IS NOT NULL;

-- Map file_type to mime_type
UPDATE {{schema}}.class_resources
SET mime_type = COALESCE(mime_type, file_type)
WHERE mime_type IS NULL AND file_type IS NOT NULL;

-- Extract file_name from file_url if possible
UPDATE {{schema}}.class_resources
SET file_name = COALESCE(file_name, substring(file_url from '[^/]+$'))
WHERE file_name IS NULL AND file_url IS NOT NULL AND file_url LIKE '%/%';

-- Set default resource_type for records that still don't have it
UPDATE {{schema}}.class_resources
SET resource_type = 'document'
WHERE resource_type IS NULL;

-- Step 4: Add constraint for resource_type (idempotent)
-- Drop constraint if it exists (to avoid errors)
ALTER TABLE {{schema}}.class_resources DROP CONSTRAINT IF EXISTS check_resource_type;
-- Add constraint
ALTER TABLE {{schema}}.class_resources
  ADD CONSTRAINT check_resource_type 
  CHECK (resource_type IN ('document', 'link', 'file', 'video'));

-- Step 5: Create indexes (idempotent - uses IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_class_resources_class_id ON {{schema}}.class_resources(class_id);
CREATE INDEX IF NOT EXISTS idx_class_resources_resource_type ON {{schema}}.class_resources(resource_type);
CREATE INDEX IF NOT EXISTS idx_class_resources_created_at ON {{schema}}.class_resources(created_at);
CREATE INDEX IF NOT EXISTS idx_class_resources_teacher_id ON {{schema}}.class_resources(teacher_id) WHERE teacher_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_class_resources_created_by ON {{schema}}.class_resources(created_by) WHERE created_by IS NOT NULL;

-- Step 6: Add table and column comments
COMMENT ON TABLE {{schema}}.class_resources IS 'Unified table for class resources: supports both teacher-uploaded files and admin-managed resources (documents, links, files, videos)';
COMMENT ON COLUMN {{schema}}.class_resources.resource_type IS 'Type: document, link, file, or video';
COMMENT ON COLUMN {{schema}}.class_resources.teacher_id IS 'Optional: teacher who uploaded (for teacher-scoped resources)';
COMMENT ON COLUMN {{schema}}.class_resources.created_by IS 'User who created the resource (admin or teacher)';
