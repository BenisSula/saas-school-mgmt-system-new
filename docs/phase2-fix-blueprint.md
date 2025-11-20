# PHASE 2 — FIX BLUEPRINT

**Date:** 2025-01-XX  
**Status:** Complete Design  
**Branch:** `fix/superuser-flow-validation`

---

## EXECUTIVE SUMMARY

This document provides a comprehensive technical blueprint to fix all issues identified in Phase 1. It describes the exact changes needed, root causes, correct behaviors, affected files, database adjustments, and ensures multi-tenant safety and superuser visibility.

**No code is written in this phase** — only solution design.

---

## 1. SUPERUSER → ADMIN FLOW

### 1.1 Current Status
**Status:** ✅ **WORKING** — No changes needed

**Verified:**
- Route: `POST /superuser/schools/:id/admins`
- Permission: `tenants:manage` ✅
- Tenancy: Properly enforced ✅
- Audit: `ADMIN_CREATED` logged ✅
- Frontend: `SuperuserUsersPage.tsx` works correctly ✅

**Action Required:** None

---

## 2. ADMIN → HOD FLOW

### 2.1 Issue: HOD Role Assignment Mismatch

**Root Cause:**
- Backend updates `role` field directly to `'hod'`
- Frontend expects `role = 'teacher'` with `additional_roles` containing `'hod'`
- Inconsistent role structure between backend and frontend

**Correct Behavior:**
According to SaaS architecture, HODs should be:
- **Primary Role:** `teacher` (they are teachers first)
- **Additional Role:** `hod` (stored in `additional_roles` table)
- This allows HODs to retain teacher permissions while gaining HOD-specific permissions

**Solution Design:**

#### 2.1.1 Backend Changes

**File:** `backend/src/services/userService.ts` (lines 107-150)

**Change Required:**
- Instead of updating `role` field to `'hod'`, maintain `role = 'teacher'`
- Insert/update record in `additional_roles` table with `role = 'hod'`
- Query should check if `additional_roles` table exists (backward compatibility)
- If table doesn't exist, fall back to direct role update (with warning log)

**Logic:**
1. Verify user exists and belongs to tenant
2. Verify user's current role is `'teacher'` (HODs must be teachers)
3. Check if `additional_roles` table exists
4. If exists: Insert/update `additional_roles` record
5. If not exists: Update `role` field directly (legacy support)
6. Create audit log: `user_role_updated` with details
7. Return updated user object with `additional_roles` populated

**File:** `backend/src/routes/users.ts` (lines 104-125)

**Change Required:**
- No route changes needed
- Ensure response includes `additional_roles` array
- Update response type to include `additional_roles`

**Database Considerations:**
- Verify `additional_roles` table structure exists
- If missing, may need migration to create table
- Table structure: `user_id`, `role`, `granted_at`, `granted_by`

#### 2.1.2 Frontend Changes

**File:** `frontend/src/pages/admin/HODsManagementPage.tsx` (lines 82-88)

**Change Required:**
- Current filter logic is correct: `u.additional_roles?.some((r) => r.role === 'hod')`
- Ensure API response includes `additional_roles` array
- Update TypeScript types if needed

**File:** `frontend/src/lib/api.ts`

**Change Required:**
- Ensure `TenantUser` interface includes `additional_roles?: Array<{ role: string; granted_at?: string }>`
- Update API response types to match backend

**Multi-Tenant Safety:**
- ✅ Already enforced: User ID validated against tenant
- ✅ No cross-tenant access possible
- ✅ Audit log includes tenant context

**Superuser Visibility:**
- ✅ Audit log created with actor ID
- ✅ Action traceable in platform audit logs
- ✅ Tenant context preserved

---

## 3. HOD → TEACHER CREATION FLOW

### 3.1 Issue: HOD Cannot Create Teachers

**Root Cause:**
- Route `POST /users/register` requires `users:manage` permission
- HOD role does NOT have `users:manage` permission
- This blocks HODs from creating teachers

**Correct Behavior:**
**DECISION REQUIRED:** Should HODs be able to create teachers?

**Option A: HODs CAN create teachers**
- Grant `users:manage` permission to HOD role
- HODs can create teachers in their department
- Teachers created by HOD inherit HOD's tenant context

**Option B: HODs CANNOT create teachers (Current)**
- Only admins can create teachers
- HODs can only manage existing teachers
- Document this as intentional design decision

**Recommended Solution: Option A** (Grant permission to HOD)

**Solution Design:**

#### 3.1.1 Backend Changes

**File:** `backend/src/config/permissions.ts` (lines 67-76)

**Change Required:**
- Add `users:manage` to HOD permissions array
- Add `teachers:manage` to HOD permissions array (if not already present)
- This allows HODs to create and manage teachers

