# SuperUser Dashboard Implementation Plan

## Current Status Analysis

### ✅ Already Implemented

#### Backend:
- ✅ Superuser routes structure (`/superuser/*`)
- ✅ School management endpoints
- ✅ User management endpoints (cross-tenant)
- ✅ Audit log endpoints
- ✅ Reports endpoints
- ✅ Session management
- ✅ Password management
- ✅ Subscription management
- ✅ Data management (backups, exports, imports, GDPR)

#### Database:
- ✅ `shared.audit_logs` (platform activity logs)
- ✅ `shared.login_attempts` (platform login logs)
- ✅ `shared.user_sessions` (session tracking)
- ✅ `shared.subscriptions` (school subscriptions)
- ✅ `shared.tenants` (schools table)
- ✅ `shared.users` (superusers are users with role='superadmin')

#### Frontend:
- ✅ Superuser dashboard page
- ✅ Users management page
- ✅ Schools management page
- ✅ Reports page
- ✅ Activity monitoring page
- ✅ Settings page

### ❌ Missing/Needs Enhancement

#### Backend:
1. **Maintenance Routes** (NEW)
   - POST `/superuser/maintenance/run-migrations`
   - POST `/superuser/maintenance/clear-cache/:schoolId`
   - GET `/superuser/maintenance/schema-health`

2. **Superuser Authentication** (ENHANCE)
   - POST `/superuser/login` (separate from regular login)
   - GET `/superuser/profile`
   - PATCH `/superuser/update-password`

3. **Enhanced Reports** (ENHANCE)
   - GET `/superuser/reports/summary` (platform-wide summary)
   - GET `/superuser/reports/usage` (usage statistics)
   - GET `/superuser/reports/top-schools` (most active schools)

#### Frontend:
1. **Maintenance Page** (NEW)
   - Run migrations interface
   - Clear cache interface
   - Schema health checker

2. **Enhanced Pages** (ENHANCE)
   - Schools page: Add suspend/upgrade/regenerate admin buttons
   - Users page: Ensure all filters work
   - Audit page: Enhanced filtering
   - Reports page: Download CSV/PDF functionality

## Implementation Strategy

### Phase 1: Backend Maintenance Routes
1. Create maintenance service
2. Create maintenance routes
3. Add audit logging

### Phase 2: Superuser Authentication
1. Enhance auth routes for superuser-specific login
2. Add profile endpoint
3. Add password update endpoint

### Phase 3: Frontend Maintenance Page
1. Create maintenance page component
2. Add API integration
3. Add confirmation dialogs

### Phase 4: Enhancements
1. Enhance existing pages with missing features
2. Add download functionality
3. Improve filtering and search

## Files to Create/Modify

### Backend:
- `backend/src/services/superuser/maintenanceService.ts` (NEW)
- `backend/src/routes/superuser/maintenance.ts` (NEW)
- `backend/src/routes/superuser.ts` (MODIFY - add maintenance router)
- `backend/src/routes/auth.ts` (MODIFY - add superuser login)

### Frontend:
- `frontend/src/pages/superuser/maintenance/page.tsx` (NEW)
- `frontend/src/components/superuser/MaintenancePanel.tsx` (NEW)
- `frontend/src/hooks/queries/useSuperuserQueries.ts` (MODIFY - add maintenance hooks)
- `frontend/src/lib/api.ts` (MODIFY - add maintenance API methods)

## Security Considerations

1. All maintenance operations must be logged
2. Confirmation required for destructive operations
3. Rate limiting on maintenance endpoints
4. RBAC enforcement (superuser only)
5. Audit trail for all actions

## DRY Principles

1. Reuse existing audit logging service
2. Reuse existing validation schemas
3. Reuse existing error handling
4. Reuse existing authentication middleware
5. Extract shared utilities to `lib/` or `utils/`

