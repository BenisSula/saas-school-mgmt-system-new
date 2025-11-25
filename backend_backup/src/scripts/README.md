# Backend Scripts

This directory contains utility scripts for backend operations.

## Available Scripts

### runPhase7Migrations.ts

Runs Phase 7 migrations (026, 027, 028) for all existing tenants.

**Usage:**
```bash
cd backend
npx ts-node src/scripts/runPhase7Migrations.ts
```

**What it does:**
- Fetches all existing tenants from the database
- Runs tenant migrations for each tenant schema
- Reports success/failure for each tenant
- Provides a summary at the end

**Migrations included:**
- `026_add_attendance_indexes.sql` - Adds performance indexes to attendance_records
- `027_add_class_resources_table.sql` - Creates class_resources table for file uploads
- `028_add_class_announcements_table.sql` - Creates class_announcements table for teacher announcements

**Note:** New tenants will automatically get these migrations when they are created. This script is for updating existing tenants.

