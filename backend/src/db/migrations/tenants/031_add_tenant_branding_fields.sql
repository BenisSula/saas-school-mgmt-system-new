-- Migration: Add enhanced tenant branding fields
-- Adds accentColor and faviconUrl to branding_settings table
-- Date: 2025-11-24
-- Note: typography column already exists from 001_core_tables.sql

-- Add accent_color column if it doesn't exist
ALTER TABLE {{schema}}.branding_settings
  ADD COLUMN IF NOT EXISTS accent_color TEXT;

-- Add favicon_url column if it doesn't exist
ALTER TABLE {{schema}}.branding_settings
  ADD COLUMN IF NOT EXISTS favicon_url TEXT;

-- Add comments for documentation
COMMENT ON COLUMN {{schema}}.branding_settings.accent_color IS 'Accent color for tenant branding (hex format)';
COMMENT ON COLUMN {{schema}}.branding_settings.favicon_url IS 'URL to tenant favicon (CDN or local path)';

