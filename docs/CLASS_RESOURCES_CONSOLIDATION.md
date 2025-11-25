# Class Resources Consolidation

## Overview

This document describes the consolidation of two separate class resources implementations into a unified system.

## Problem

Two different implementations existed:

1. **Old Implementation (Migration 027)**:
   - Teacher-scoped resources
   - Schema: `tenant_id`, `teacher_id`, `class_id` (TEXT), `file_url`, `file_type`, `size`
   - Service: `backend/src/services/classResourcesService.ts`
   - Used by: Teacher routes (`/teachers/resources/*`)

2. **New Implementation (Migration 032)**:
   - Admin-scoped resources
   - Schema: `class_id` (UUID), `resource_type`, `resource_url`, `file_name`, `file_size`, `mime_type`, `created_by`, `updated_by`
   - Service: `backend/src/services/classResources/classResourcesService.ts`
   - Used by: Admin routes (`/api/class-resources`)

## Solution

### Unified Schema (Migration 033)

The consolidated schema supports both use cases:

```sql
CREATE TABLE {{schema}}.class_resources (
  id UUID PRIMARY KEY,
  class_id TEXT NOT NULL, -- Flexible: can be UUID or text identifier
  title TEXT NOT NULL,
  description TEXT,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('document', 'link', 'file', 'video')),
  resource_url TEXT NOT NULL,
  file_name TEXT,
  file_size INTEGER,
  mime_type TEXT,
  -- Legacy fields (for backward compatibility)
  tenant_id UUID,
  teacher_id UUID REFERENCES {{schema}}.teachers(id) ON DELETE SET NULL,
  -- New fields
  created_by UUID REFERENCES shared.users(id),
  updated_by UUID REFERENCES shared.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Unified Service

**File**: `backend/src/services/classResources/unifiedClassResourcesService.ts`

**Features**:
- Supports both teacher-scoped (file uploads) and admin-scoped (URL resources)
- Backward compatible with existing routes
- Unified interface for all operations
- Proper type mapping between old and new formats

**Key Functions**:
- `listClassResources()` - List with filters (supports both scopes)
- `getClassResources()` - Get by class (backward compatible)
- `getClassResource()` - Get by ID
- `createClassResource()` - Admin-scoped creation
- `uploadClassResource()` - Teacher-scoped file upload
- `updateClassResource()` - Update any resource
- `deleteClassResource()` - Delete with ownership verification

### Backward Compatibility

**File**: `backend/src/services/classResourcesService.ts`

This file now re-exports from the unified service with type mapping to maintain compatibility with:
- `backend/src/routes/teachers.ts`
- `backend/src/routes/students.ts`
- `backend/src/services/studentDashboardService.ts`

## Migration Steps

### 1. Run Schema Migration

```bash
cd backend
npm run migrate
```

This runs migration `033_consolidate_class_resources.sql` which:
- Detects existing schema
- Adds missing columns
- Migrates existing data
- Sets defaults for new fields

### 2. Run Data Migration (Optional)

If you have existing data that needs consolidation:

```bash
ts-node scripts/migrate-class-resources-data.ts
```

This script:
- Finds all tenants with class_resources
- Migrates old format to new format
- Sets resource_type based on file_type
- Maps teacher_id to created_by
- Populates missing fields

### 3. Verify Migration

Check that all resources have:
- `resource_type` set (document, link, file, or video)
- `resource_url` populated
- `created_by` set (from teacher_id if available)

## API Changes

### No Breaking Changes

All existing API endpoints continue to work:
- `POST /teachers/resources/upload` - Still works (teacher-scoped)
- `GET /teachers/resources?classId=...` - Still works
- `DELETE /teachers/resources/:id` - Still works
- `GET /api/class-resources` - Still works (admin-scoped)
- `POST /api/class-resources` - Still works (admin-scoped)

### New Capabilities

The unified service now supports:
- Filtering by `resourceType` (document, link, file, video)
- Filtering by `teacherId` (for teacher-scoped resources)
- Search by title/description
- Pagination
- Both teacher and admin can see all resources for a class

## Data Mapping

### Old Format → New Format

| Old Field | New Field | Notes |
|-----------|-----------|-------|
| `file_url` | `resource_url` | Direct mapping |
| `file_type` | `mime_type` | Direct mapping |
| `size` | `file_size` | Direct mapping |
| `file_type` | `resource_type` | Derived: video → 'video', image → 'file', http → 'link', else → 'document' |
| `teacher_id` | `created_by` | Looked up from teachers table |
| - | `file_name` | Extracted from `file_url` |

### New Format → Old Format (for backward compatibility)

The legacy service wrapper maps:
- `resource_url` → `file_url`
- `mime_type` → `file_type`
- `file_size` → `size`
- `created_by` → `teacher_id` (if available)

## Testing

### Manual Testing

1. **Teacher Upload** (old flow):
   ```bash
   POST /teachers/resources/upload
   # Should create resource with teacher_id and resource_type
   ```

2. **Admin Create** (new flow):
   ```bash
   POST /api/class-resources
   # Should create resource with created_by and resource_type
   ```

3. **List Resources**:
   ```bash
   GET /api/class-resources?classId=xxx
   # Should return both teacher-uploaded and admin-created resources
   ```

### Automated Testing

Run existing tests:
```bash
npm run test --prefix backend
```

## Rollback Plan

If issues occur:

1. The migration is idempotent - can be run multiple times
2. Old service file is preserved as wrapper
3. Data is not deleted, only enhanced
4. Can revert by removing new columns (not recommended)

## Benefits

1. **Single Source of Truth**: One table, one service
2. **Flexibility**: Supports both file uploads and URL resources
3. **Backward Compatible**: Existing code continues to work
4. **Type Safety**: Unified TypeScript interfaces
5. **Better Filtering**: Can filter by resource type, teacher, etc.
6. **Future Proof**: Easy to add new resource types

## Files Modified

- `backend/src/db/migrations/tenants/033_consolidate_class_resources.sql` - New migration
- `backend/src/services/classResources/unifiedClassResourcesService.ts` - New unified service
- `backend/src/services/classResources/classResourcesService.ts` - Re-exports from unified
- `backend/src/services/classResourcesService.ts` - Wrapper for backward compatibility
- `backend/src/routes/classResources.ts` - Updated to use unified service
- `scripts/migrate-class-resources-data.ts` - Data migration script

## Next Steps

1. Run migration: `npm run migrate --prefix backend`
2. Run data migration: `ts-node scripts/migrate-class-resources-data.ts`
3. Test teacher upload flow
4. Test admin create flow
5. Verify both appear in list endpoint
6. Update frontend if needed (should work as-is)