**Updated HOD Permissions:**
```typescript
hod: [
  'dashboard:view',
  'attendance:view',
  'exams:view',
  'grades:manage',
  'department-analytics',
  'reports:view',
  'performance:charts',
  'messages:send',
  'users:manage',        // NEW: Allow HOD to create teachers
  'teachers:manage'    // NEW: Allow HOD to manage teachers
]
```

**File:** `backend/src/routes/users.ts` (lines 46-68)

**Change Required:**
- No route changes needed
- Permission check `requirePermission('users:manage')` will now allow HODs
- Ensure tenant context is enforced (already done)

**File:** `backend/src/services/adminUserService.ts` (lines 44-103)

**Change Required:**
- Add audit log for teacher creation
- Action: `TEACHER_CREATED`
- Include: actor ID (HOD or admin), tenant ID, teacher details
- Log to both shared and tenant audit logs

**Multi-Tenant Safety:**
- ✅ Tenant context already enforced via `req.tenant.id`
- ✅ Teachers created by HOD inherit HOD's tenant
- ✅ No cross-tenant teacher creation possible

**Superuser Visibility:**
- ✅ Audit log: `TEACHER_CREATED` with actor ID
- ✅ Platform audit logs show HOD actions
- ✅ Tenant context preserved

---

## 4. TEACHER → STUDENTS / ATTENDANCE / GRADES FLOW

### 4.1 Issue: Teacher Student View Broken

**Root Cause:**
- Route `GET /students` requires `users:manage` permission
- Teachers only have `students:view_own_class` permission
- Teachers cannot access this endpoint

**Correct Behavior:**
- Teachers should be able to view students in their assigned classes
- Permission `students:view_own_class` should grant access
- Middleware `verifyTeacherAssignment` should verify teacher is assigned to the class

**Solution Design:**

#### 4.1.1 Backend Changes

**File:** `backend/src/routes/students.ts` (line 30)

**Change Required:**
- Replace `requirePermission('users:manage')` with conditional permission check
- Allow access if user has `users:manage` OR `students:view_own_class`
- Apply `verifyTeacherAssignment` middleware when `students:view_own_class` is used
- Admin bypass: Admins with `users:manage` can access all students

**New Logic:**
1. Check if user has `users:manage` → Full access (admin)
2. Check if user has `students:view_own_class` → Limited access (teacher)
3. If teacher: Apply `verifyTeacherAssignment` middleware
4. Filter students by teacher's assigned classes
5. Return only students from teacher's classes

**File:** `backend/src/middleware/verifyTeacherAssignment.ts`

**Change Required:**
- Ensure middleware extracts `classId` from query parameters
- Verify teacher is assigned to the class
- Return 403 if teacher not assigned to class
- Allow admins to bypass (already done via `allowAdmins: true`)

**Alternative Approach:**
- Create dedicated route: `GET /teachers/me/students`
- This route uses `students:view_own_class` permission
- Automatically filters by teacher's assigned classes
- Cleaner separation of concerns

**Recommended:** Use alternative approach (dedicated route)

**File:** `backend/src/routes/teachers.ts` (NEW ROUTE)

**Change Required:**
- Add route: `GET /teachers/me/students`
- Permission: `students:view_own_class`
- Middleware: `verifyTeacherAssignment` (optional, as route is teacher-specific)
- Service: Query students from teacher's assigned classes
- Return paginated list of students

**Multi-Tenant Safety:**
- ✅ Tenant context enforced via `ensureTenantContext()`
- ✅ Students filtered by tenant schema
- ✅ Teacher assignment verified within tenant
- ✅ No cross-tenant student access

**Superuser Visibility:**
- ✅ Audit log: `STUDENTS_VIEWED` (optional, for sensitive data)
- ✅ Platform audit logs show teacher actions
- ✅ Tenant context preserved

---

### 4.2 Issue: Teacher Attendance Marking Broken

**Root Cause:**
- Route `POST /attendance/mark` requires `attendance:manage` permission
- Teachers only have `attendance:mark` permission
- Teachers cannot mark attendance

**Correct Behavior:**
- Teachers should be able to mark attendance for their assigned classes
- Permission `attendance:mark` should grant access
- Middleware `verifyTeacherAssignment` already applied (good!)

**Solution Design:**

#### 4.2.1 Backend Changes

**File:** `backend/src/routes/attendance.ts` (line 31)

**Change Required:**
- Replace `requirePermission('attendance:manage')` with conditional check
- Allow access if user has `attendance:manage` OR `attendance:mark`
- Keep `verifyTeacherAssignment` middleware (already applied)
- Admin bypass: Admins with `attendance:manage` can mark for any class

**New Logic:**
1. Check if user has `attendance:manage` → Full access (admin)
2. Check if user has `attendance:mark` → Limited access (teacher)
3. If teacher: `verifyTeacherAssignment` middleware verifies class assignment
4. Mark attendance for students in the class
5. Create audit log: `ATTENDANCE_MARKED`

