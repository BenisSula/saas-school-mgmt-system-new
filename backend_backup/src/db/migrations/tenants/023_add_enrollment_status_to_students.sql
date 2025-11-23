-- Migration: Add enrollment_status column to students table
-- Date: 2025-01-XX
-- Phase: 2 - Fix Partially Functional Buttons (Enrollment Status Filter)
-- Note: This runs in tenant schema context (search_path is set to tenant schema)

-- Add enrollment_status column if it doesn't exist (PostgreSQL 9.5+)
ALTER TABLE students ADD COLUMN IF NOT EXISTS enrollment_status VARCHAR(20) DEFAULT 'active';

-- Add check constraint (drop first if exists to avoid errors on re-run)
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_enrollment_status_check;

-- Add check constraint
ALTER TABLE students ADD CONSTRAINT students_enrollment_status_check CHECK (enrollment_status IN ('active', 'graduated', 'transferred', 'suspended', 'withdrawn'));

-- Update existing students to have 'active' status if null
UPDATE students SET enrollment_status = 'active' WHERE enrollment_status IS NULL;

-- Create index for filtering
CREATE INDEX IF NOT EXISTS idx_students_enrollment_status ON students(enrollment_status);

