-- Migration: Create file_uploads table
-- Date: 2025-01-XX
-- Phase: 1 - Fix Placeholder Buttons (File Upload)

CREATE TABLE IF NOT EXISTS shared.file_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  file_url TEXT NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES shared.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES shared.tenants(id) ON DELETE CASCADE,
  description TEXT,
  entity_type TEXT CHECK (entity_type IN ('user', 'student', 'teacher', 'hod')),
  entity_id UUID,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_file_uploads_uploaded_by ON shared.file_uploads(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_file_uploads_tenant_id ON shared.file_uploads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_file_uploads_entity ON shared.file_uploads(entity_type, entity_id);