**File:** `backend/src/services/attendanceService.ts`

**Change Required:**
- Add audit log for attendance marking
- Action: `ATTENDANCE_MARKED`
- Include: actor ID, tenant ID, class ID, date, student count
- Log to tenant audit logs

**Multi-Tenant Safety:**
- ✅ Tenant context enforced via `ensureTenantContext()`
- ✅ Attendance marked in tenant schema
- ✅ Teacher assignment verified within tenant
- ✅ No cross-tenant attendance marking

**Superuser Visibility:**
- ✅ Audit log: `ATTENDANCE_MARKED` with actor ID
- ✅ Platform audit logs show teacher actions
- ✅ Tenant context preserved

---

### 4.3 Issue: Teacher Grade Entry Broken

**Root Cause:**
- Route `POST /grades/bulk` requires `grades:manage` permission (router level)
- Teachers only have `grades:enter` permission
- Teachers cannot enter grades

**Correct Behavior:**
- Teachers should be able to enter grades for their assigned classes
- Permission `grades:enter` should grant access
- Middleware `verifyTeacherAssignment` already applied (good!)

**Solution Design:**

#### 4.3.1 Backend Changes

**File:** `backend/src/routes/grades.ts` (line 16)

**Change Required:**
- Remove router-level `requirePermission('grades:manage')`
- Apply conditional permission check at route level
- Allow access if user has `grades:manage` OR `grades:enter`
- Keep `verifyTeacherAssignment` middleware (already applied)
- Admin bypass: Admins with `grades:manage` can enter grades for any class

**New Logic:**
1. Check if user has `grades:manage` → Full access (admin/HOD)
2. Check if user has `grades:enter` → Limited access (teacher)
3. If teacher: `verifyTeacherAssignment` middleware verifies class assignment
4. Bulk upsert grades for students in the class
5. Create audit log: `GRADES_ENTERED`

**File:** `backend/src/services/examService.ts`

**Change Required:**
- Add audit log for grade entry
- Action: `GRADES_ENTERED`
- Include: actor ID, tenant ID, exam ID, class ID, grade count
- Log to tenant audit logs

**Multi-Tenant Safety:**
- ✅ Tenant context enforced via `ensureTenantContext()`
- ✅ Grades entered in tenant schema
- ✅ Teacher assignment verified within tenant
- ✅ No cross-tenant grade entry

**Superuser Visibility:**
- ✅ Audit log: `GRADES_ENTERED` with actor ID
- ✅ Platform audit logs show teacher actions
- ✅ Tenant context preserved

---

## 5. ROLE ASSIGNMENT ALIGNMENT (ROLE VS ADDITIONAL_ROLES)

### 5.1 Issue: Inconsistent Role Structure

**Root Cause:**
- Backend uses direct `role` field updates
- Frontend expects `additional_roles` table
- No clear standard for role assignment

**Correct Behavior:**
According to SaaS architecture:
- **Primary Role:** Stored in `role` field (student, teacher, admin, superadmin)
- **Additional Roles:** Stored in `additional_roles` table (hod, class_teacher, etc.)
- HODs should have `role = 'teacher'` with `additional_roles` containing `hod`

**Solution Design:**

#### 5.1.1 Database Schema

**Table:** `shared.additional_roles` (verify exists)

**Structure:**
```sql
CREATE TABLE IF NOT EXISTS shared.additional_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES shared.users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL,
  granted_at TIMESTAMP NOT NULL DEFAULT NOW(),
  granted_by UUID REFERENCES shared.users(id),
  tenant_id UUID REFERENCES shared.tenants(id),
  UNIQUE(user_id, role, tenant_id)
);
```

**Migration Required:**
- Check if table exists
- If missing, create migration file
- Add indexes for performance

#### 5.1.2 Backend Service Changes

**File:** `backend/src/services/userService.ts` (lines 107-150)

**Change Required:**
- Create helper function: `assignAdditionalRole(userId, role, grantedBy, tenantId)`
- Update `updateTenantUserRole()` to handle HOD assignment correctly
- Logic:
  1. If assigning HOD: Keep `role = 'teacher'`, add `hod` to `additional_roles`
  2. If removing HOD: Remove `hod` from `additional_roles`
  3. If assigning other roles: Update `role` field directly
- Return user object with `additional_roles` populated

**File:** `backend/src/services/userService.ts` (NEW FUNCTION)

**Change Required:**
- Create: `getUserWithAdditionalRoles(userId, tenantId)`
- Query user with joined `additional_roles` table
- Return user object with `additional_roles` array populated
- Use this in all user retrieval functions

**File:** `backend/src/routes/users.ts`

