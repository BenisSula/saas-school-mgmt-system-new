-- Migration: Consolidate class_resources tables
-- Date: 2025-01-24
-- Description: Merges old teacher-scoped class_resources (027) with new admin-scoped class_resources (032)
--              into a unified schema that supports both use cases

-- Step 1: Check if old schema exists (027) and migrate data
DO $$
DECLARE
  old_table_exists BOOLEAN;
  new_table_exists BOOLEAN;
  has_old_columns BOOLEAN;
  has_new_columns BOOLEAN;
BEGIN
  -- Check if class_resources table exists
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = '{{schema}}' 
    AND table_name = 'class_resources'
  ) INTO old_table_exists;

  IF old_table_exists THEN
    -- Check which columns exist
    SELECT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = '{{schema}}' 
      AND table_name = 'class_resources' 
      AND column_name = 'teacher_id'
    ) INTO has_old_columns;

    SELECT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = '{{schema}}' 
      AND table_name = 'class_resources' 
      AND column_name = 'resource_type'
    ) INTO has_new_columns;

    -- If we have old columns but not new ones, migrate to unified schema
    IF has_old_columns AND NOT has_new_columns THEN
      -- Add new columns to support unified schema
      ALTER TABLE {{schema}}.class_resources
        ADD COLUMN IF NOT EXISTS resource_type TEXT,
        ADD COLUMN IF NOT EXISTS resource_url TEXT,
        ADD COLUMN IF NOT EXISTS file_name TEXT,
        ADD COLUMN IF NOT EXISTS file_size INTEGER,
        ADD COLUMN IF NOT EXISTS mime_type TEXT,
        ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES shared.users(id),
        ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES shared.users(id);

      -- Migrate data: map old columns to new schema
      UPDATE {{schema}}.class_resources
      SET 
        resource_type = CASE 
          WHEN file_type LIKE 'video%' THEN 'video'
          WHEN file_type LIKE 'image%' THEN 'file'
          WHEN file_url LIKE 'http://%' OR file_url LIKE 'https://%' THEN 'link'
          ELSE 'document'
        END,
        resource_url = COALESCE(resource_url, file_url),
        file_name = CASE 
          WHEN file_url LIKE '%/%' THEN substring(file_url from '[^/]+$')
          ELSE NULL
        END,
        file_size = size,
        mime_type = file_type,
        created_by = (
          SELECT id FROM shared.users 
          WHERE tenant_id = class_resources.tenant_id 
          AND id IN (SELECT id FROM {{schema}}.teachers WHERE id = class_resources.teacher_id)
          LIMIT 1
        ),
        updated_by = created_by
      WHERE resource_type IS NULL;

      -- Add constraint for resource_type
      ALTER TABLE {{schema}}.class_resources
        ADD CONSTRAINT check_resource_type 
        CHECK (resource_type IN ('document', 'link', 'file', 'video'));

      -- Convert class_id from TEXT to UUID if needed (if classes table uses UUID)
      -- First check if classes.id is UUID
      DO $$
      DECLARE
        classes_id_type TEXT;
      BEGIN
        SELECT data_type INTO classes_id_type
        FROM information_schema.columns
        WHERE table_schema = '{{schema}}'
        AND table_name = 'classes'
        AND column_name = 'id';

        IF classes_id_type = 'uuid' THEN
          -- Try to convert class_id to UUID where possible
          -- Keep TEXT for non-UUID values (backward compatibility)
          -- We'll keep class_id as TEXT for now to avoid breaking existing data
        END IF;
      END $$;

      -- Add foreign key for class_id if it's UUID (optional, for new records)
      -- We keep class_id flexible (TEXT or UUID) for backward compatibility
    END IF;

    -- If we have new columns but not old ones, add old columns for backward compatibility
    IF has_new_columns AND NOT has_old_columns THEN
      -- Add teacher_id and tenant_id for backward compatibility (nullable)
      ALTER TABLE {{schema}}.class_resources
        ADD COLUMN IF NOT EXISTS tenant_id UUID,
        ADD COLUMN IF NOT EXISTS teacher_id UUID REFERENCES {{schema}}.teachers(id) ON DELETE SET NULL;

      -- Try to populate teacher_id from created_by if it's a teacher
      UPDATE {{schema}}.class_resources cr
      SET teacher_id = (
        SELECT t.id FROM {{schema}}.teachers t
        WHERE t.id::text = (
          SELECT u.id::text FROM shared.users u WHERE u.id = cr.created_by
        )
        LIMIT 1
      )
      WHERE teacher_id IS NULL AND created_by IS NOT NULL;
    END IF;

    -- Ensure all required columns exist (unified schema)
    ALTER TABLE {{schema}}.class_resources
      ADD COLUMN IF NOT EXISTS resource_type TEXT,
      ADD COLUMN IF NOT EXISTS resource_url TEXT,
      ADD COLUMN IF NOT EXISTS file_name TEXT,
      ADD COLUMN IF NOT EXISTS file_size INTEGER,
      ADD COLUMN IF NOT EXISTS mime_type TEXT,
      ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES shared.users(id),
      ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES shared.users(id),
      ADD COLUMN IF NOT EXISTS tenant_id UUID,
      ADD COLUMN IF NOT EXISTS teacher_id UUID REFERENCES {{schema}}.teachers(id) ON DELETE SET NULL;

    -- Ensure resource_type has constraint
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'check_resource_type' 
        AND conrelid = '{{schema}}.class_resources'::regclass
      ) THEN
        ALTER TABLE {{schema}}.class_resources
          ADD CONSTRAINT check_resource_type 
          CHECK (resource_type IN ('document', 'link', 'file', 'video'));
      END IF;
    END $$;

    -- Set default resource_type for existing records
    UPDATE {{schema}}.class_resources
    SET resource_type = CASE 
      WHEN resource_type IS NULL AND mime_type LIKE 'video%' THEN 'video'
      WHEN resource_type IS NULL AND mime_type LIKE 'image%' THEN 'file'
      WHEN resource_type IS NULL AND (resource_url LIKE 'http://%' OR resource_url LIKE 'https://%') THEN 'link'
      WHEN resource_type IS NULL THEN 'document'
      ELSE resource_type
    END
    WHERE resource_type IS NULL;

    -- Ensure resource_url is populated
    UPDATE {{schema}}.class_resources
    SET resource_url = COALESCE(resource_url, file_url)
    WHERE resource_url IS NULL AND file_url IS NOT NULL;

    -- Update indexes
    CREATE INDEX IF NOT EXISTS idx_class_resources_resource_type ON {{schema}}.class_resources(resource_type);
    CREATE INDEX IF NOT EXISTS idx_class_resources_teacher_id ON {{schema}}.class_resources(teacher_id) WHERE teacher_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_class_resources_created_by ON {{schema}}.class_resources(created_by) WHERE created_by IS NOT NULL;

    -- Add comments
    COMMENT ON TABLE {{schema}}.class_resources IS 'Unified table for class resources: supports both teacher-uploaded files and admin-managed resources (documents, links, files, videos)';
    COMMENT ON COLUMN {{schema}}.class_resources.resource_type IS 'Type: document, link, file, or video';
    COMMENT ON COLUMN {{schema}}.class_resources.teacher_id IS 'Optional: teacher who uploaded (for teacher-scoped resources)';
    COMMENT ON COLUMN {{schema}}.class_resources.created_by IS 'User who created the resource (admin or teacher)';
  ELSE
    -- Table doesn't exist, create unified schema from scratch
    CREATE TABLE {{schema}}.class_resources (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      class_id TEXT NOT NULL, -- Keep as TEXT for flexibility (can be UUID or text identifier)
      title TEXT NOT NULL,
      description TEXT,
      resource_type TEXT NOT NULL CHECK (resource_type IN ('document', 'link', 'file', 'video')),
      resource_url TEXT NOT NULL,
      file_name TEXT,
      file_size INTEGER,
      mime_type TEXT,
      -- Support both old and new patterns
      tenant_id UUID,
      teacher_id UUID REFERENCES {{schema}}.teachers(id) ON DELETE SET NULL,
      created_by UUID REFERENCES shared.users(id),
      updated_by UUID REFERENCES shared.users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Create indexes
    CREATE INDEX idx_class_resources_class_id ON {{schema}}.class_resources(class_id);
    CREATE INDEX idx_class_resources_resource_type ON {{schema}}.class_resources(resource_type);
    CREATE INDEX idx_class_resources_created_at ON {{schema}}.class_resources(created_at);
    CREATE INDEX idx_class_resources_teacher_id ON {{schema}}.class_resources(teacher_id) WHERE teacher_id IS NOT NULL;
    CREATE INDEX idx_class_resources_created_by ON {{schema}}.class_resources(created_by) WHERE created_by IS NOT NULL;

    -- Add comments
    COMMENT ON TABLE {{schema}}.class_resources IS 'Unified table for class resources: supports both teacher-uploaded files and admin-managed resources';
  END IF;
END $$;

