-- Migration: Add indexes to attendance_records table for performance
-- Date: 2025-01-XX
-- Phase: 7 - Teacher Layer Enhancements

-- Index on class_id and date for faster class attendance queries
CREATE INDEX IF NOT EXISTS idx_attendance_records_class_date 
ON {{schema}}.attendance_records(class_id, attendance_date);

-- Index on student_id and date for faster student attendance queries
CREATE INDEX IF NOT EXISTS idx_attendance_records_student_date 
ON {{schema}}.attendance_records(student_id, attendance_date);

-- Composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_attendance_records_class_student_date 
ON {{schema}}.attendance_records(class_id, student_id, attendance_date);