**Change Required:**
- Update response to include `additional_roles` array
- Ensure all user list endpoints return `additional_roles`
- Update TypeScript types

#### 5.1.3 Frontend Changes

**File:** `frontend/src/lib/api.ts`

**Change Required:**
- Update `TenantUser` interface to include:
  ```typescript
  additional_roles?: Array<{
    role: string;
    granted_at?: string;
    granted_by?: string;
  }>;
  ```
- Ensure API responses match this structure

**File:** `frontend/src/pages/admin/HODsManagementPage.tsx`

**Change Required:**
- Current filter logic is correct
- Ensure API calls return `additional_roles`
- Update any hardcoded role checks

**Multi-Tenant Safety:**
- ✅ `additional_roles` table includes `tenant_id`
- ✅ Queries filter by tenant
- ✅ No cross-tenant role assignment

**Superuser Visibility:**
- ✅ `granted_by` field tracks who assigned the role
- ✅ Audit logs record role changes
- ✅ Platform audit logs show all role assignments

---

## 6. PERMISSION MATRIX CORRECTIONS

### 6.1 Current Permission Matrix Issues

**Issues:**
1. Teachers cannot access student/attendance/grade endpoints
2. HODs cannot create teachers (if we grant permission)
3. Permission checks use wrong permission types

**Solution Design:**

#### 6.1.1 Permission Matrix Updates

**File:** `backend/src/config/permissions.ts`

**Change Required:**

**HOD Permissions (Add):**
- `users:manage` — Allow HOD to create teachers
- `teachers:manage` — Allow HOD to manage teachers

**Teacher Permissions (Verify):**
- `students:view_own_class` ✅ (already present)
- `attendance:mark` ✅ (already present)
- `grades:enter` ✅ (already present)

**No changes needed to teacher permissions** — they are correct.

#### 6.1.2 Permission Check Updates

**File:** `backend/src/middleware/rbac.ts`

**Change Required:**
- Create helper: `requireAnyPermission(...permissions: Permission[])`
- Allows access if user has ANY of the specified permissions
- Use for routes that should allow multiple permission types

**Example Usage:**
```typescript
// Allow admin OR teacher
requireAnyPermission('users:manage', 'students:view_own_class')
```

**File:** `backend/src/routes/students.ts`

**Change Required:**
- Use `requireAnyPermission('users:manage', 'students:view_own_class')`
- Apply `verifyTeacherAssignment` when teacher permission is used

**File:** `backend/src/routes/attendance.ts`

**Change Required:**
- Use `requireAnyPermission('attendance:manage', 'attendance:mark')`
- Keep `verifyTeacherAssignment` middleware

**File:** `backend/src/routes/grades.ts`

**Change Required:**
- Remove router-level permission check
- Use `requireAnyPermission('grades:manage', 'grades:enter')` at route level
- Keep `verifyTeacherAssignment` middleware

**Multi-Tenant Safety:**
- ✅ Permission checks don't affect tenant isolation
- ✅ Tenant context still enforced separately
- ✅ No cross-tenant access possible

**Superuser Visibility:**
- ✅ Permission checks logged in audit logs
- ✅ Failed permission checks logged
- ✅ Platform audit logs show all permission checks

---

## 7. MISSING TEACHER ROUTES

### 7.1 Issue: No Dedicated Teacher Routes

**Root Cause:**
- Teachers must use admin routes
- Admin routes require admin permissions
- Teachers cannot access admin routes

**Correct Behavior:**
- Teachers should have dedicated routes for their workflows
- Routes should use teacher-specific permissions
- Routes should automatically filter by teacher's assigned classes

**Solution Design:**

#### 7.1.1 New Routes Required

**File:** `backend/src/routes/teachers.ts` (NEW ROUTES)

**Route 1: Get Teacher's Assigned Classes**
- **Path:** `GET /teachers/me/classes`
- **Permission:** `dashboard:view` (teachers have this)
- **Logic:**
  1. Get current teacher's ID from `req.user.id`
  2. Query `teacher_profiles` table for teacher's assigned classes
  3. Return list of classes with class details
  4. Include: class ID, name, subject, student count
- **Response:** `Array<{ id: string; name: string; subject: string; studentCount: number }>`

**Route 2: Get Students in Teacher's Classes**
- **Path:** `GET /teachers/me/students?classId={optional}`
- **Permission:** `students:view_own_class`
- **Logic:**
  1. Get current teacher's ID from `req.user.id`
  2. Get teacher's assigned classes
  3. If `classId` provided: Verify teacher is assigned to that class
  4. Query students from teacher's assigned classes
  5. Return paginated list of students
- **Response:** Paginated student list

**Route 3: Get Teacher's Profile**
- **Path:** `GET /teachers/me`
- **Permission:** `profile:view_self` (or `dashboard:view`)
- **Logic:**
  1. Get current teacher's ID from `req.user.id`
  2. Query teacher profile with assigned classes
  3. Return teacher profile with classes and subjects
