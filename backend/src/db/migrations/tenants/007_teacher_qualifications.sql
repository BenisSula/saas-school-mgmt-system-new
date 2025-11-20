-- Add qualifications and years_of_experience to teachers table
ALTER TABLE {{schema}}.teachers
  ADD COLUMN IF NOT EXISTS qualifications TEXT,
  ADD COLUMN IF NOT EXISTS years_of_experience INTEGER DEFAULT 0;

