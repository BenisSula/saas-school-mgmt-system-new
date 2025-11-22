-- Migration: Add metadata column to additional_roles table
-- Date: 2025-01-XX
-- Phase: Phase 1 - Fix Placeholder Buttons

-- Add metadata column to store department and other role-specific data
ALTER TABLE shared.additional_roles 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Create index on metadata for efficient queries
CREATE INDEX IF NOT EXISTS idx_additional_roles_metadata ON shared.additional_roles USING GIN (metadata);