- **Response:** Teacher profile object

**Multi-Tenant Safety:**
- ✅ All routes use `ensureTenantContext()`
- ✅ Queries filter by tenant schema
- ✅ Teacher ID validated against tenant
- ✅ No cross-tenant access

**Superuser Visibility:**
- ✅ Audit logs for route access (optional)
- ✅ Platform audit logs show teacher actions
- ✅ Tenant context preserved

---

## 8. MISSING AUDIT LOGS

### 8.1 Issue: Missing Audit Logs for Key Actions

**Root Cause:**
- Teacher creation doesn't log audit event
- Class assignment doesn't log audit event
- Student creation doesn't log audit event

**Correct Behavior:**
- All user creation actions should be logged
- All role/assignment changes should be logged
- Audit logs should include actor ID, tenant ID, and action details

**Solution Design:**

#### 8.1.1 Teacher Creation Audit Log

**File:** `backend/src/services/adminUserService.ts` (lines 44-103)

**Change Required:**
- Add audit log after teacher creation
- Action: `TEACHER_CREATED`
- Include:
  - Actor ID (admin or HOD who created)
  - Tenant ID
  - Teacher ID
  - Teacher email
  - Assigned classes (if any)
- Log to both shared and tenant audit logs

**Logic:**
1. Create teacher user and profile
2. Assign classes (if provided)
3. Create audit log: `TEACHER_CREATED`
4. Return created teacher object

#### 8.1.2 Class Assignment Audit Log

**File:** `backend/src/routes/teachers.ts` (class assignment routes)

**Change Required:**
- Add audit log after class assignment
- Action: `CLASS_ASSIGNED`
- Include:
  - Actor ID (admin who assigned)
  - Tenant ID
  - Teacher ID
  - Class ID
  - Assignment type (class_teacher, subject_teacher)
- Log to tenant audit logs

**Logic:**
1. Assign class to teacher
2. Create audit log: `CLASS_ASSIGNED`
3. Return updated teacher object

#### 8.1.3 Student Creation Audit Log

**File:** `backend/src/services/studentService.ts` (student creation function)

**Change Required:**
- Add audit log after student creation
- Action: `STUDENT_CREATED`
- Include:
  - Actor ID (admin who created)
  - Tenant ID
  - Student ID
  - Student email
  - Assigned class (if any)
- Log to tenant audit logs

**Logic:**
1. Create student user and profile
2. Assign class (if provided)
3. Create audit log: `STUDENT_CREATED`
4. Return created student object

**Multi-Tenant Safety:**
- ✅ Audit logs include tenant ID
- ✅ Shared audit logs filtered by tenant
- ✅ Tenant audit logs scoped to tenant
- ✅ No cross-tenant audit log access

**Superuser Visibility:**
- ✅ All audit logs visible in platform audit logs
- ✅ Actor ID tracks who performed action
- ✅ Tenant context preserved
- ✅ Searchable by tenant, actor, action type

---

## 9. RESTRICTION & PERMISSION PROPAGATION

### 9.1 Issue: Permission Restrictions Not Properly Propagated

**Root Cause:**
- Permission checks are hardcoded in routes
- No centralized permission validation
- Inconsistent permission checks across routes

**Correct Behavior:**
- Permission checks should be consistent
- Permission restrictions should propagate correctly
- Role hierarchy should be respected

**Solution Design:**

#### 9.1.1 Centralized Permission Helpers

**File:** `backend/src/middleware/rbac.ts` (NEW FUNCTIONS)

**Change Required:**
- Create: `requireAnyPermission(...permissions: Permission[])`
  - Allows access if user has ANY of the specified permissions
  - Returns middleware function
  - Logs permission check in audit logs

- Create: `requireAllPermissions(...permissions: Permission[])`
  - Allows access only if user has ALL specified permissions
  - Returns middleware function
  - Logs permission check in audit logs

- Create: `canAccessResource(userRole: Role, permission: Permission, resourceTenantId: string, userTenantId: string): boolean`
  - Checks if user can access resource
  - Validates tenant context
  - Validates permission
  - Returns boolean

#### 9.1.2 Permission Propagation Rules

**Rules:**
1. **Superadmin:** Has all permissions, can access all tenants
2. **Admin:** Has tenant-scoped permissions, can access only their tenant
3. **HOD:** Has department-scoped permissions, inherits teacher permissions
4. **Teacher:** Has class-scoped permissions, can access only assigned classes
5. **Student:** Has self-scoped permissions, can access only their own data

**Implementation:**
- Each role's permissions defined in `permissions.ts`
- Permission checks respect role hierarchy
- Tenant context always enforced
- Resource-level checks (class assignment) applied via middleware

**Multi-Tenant Safety:**
- ✅ Permission checks don't bypass tenant isolation
- ✅ Tenant context validated separately
- ✅ No cross-tenant permission grants

**Superuser Visibility:**
- ✅ Permission checks logged
- ✅ Failed permission checks logged
- ✅ Platform audit logs show all permission checks

---

## 10. TOP → BOTTOM USER FLOW INTEGRITY

### 10.1 Complete Flow Verification

**Flow 1: SuperUser → Admin Creation**
- **Status:** ✅ Working
- **Changes Required:** None

**Flow 2: Admin → HOD Assignment**
- **Status:** ⚠️ Needs Fix
- **Changes Required:**
  - Fix role assignment to use `additional_roles`
  - Update backend service
  - Update frontend types

**Flow 3: HOD → Teacher Creation**
- **Status:** ⚠️ Needs Fix
- **Changes Required:**
  - Grant `users:manage` to HOD
  - Add audit log for teacher creation
  - Verify tenant context

**Flow 4: Teacher → Student View**
- **Status:** ❌ Broken
- **Changes Required:**
  - Fix permission check in `/students` route
  - OR create dedicated `/teachers/me/students` route
  - Apply teacher assignment verification

**Flow 5: Teacher → Attendance Marking**
- **Status:** ❌ Broken
- **Changes Required:**
  - Fix permission check in `/attendance/mark` route
  - Keep `verifyTeacherAssignment` middleware
  - Add audit log

**Flow 6: Teacher → Grade Entry**
- **Status:** ❌ Broken
- **Changes Required:**
  - Fix permission check in `/grades/bulk` route
  - Keep `verifyTeacherAssignment` middleware
  - Add audit log

### 10.2 Flow Integrity Checklist

**Tenancy:**
- ✅ All flows enforce tenant context
- ✅ No cross-tenant access possible
- ✅ Tenant ID validated at every step

**Permissions:**
- ⚠️ Permission checks need updates
- ⚠️ Role hierarchy needs verification
- ⚠️ Permission propagation needs implementation

**Audit Logging:**
- ⚠️ Missing audit logs for teacher/student creation
- ⚠️ Missing audit logs for class assignment
- ✅ Audit logging infrastructure exists

**Role Structure:**
- ⚠️ HOD role structure needs alignment
- ⚠️ `additional_roles` table needs verification
- ⚠️ Role assignment logic needs update

**Frontend/Backend Alignment:**
- ⚠️ HOD role structure mismatch
- ⚠️ Permission assumptions mismatch
- ⚠️ API response types need updates

---

## 11. DATABASE ADJUSTMENTS

### 11.1 Additional Roles Table

**Table:** `shared.additional_roles`

**Verification:**
- Check if table exists
- If missing, create migration

**Migration File:** `backend/src/db/migrations/018_additional_roles.sql`

**Structure:**
```sql
CREATE TABLE IF NOT EXISTS shared.additional_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES shared.users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL,
  granted_at TIMESTAMP NOT NULL DEFAULT NOW(),
  granted_by UUID REFERENCES shared.users(id),
  tenant_id UUID REFERENCES shared.tenants(id),
  UNIQUE(user_id, role, tenant_id)
);

CREATE INDEX idx_additional_roles_user_id ON shared.additional_roles(user_id);
CREATE INDEX idx_additional_roles_tenant_id ON shared.additional_roles(tenant_id);
CREATE INDEX idx_additional_roles_role ON shared.additional_roles(role);
```

**Backward Compatibility:**
- If table doesn't exist, fall back to direct `role` field updates
- Log warning when falling back
- Create table in next migration

### 11.2 Audit Logs Table

**Table:** `shared.audit_logs` (verify structure)

**Verification:**
- Check if table has `tenant_id` column
- If missing, may need migration (but Phase 6 report says it's handled)

**No Changes Required:** Table structure is correct

---

## 12. AFFECTED FILES SUMMARY

### 12.1 Backend Files

| File | Lines | Change Type | Reason |
|------|-------|-------------|--------|
| `backend/src/config/permissions.ts` | 67-76 | Update | Add `users:manage` and `teachers:manage` to HOD |
| `backend/src/routes/students.ts` | 30 | Update | Fix permission check |
| `backend/src/routes/attendance.ts` | 31 | Update | Fix permission check |
| `backend/src/routes/grades.ts` | 16 | Update | Fix permission check |
| `backend/src/routes/users.ts` | 104-125 | Update | Fix HOD role assignment |
| `backend/src/routes/teachers.ts` | NEW | Create | Add teacher-specific routes |
| `backend/src/services/userService.ts` | 107-150 | Update | Fix role assignment logic |
| `backend/src/services/userService.ts` | NEW | Create | Add `assignAdditionalRole()` helper |
| `backend/src/services/userService.ts` | NEW | Create | Add `getUserWithAdditionalRoles()` helper |
| `backend/src/services/adminUserService.ts` | 44-103 | Update | Add audit log for teacher creation |
| `backend/src/services/studentService.ts` | TBD | Update | Add audit log for student creation |
| `backend/src/services/attendanceService.ts` | TBD | Update | Add audit log for attendance marking |
| `backend/src/services/examService.ts` | TBD | Update | Add audit log for grade entry |
| `backend/src/middleware/rbac.ts` | NEW | Create | Add `requireAnyPermission()` helper |
| `backend/src/middleware/verifyTeacherAssignment.ts` | Review | Verify | Ensure works with query params |

### 12.2 Frontend Files

| File | Lines | Change Type | Reason |
|------|-------|-------------|--------|
| `frontend/src/lib/api.ts` | TBD | Update | Update `TenantUser` interface for `additional_roles` |
| `frontend/src/pages/admin/HODsManagementPage.tsx` | 82-88 | Verify | Ensure filter logic works with updated API |
| `frontend/src/pages/teacher/*` | All | Verify | Ensure teacher pages work with fixed permissions |

### 12.3 Database Files

| File | Change Type | Reason |
|------|-------------|--------|
| `backend/src/db/migrations/018_additional_roles.sql` | Create | Create `additional_roles` table if missing |

---

## 13. IMPLEMENTATION PRIORITY

### 13.1 Critical (Blocking Teacher Workflows)

1. **Fix Teacher Student View** — Priority 1
   - Blocks core teacher functionality
   - Affects all teacher pages

2. **Fix Teacher Attendance Marking** — Priority 1
   - Blocks critical teacher workflow
   - Affects attendance recording

3. **Fix Teacher Grade Entry** — Priority 1
   - Blocks critical teacher workflow
   - Affects grade submission

### 13.2 High Priority (Affecting HOD Workflow)

4. **Fix HOD Role Assignment** — Priority 2
   - Affects HOD management
   - Frontend/backend mismatch

5. **Grant HOD Permissions** — Priority 2
   - Allows HOD to create teachers
   - Clarifies HOD capabilities

### 13.3 Medium Priority (Completeness)

6. **Add Missing Audit Logs** — Priority 3
   - Improves traceability
   - Doesn't block functionality

7. **Add Teacher Routes** — Priority 3
   - Improves API design
   - Not blocking (can use existing routes after fixes)

---

## 14. ENGINEERING PRINCIPLES APPLICATION

### 14.1 DRY (Don't Repeat Yourself)

**Application:**
- Create `requireAnyPermission()` helper to avoid duplicate permission checks
- Create `assignAdditionalRole()` helper to avoid duplicate role assignment logic
- Create `getUserWithAdditionalRoles()` helper to avoid duplicate user queries
- Centralize audit logging calls

**Files:**
- `backend/src/middleware/rbac.ts` — Permission helpers
- `backend/src/services/userService.ts` — Role assignment helpers

### 14.2 Modularity

**Application:**
- Keep routes separate by domain
- Keep services separate by feature
- Keep middleware reusable
- Keep helpers in appropriate modules

**Structure:**
- Routes: `backend/src/routes/*`
- Services: `backend/src/services/*`
- Middleware: `backend/src/middleware/*`
- Helpers: `backend/src/lib/*`

### 14.3 Test-Before-Delete

**Application:**
- Verify existing tests before making changes
- Add tests for new functionality
- Ensure backward compatibility

**Action:**
- Review existing tests
- Add tests for permission fixes
- Add tests for role assignment
- Add tests for audit logging

### 14.4 Clean File Structure

**Application:**
- Keep routes organized by domain
- Keep services organized by feature
- Keep helpers in lib directory
- Maintain consistent naming

**Structure:**
- No file structure changes needed
- Add new routes to existing files
- Add new helpers to existing modules

### 14.5 Security

**Application:**
- Permission checks at every endpoint
- Tenant context enforced at every endpoint
- Resource-level checks via middleware
- Audit logging for all sensitive actions

**Verification:**
- All routes have permission checks
- All routes enforce tenant context
- All routes verify resource access
- All actions are audited

### 14.6 Tenancy Isolation

**Application:**
- Tenant ID validated at every step
- Queries filter by tenant schema
- No cross-tenant access possible
- Tenant context preserved in audit logs

**Verification:**
- All routes use `ensureTenantContext()`
- All services receive tenant context
- All queries filter by tenant
- All audit logs include tenant ID

---

## 15. MULTI-TENANT SAFETY VERIFICATION

### 15.1 Tenant Context Enforcement

**Verified:**
- ✅ All routes use `tenantResolver()` middleware
- ✅ All routes use `ensureTenantContext()` middleware
- ✅ All services receive tenant context
- ✅ All queries filter by tenant

**No Changes Required:** Tenant isolation is properly enforced

### 15.2 Cross-Tenant Access Prevention

**Verified:**
- ✅ User ID validated against tenant
- ✅ Resource ID validated against tenant
- ✅ No hardcoded tenant IDs
- ✅ No cross-tenant queries

**No Changes Required:** Cross-tenant access is prevented

---

## 16. SUPERUSER VISIBILITY VERIFICATION

### 16.1 Audit Logging

**Verified:**
- ✅ Audit logging infrastructure exists
- ✅ Shared audit logs for platform events
- ✅ Tenant audit logs for tenant events
- ✅ Actor ID tracked in all logs

**Changes Required:**
- Add missing audit logs for teacher/student creation
- Add missing audit logs for class assignment
- Add audit logs for attendance/grades

### 16.2 Activity Traceability

**Verified:**
- ✅ All actions include actor ID
- ✅ All actions include tenant ID
- ✅ All actions include timestamp
- ✅ Platform audit logs searchable

**No Changes Required:** Traceability infrastructure is correct

---

## 17. SOLUTION SUMMARY

### 17.1 Permission Fixes

1. **Students Route:** Use `requireAnyPermission('users:manage', 'students:view_own_class')`
2. **Attendance Route:** Use `requireAnyPermission('attendance:manage', 'attendance:mark')`
3. **Grades Route:** Use `requireAnyPermission('grades:manage', 'grades:enter')`
4. **HOD Permissions:** Add `users:manage` and `teachers:manage`

### 17.2 Role Assignment Fixes

1. **HOD Assignment:** Use `additional_roles` table instead of direct `role` update
2. **Role Retrieval:** Join `additional_roles` table in user queries
3. **Frontend Types:** Update to include `additional_roles` array

### 17.3 Missing Routes

1. **Teacher Classes:** `GET /teachers/me/classes`
2. **Teacher Students:** `GET /teachers/me/students`
3. **Teacher Profile:** `GET /teachers/me`

### 17.4 Missing Audit Logs

1. **Teacher Creation:** `TEACHER_CREATED`
2. **Class Assignment:** `CLASS_ASSIGNED`
3. **Student Creation:** `STUDENT_CREATED`
4. **Attendance Marking:** `ATTENDANCE_MARKED`
5. **Grade Entry:** `GRADES_ENTERED`

### 17.5 Database Adjustments

1. **Additional Roles Table:** Verify/create `shared.additional_roles` table
2. **Indexes:** Add indexes for performance
3. **Backward Compatibility:** Fall back to direct role updates if table missing

---

## 18. RISK ASSESSMENT

### 18.1 Low Risk Changes

- Adding audit logs (no breaking changes)
- Adding new routes (additive only)
- Adding permission helpers (additive only)

### 18.2 Medium Risk Changes

- Fixing permission checks (may affect existing functionality)
- Updating role assignment logic (may affect existing HODs)
- Adding HOD permissions (may affect security)

### 18.3 Mitigation Strategies

1. **Backward Compatibility:** Maintain fallback for `additional_roles` table
2. **Gradual Rollout:** Fix one route at a time
3. **Testing:** Test each fix independently
4. **Monitoring:** Monitor audit logs for issues

---

## 19. TESTING STRATEGY

### 19.1 Unit Tests

- Test permission helpers
- Test role assignment logic
- Test audit logging functions

### 19.2 Integration Tests

- Test teacher student view flow
- Test teacher attendance marking flow
- Test teacher grade entry flow
- Test HOD teacher creation flow

### 19.3 End-to-End Tests

- Test complete SuperUser → Admin → HOD → Teacher → Student flow
- Test permission propagation
- Test tenant isolation
- Test audit logging

---

## 20. DEPLOYMENT PLAN

### 20.1 Phase 1: Critical Fixes

1. Fix teacher permission checks (students, attendance, grades)
2. Test teacher workflows
3. Deploy to staging
4. Verify teacher functionality

### 20.2 Phase 2: HOD Fixes

1. Fix HOD role assignment
2. Grant HOD permissions
3. Test HOD workflows
4. Deploy to staging
5. Verify HOD functionality

### 20.3 Phase 3: Completeness

1. Add missing audit logs
2. Add teacher-specific routes
3. Test all flows
4. Deploy to production

---

## 21. CONCLUSION

This blueprint provides a complete technical design to fix all issues identified in Phase 1. It ensures:

- ✅ Multi-tenant safety maintained
- ✅ Superuser visibility preserved
- ✅ DRY principles applied
- ✅ Security maintained
- ✅ Backward compatibility considered
- ✅ Testing strategy defined
- ✅ Deployment plan outlined

**Ready for Phase 3: Implementation**

---

**PHASE 2 COMPLETE — READY FOR PHASE 3**

