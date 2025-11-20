# PHASE 3 — BACKEND IMPLEMENTATION TASKS

**Date:** 2025-01-XX  
**Status:** Task Breakdown Complete  
**Branch:** `fix/superuser-flow-validation`

---

## EXECUTIVE SUMMARY

This document provides atomic backend implementation tasks derived from the Phase 2 Fix Blueprint. Tasks are ordered by dependency to ensure proper implementation sequence. Each task includes target files, expected modifications, and follows DRY principles.

**No code is written in this phase** — only task breakdown.

---

## TASK DEPENDENCY ORDER

Tasks are ordered by dependency:
1. **Permission Matrix Updates** (foundation)
2. **Database Schema** (foundation)
3. **Middleware Helpers** (used by routes)
4. **Service Helpers** (used by routes)
5. **Permission Fixes** (uses middleware)
6. **Role Alignment** (uses service helpers)
7. **API Route Corrections** (uses middleware + services)
8. **Audit Logging** (uses services)
9. **New Teacher Routes** (uses middleware + services)

---

## TASK GROUP 1: PERMISSION MATRIX UPDATES

### Task 1.1: Update HOD Permissions

**Priority:** High  
**Dependencies:** None  
**Estimated Time:** 5 minutes

**Target File:** `backend/src/config/permissions.ts`

**Expected Modifications:**
- Add `users:manage` to HOD permissions array (line 67-76)
- Add `teachers:manage` to HOD permissions array
- Update HOD permissions array to include:
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
    'users:manage',        // NEW
    'teachers:manage'    // NEW
  ]
  ```

**DRY Principle:**
- No duplication — single source of truth for permissions
- Permissions defined once in `rolePermissions` object

**Verification:**
- Verify `hasPermission('hod', 'users:manage')` returns `true`
- Verify `hasPermission('hod', 'teachers:manage')` returns `true`

**Related Tasks:**
- Task 3.1 (HOD teacher creation) depends on this

---

## TASK GROUP 2: DATABASE SCHEMA

### Task 2.1: Create Additional Roles Table Migration

**Priority:** High  
**Dependencies:** None  
**Estimated Time:** 15 minutes

**Target File:** `backend/src/db/migrations/018_additional_roles.sql` (NEW FILE)

**Expected Modifications:**
- Create migration file
- Define `shared.additional_roles` table structure:
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
- Create indexes:
  ```sql
  CREATE INDEX idx_additional_roles_user_id ON shared.additional_roles(user_id);
  CREATE INDEX idx_additional_roles_tenant_id ON shared.additional_roles(tenant_id);
  CREATE INDEX idx_additional_roles_role ON shared.additional_roles(role);
  ```

**DRY Principle:**
- Single migration file
- Reusable table structure

**Verification:**
- Run migration successfully
- Verify table exists: `SELECT * FROM shared.additional_roles LIMIT 1;`
- Verify indexes exist

**Related Tasks:**
- Task 4.1 (Role assignment helpers) depends on this
- Task 4.2 (User retrieval with additional roles) depends on this

---

## TASK GROUP 3: MIDDLEWARE HELPERS

### Task 3.1: Create requireAnyPermission Middleware Helper

**Priority:** Critical  
**Dependencies:** Task 1.1 (Permission Matrix)  
**Estimated Time:** 20 minutes

**Target File:** `backend/src/middleware/rbac.ts`

**Expected Modifications:**
- Add new function: `requireAnyPermission(...permissions: Permission[])`
- Function signature:
  ```typescript
  export function requireAnyPermission(...permissions: Permission[]) {
    return (req: Request, res: Response, next: NextFunction) => {
      // Check if user has ANY of the specified permissions
      // Return 403 if none match
      // Call next() if at least one matches
    };
  }
  ```
- Logic:
  1. Extract user role from `req.user.role`
  2. Check if user has ANY of the specified permissions using `hasPermission()`
  3. If yes: call `next()`
  4. If no: return 403 with friendly message
  5. Log permission check failure (optional audit log)

**DRY Principle:**
- Reusable middleware function
- Avoids duplicating permission check logic across routes
- Uses existing `hasPermission()` helper

**Verification:**
- Test with teacher role and `students:view_own_class` permission
- Test with admin role and `users:manage` permission
- Test with user having no matching permissions (should return 403)

**Related Tasks:**
- Task 5.1 (Students route) uses this
- Task 5.2 (Attendance route) uses this
- Task 5.3 (Grades route) uses this

---

### Task 3.2: Create requireAllPermissions Middleware Helper (Optional)

**Priority:** Low  
**Dependencies:** Task 1.1 (Permission Matrix)  
**Estimated Time:** 15 minutes

**Target File:** `backend/src/middleware/rbac.ts`

**Expected Modifications:**
- Add new function: `requireAllPermissions(...permissions: Permission[])`
- Function signature:
  ```typescript
  export function requireAllPermissions(...permissions: Permission[]) {
    return (req: Request, res: Response, next: NextFunction) => {
      // Check if user has ALL of the specified permissions
      // Return 403 if any missing
      // Call next() if all present
    };
  }
  ```
- Logic:
  1. Extract user role from `req.user.role`
  2. Check if user has ALL of the specified permissions
  3. If yes: call `next()`
  4. If no: return 403 with friendly message

**DRY Principle:**
- Reusable middleware function
- Complements `requireAnyPermission()`

**Verification:**
- Test with user having all permissions
- Test with user missing one permission (should return 403)

**Related Tasks:**
- Not immediately required, but useful for future routes

---

## TASK GROUP 4: SERVICE HELPERS

### Task 4.1: Create assignAdditionalRole Helper Function

**Priority:** High  
**Dependencies:** Task 2.1 (Database Schema)  
**Estimated Time:** 30 minutes

**Target File:** `backend/src/services/userService.ts`

**Expected Modifications:**
- Add new function: `assignAdditionalRole()`
- Function signature:
  ```typescript
  export async function assignAdditionalRole(
    userId: string,
    role: string,
    grantedBy: string,
    tenantId: string
  ): Promise<void>
  ```
- Logic:
  1. Check if `shared.additional_roles` table exists (backward compatibility)
  2. If exists:
     - Insert or update record in `additional_roles` table
     - Use `ON CONFLICT (user_id, role, tenant_id) DO UPDATE`
  3. If not exists:
     - Log warning
     - Fall back to direct role update (legacy support)
  4. Handle errors gracefully

**DRY Principle:**
- Single function for role assignment logic
- Reusable across multiple routes
- Centralizes backward compatibility logic

**Verification:**
- Test with existing `additional_roles` table
- Test without table (should fall back gracefully)
- Test duplicate assignment (should update, not error)

**Related Tasks:**
- Task 6.1 (HOD role assignment) uses this
- Task 6.2 (Update role assignment service) uses this

---

### Task 4.2: Create getUserWithAdditionalRoles Helper Function

**Priority:** High  
**Dependencies:** Task 2.1 (Database Schema)  
**Estimated Time:** 25 minutes

**Target File:** `backend/src/services/userService.ts`

**Expected Modifications:**
- Add new function: `getUserWithAdditionalRoles()`
- Function signature:
  ```typescript
  export async function getUserWithAdditionalRoles(
    userId: string,
    tenantId: string
  ): Promise<TenantUser & { additional_roles?: Array<{ role: string; granted_at: string }> }>
  ```
- Logic:
  1. Query user from `shared.users` table
  2. LEFT JOIN `shared.additional_roles` table
  3. Aggregate additional roles into array
  4. Return user object with `additional_roles` populated
  5. Handle case where table doesn't exist (return empty array)

**DRY Principle:**
- Single function for user retrieval with roles
- Reusable across multiple services
- Centralizes role retrieval logic

**Verification:**
- Test with user having additional roles
- Test with user having no additional roles
- Test without `additional_roles` table (should return empty array)

**Related Tasks:**
- Task 6.2 (Update role assignment service) uses this
- Task 7.1 (Users route response) uses this

---

### Task 4.3: Create removeAdditionalRole Helper Function

**Priority:** Medium  
**Dependencies:** Task 2.1 (Database Schema)  
**Estimated Time:** 20 minutes

**Target File:** `backend/src/services/userService.ts`

**Expected Modifications:**
- Add new function: `removeAdditionalRole()`
- Function signature:
  ```typescript
  export async function removeAdditionalRole(
    userId: string,
    role: string,
    tenantId: string
  ): Promise<void>
  ```
- Logic:
  1. Check if `shared.additional_roles` table exists
  2. If exists: Delete record from `additional_roles` table
  3. If not exists: Log warning (no-op for legacy)
  4. Handle errors gracefully

**DRY Principle:**
- Single function for role removal logic
- Reusable across multiple routes

**Verification:**
- Test removing existing role
- Test removing non-existent role (should not error)
- Test without table (should log warning)

**Related Tasks:**
- Task 6.1 (HOD role assignment) uses this for removal

---

## TASK GROUP 5: PERMISSION FIXES

### Task 5.1: Fix Students Route Permission Check

**Priority:** Critical  
**Dependencies:** Task 3.1 (requireAnyPermission)  
**Estimated Time:** 15 minutes

**Target File:** `backend/src/routes/students.ts`

**Expected Modifications:**
- Line 30: Replace `requirePermission('users:manage')` with `requireAnyPermission('users:manage', 'students:view_own_class')`
- Add `verifyTeacherAssignment` middleware when teacher permission is used
- Logic:
  1. If user has `users:manage`: Full access (admin)
  2. If user has `students:view_own_class`: Limited access (teacher)
  3. If teacher: Apply `verifyTeacherAssignment` middleware
  4. Filter students by teacher's assigned classes

**DRY Principle:**
- Uses `requireAnyPermission()` helper (no duplication)
- Reuses existing `verifyTeacherAssignment` middleware

**Verification:**
- Test with admin user (should access all students)
- Test with teacher user (should access only assigned classes)
- Test with student user (should return 403)

**Related Tasks:**
- Task 8.1 (Teacher students route) provides alternative approach

---

### Task 5.2: Fix Attendance Route Permission Check

**Priority:** Critical  
**Dependencies:** Task 3.1 (requireAnyPermission)  
**Estimated Time:** 10 minutes

**Target File:** `backend/src/routes/attendance.ts`

**Expected Modifications:**
- Line 31: Replace `requirePermission('attendance:manage')` with `requireAnyPermission('attendance:manage', 'attendance:mark')`
- Keep `verifyTeacherAssignment` middleware (already applied, line 33)
- No other changes needed

**DRY Principle:**
- Uses `requireAnyPermission()` helper (no duplication)
- Reuses existing `verifyTeacherAssignment` middleware

**Verification:**
- Test with admin user (should mark attendance for any class)
- Test with teacher user (should mark attendance for assigned classes)
- Test with teacher user on non-assigned class (should return 403)

**Related Tasks:**
- Task 9.1 (Attendance audit log) adds logging

---

### Task 5.3: Fix Grades Route Permission Check

**Priority:** Critical  
**Dependencies:** Task 3.1 (requireAnyPermission)  
**Estimated Time:** 15 minutes

**Target File:** `backend/src/routes/grades.ts`

**Expected Modifications:**
- Line 16: Remove router-level `requirePermission('grades:manage')`
- Line 29: Add `requireAnyPermission('grades:manage', 'grades:enter')` at route level
- Keep `verifyTeacherAssignment` middleware (already applied, line 32)
- Ensure middleware order is correct

**DRY Principle:**
- Uses `requireAnyPermission()` helper (no duplication)
- Reuses existing `verifyTeacherAssignment` middleware

**Verification:**
- Test with admin user (should enter grades for any class)
- Test with teacher user (should enter grades for assigned classes)
- Test with teacher user on non-assigned class (should return 403)

**Related Tasks:**
- Task 9.2 (Grades audit log) adds logging

---

## TASK GROUP 6: ROLE ALIGNMENT

### Task 6.1: Update HOD Role Assignment Logic

**Priority:** High  
**Dependencies:** Task 4.1 (assignAdditionalRole), Task 4.3 (removeAdditionalRole)  
**Estimated Time:** 40 minutes

**Target File:** `backend/src/services/userService.ts`

**Expected Modifications:**
- Function: `updateTenantUserRole()` (lines 107-150)
- Logic changes:
  1. If assigning HOD role:
     - Verify user's current role is `'teacher'` (HODs must be teachers)
     - Keep `role = 'teacher'` unchanged
     - Call `assignAdditionalRole(userId, 'hod', actorId, tenantId)`
  2. If removing HOD role:
     - Call `removeAdditionalRole(userId, 'hod', tenantId)`
  3. If assigning other roles:
     - Update `role` field directly (existing behavior)
  4. Create audit log: `user_role_updated` with details
  5. Return user object with `additional_roles` populated

**DRY Principle:**
- Uses `assignAdditionalRole()` helper (no duplication)
- Uses `removeAdditionalRole()` helper (no duplication)
- Centralizes role assignment logic

**Verification:**
- Test assigning HOD to teacher (should add to additional_roles)
- Test assigning HOD to non-teacher (should error)
- Test removing HOD (should remove from additional_roles)
- Test assigning other roles (should update role field)

**Related Tasks:**
- Task 7.1 (Users route response) ensures response includes additional_roles

---

### Task 6.2: Update User Retrieval to Include Additional Roles

**Priority:** High  
**Dependencies:** Task 4.2 (getUserWithAdditionalRoles)  
**Estimated Time:** 30 minutes

**Target File:** `backend/src/services/userService.ts`

**Expected Modifications:**
- Update all user retrieval functions to use `getUserWithAdditionalRoles()`
- Functions to update:
  - `updateTenantUserRole()` (return value)
  - `getTenantUser()` (if exists)
  - Any other user retrieval functions
- Ensure all user objects include `additional_roles` array

**DRY Principle:**
- Uses `getUserWithAdditionalRoles()` helper (no duplication)
- Centralizes user retrieval logic

**Verification:**
- Test retrieving user with additional roles
- Test retrieving user without additional roles
- Test retrieving user when table doesn't exist

**Related Tasks:**
- Task 7.1 (Users route response) uses this

---

## TASK GROUP 7: API ROUTE CORRECTIONS

### Task 7.1: Update Users Route Response to Include Additional Roles

**Priority:** High  
**Dependencies:** Task 6.2 (User retrieval with roles)  
**Estimated Time:** 15 minutes

**Target File:** `backend/src/routes/users.ts`

**Expected Modifications:**
- Route: `PATCH /users/:userId/role` (lines 104-125)
- Update response to include `additional_roles` array
- Ensure response type matches frontend expectations
- Response should include:
  ```typescript
  {
    id: string;
    email: string;
    role: string;
    additional_roles?: Array<{
      role: string;
      granted_at: string;
      granted_by?: string;
    }>;
    // ... other fields
  }
  ```

**DRY Principle:**
- Uses updated `updateTenantUserRole()` service (no duplication)
- Consistent response format

**Verification:**
- Test HOD assignment response includes `additional_roles`
- Test other role assignment response format
- Verify frontend can parse response

**Related Tasks:**
- Task 6.1 (HOD role assignment) provides the data

---

### Task 7.2: Update User List Routes to Include Additional Roles

**Priority:** Medium  
**Dependencies:** Task 6.2 (User retrieval with roles)  
**Estimated Time:** 20 minutes

**Target File:** `backend/src/routes/users.ts`

**Expected Modifications:**
- Update all user list endpoints to include `additional_roles`
- Routes to update:
  - `GET /users` (if exists)
  - Any other user listing routes
- Ensure all user objects in lists include `additional_roles` array

**DRY Principle:**
- Uses `getUserWithAdditionalRoles()` helper (no duplication)
- Consistent response format across all routes

**Verification:**
- Test user list includes `additional_roles` for each user
- Test empty `additional_roles` arrays
- Verify frontend can parse response

**Related Tasks:**
- Task 6.2 (User retrieval) provides the data

---

## TASK GROUP 8: NEW TEACHER ROUTES

### Task 8.1: Create GET /teachers/me/students Route

**Priority:** Medium  
**Dependencies:** Task 3.1 (requireAnyPermission), Task 5.1 (Students route fix)  
**Estimated Time:** 45 minutes

**Target File:** `backend/src/routes/teachers.ts`

**Expected Modifications:**
- Add new route: `GET /teachers/me/students`
- Permission: `requirePermission('students:view_own_class')`
- Middleware: `authenticate`, `tenantResolver()`, `ensureTenantContext()`
- Query parameters:
  - `classId` (optional): Filter by specific class
  - `limit`, `offset` (optional): Pagination
- Logic:
  1. Get current teacher's ID from `req.user.id`
  2. Get teacher's email from `req.user.email`
  3. Query teacher profile to get assigned classes
  4. If `classId` provided: Verify teacher is assigned to that class
  5. Query students from teacher's assigned classes
  6. Return paginated list of students
- Response: Paginated student list

**DRY Principle:**
- Reuses existing student query logic (if possible)
- Uses existing pagination middleware
- Uses existing `verifyTeacherAssignment` logic (if needed)

**Verification:**
- Test with teacher user (should return students from assigned classes)
- Test with `classId` parameter (should filter by class)
- Test with non-assigned class (should return 403 or empty)
- Test pagination

**Related Tasks:**
- Task 5.1 (Students route fix) provides alternative approach

---

### Task 8.2: Create GET /teachers/me/classes Route

**Priority:** Medium  
**Dependencies:** None  
**Estimated Time:** 30 minutes

**Target File:** `backend/src/routes/teachers.ts`

**Expected Modifications:**
- Add new route: `GET /teachers/me/classes`
- Permission: `requirePermission('dashboard:view')` (teachers have this)
- Middleware: `authenticate`, `tenantResolver()`, `ensureTenantContext()`
- Logic:
  1. Get current teacher's ID from `req.user.id`
  2. Get teacher's email from `req.user.email`
  3. Query teacher profile from tenant schema
  4. Extract `assigned_classes` from teacher profile
  5. Query class details for each assigned class
  6. Include: class ID, name, subject, student count
- Response:
  ```typescript
  Array<{
    id: string;
    name: string;
    subject?: string;
    studentCount: number;
  }>
  ```

**DRY Principle:**
- Reuses existing teacher query logic
- Reuses existing class query logic

**Verification:**
- Test with teacher user (should return assigned classes)
- Test with teacher having no classes (should return empty array)
- Test class details are correct

**Related Tasks:**
- None

---

### Task 8.3: Create GET /teachers/me Route

**Priority:** Low  
**Dependencies:** None  
**Estimated Time:** 25 minutes

**Target File:** `backend/src/routes/teachers.ts`

**Expected Modifications:**
- Add new route: `GET /teachers/me`
- Permission: `requirePermission('profile:view_self')` or `requirePermission('dashboard:view')`
- Middleware: `authenticate`, `tenantResolver()`, `ensureTenantContext()`
- Logic:
  1. Get current teacher's ID from `req.user.id`
  2. Get teacher's email from `req.user.email`
  3. Query teacher profile with assigned classes
  4. Include: teacher details, assigned classes, subjects
- Response: Teacher profile object with classes and subjects

**DRY Principle:**
- Reuses existing teacher query logic
- Consistent with other `/me` routes

**Verification:**
- Test with teacher user (should return own profile)
- Test with non-teacher user (should return 403)
- Test profile data is complete

**Related Tasks:**
- None

---

## TASK GROUP 9: AUDIT LOGGING

### Task 9.1: Add Audit Log for Teacher Creation

**Priority:** Medium  
**Dependencies:** None  
**Estimated Time:** 20 minutes

**Target File:** `backend/src/services/adminUserService.ts`

**Expected Modifications:**
- Function: `adminCreateUser()` (lines 44-103)
- Add audit log after teacher creation
- Action: `TEACHER_CREATED`
- Log details:
  - Actor ID (admin or HOD who created)
  - Tenant ID
  - Teacher ID
  - Teacher email
  - Assigned classes (if any)
- Log to both shared and tenant audit logs
- Use `createAuditLog()` from `enhancedAuditService.ts`

**DRY Principle:**
- Uses existing `createAuditLog()` function (no duplication)
- Consistent audit log format

**Verification:**
- Test teacher creation logs audit event
- Test audit log includes all required fields
- Test audit log appears in platform audit logs

**Related Tasks:**
- Task 1.1 (HOD permissions) enables HOD to create teachers

---

### Task 9.2: Add Audit Log for Class Assignment

**Priority:** Medium  
**Dependencies:** None  
**Estimated Time:** 25 minutes

**Target File:** `backend/src/routes/teachers.ts`

**Expected Modifications:**
- Find class assignment routes (if exists)
- Add audit log after class assignment
- Action: `CLASS_ASSIGNED`
- Log details:
  - Actor ID (admin who assigned)
  - Tenant ID
  - Teacher ID
  - Class ID
  - Assignment type (class_teacher, subject_teacher)
- Log to tenant audit logs
- Use `createAuditLog()` from `enhancedAuditService.ts`

**DRY Principle:**
- Uses existing `createAuditLog()` function (no duplication)
- Consistent audit log format

**Verification:**
- Test class assignment logs audit event
- Test audit log includes all required fields
- Test audit log appears in tenant audit logs

**Related Tasks:**
- None

---

### Task 9.3: Add Audit Log for Student Creation

**Priority:** Medium  
**Dependencies:** None  
**Estimated Time:** 20 minutes

**Target File:** `backend/src/services/studentService.ts`

**Expected Modifications:**
- Function: `createStudent()` (find student creation function)
- Add audit log after student creation
- Action: `STUDENT_CREATED`
- Log details:
  - Actor ID (admin who created)
  - Tenant ID
  - Student ID
  - Student email
  - Assigned class (if any)
- Log to tenant audit logs
- Use `createAuditLog()` from `enhancedAuditService.ts`

**DRY Principle:**
- Uses existing `createAuditLog()` function (no duplication)
- Consistent audit log format

**Verification:**
- Test student creation logs audit event
- Test audit log includes all required fields
- Test audit log appears in tenant audit logs

**Related Tasks:**
- None

---

### Task 9.4: Add Audit Log for Attendance Marking

**Priority:** Medium  
**Dependencies:** Task 5.2 (Attendance route fix)  
**Estimated Time:** 20 minutes

**Target File:** `backend/src/services/attendanceService.ts`

**Expected Modifications:**
- Function: `markAttendance()` (find attendance marking function)
- Add audit log after attendance marking
- Action: `ATTENDANCE_MARKED`
- Log details:
  - Actor ID (teacher or admin who marked)
  - Tenant ID
  - Class ID
  - Date
  - Student count
  - Attendance records count
- Log to tenant audit logs
- Use `createAuditLog()` from `enhancedAuditService.ts`

**DRY Principle:**
- Uses existing `createAuditLog()` function (no duplication)
- Consistent audit log format

**Verification:**
- Test attendance marking logs audit event
- Test audit log includes all required fields
- Test audit log appears in tenant audit logs

**Related Tasks:**
- Task 5.2 (Attendance route fix) enables teacher access

---

### Task 9.5: Add Audit Log for Grade Entry

**Priority:** Medium  
**Dependencies:** Task 5.3 (Grades route fix)  
**Estimated Time:** 20 minutes

**Target File:** `backend/src/services/examService.ts`

**Expected Modifications:**
- Function: `bulkUpsertGrades()` (find grade entry function)
- Add audit log after grade entry
- Action: `GRADES_ENTERED`
- Log details:
  - Actor ID (teacher or admin who entered)
  - Tenant ID
  - Exam ID
  - Class ID
  - Grade count
- Log to tenant audit logs
- Use `createAuditLog()` from `enhancedAuditService.ts`

**DRY Principle:**
- Uses existing `createAuditLog()` function (no duplication)
- Consistent audit log format

**Verification:**
- Test grade entry logs audit event
- Test audit log includes all required fields
- Test audit log appears in tenant audit logs

**Related Tasks:**
- Task 5.3 (Grades route fix) enables teacher access

---

## TASK SUMMARY TABLE

| Task ID | Task Name | Priority | Dependencies | Estimated Time | Target File |
|---------|-----------|----------|--------------|----------------|-------------|
| 1.1 | Update HOD Permissions | High | None | 5 min | `permissions.ts` |
| 2.1 | Create Additional Roles Table | High | None | 15 min | `018_additional_roles.sql` |
| 3.1 | Create requireAnyPermission | Critical | 1.1 | 20 min | `rbac.ts` |
| 3.2 | Create requireAllPermissions | Low | 1.1 | 15 min | `rbac.ts` |
| 4.1 | Create assignAdditionalRole | High | 2.1 | 30 min | `userService.ts` |
| 4.2 | Create getUserWithAdditionalRoles | High | 2.1 | 25 min | `userService.ts` |
| 4.3 | Create removeAdditionalRole | Medium | 2.1 | 20 min | `userService.ts` |
| 5.1 | Fix Students Route Permission | Critical | 3.1 | 15 min | `students.ts` |
| 5.2 | Fix Attendance Route Permission | Critical | 3.1 | 10 min | `attendance.ts` |
| 5.3 | Fix Grades Route Permission | Critical | 3.1 | 15 min | `grades.ts` |
| 6.1 | Update HOD Role Assignment | High | 4.1, 4.3 | 40 min | `userService.ts` |
| 6.2 | Update User Retrieval with Roles | High | 4.2 | 30 min | `userService.ts` |
| 7.1 | Update Users Route Response | High | 6.2 | 15 min | `users.ts` |
| 7.2 | Update User List Routes | Medium | 6.2 | 20 min | `users.ts` |
| 8.1 | Create GET /teachers/me/students | Medium | 3.1, 5.1 | 45 min | `teachers.ts` |
| 8.2 | Create GET /teachers/me/classes | Medium | None | 30 min | `teachers.ts` |
| 8.3 | Create GET /teachers/me | Low | None | 25 min | `teachers.ts` |
| 9.1 | Add Audit Log: Teacher Creation | Medium | None | 20 min | `adminUserService.ts` |
| 9.2 | Add Audit Log: Class Assignment | Medium | None | 25 min | `teachers.ts` |
| 9.3 | Add Audit Log: Student Creation | Medium | None | 20 min | `studentService.ts` |
| 9.4 | Add Audit Log: Attendance Marking | Medium | 5.2 | 20 min | `attendanceService.ts` |
| 9.5 | Add Audit Log: Grade Entry | Medium | 5.3 | 20 min | `examService.ts` |

**Total Estimated Time:** ~7 hours

---

## IMPLEMENTATION ORDER

### Phase 1: Foundation (Critical Path)
1. Task 1.1: Update HOD Permissions
2. Task 2.1: Create Additional Roles Table
3. Task 3.1: Create requireAnyPermission
4. Task 4.1: Create assignAdditionalRole
5. Task 4.2: Create getUserWithAdditionalRoles
6. Task 4.3: Create removeAdditionalRole

### Phase 2: Permission Fixes (Critical Path)
7. Task 5.1: Fix Students Route Permission
8. Task 5.2: Fix Attendance Route Permission
9. Task 5.3: Fix Grades Route Permission

### Phase 3: Role Alignment (High Priority)
10. Task 6.1: Update HOD Role Assignment
11. Task 6.2: Update User Retrieval with Roles
12. Task 7.1: Update Users Route Response
13. Task 7.2: Update User List Routes

### Phase 4: New Routes (Medium Priority)
14. Task 8.1: Create GET /teachers/me/students
15. Task 8.2: Create GET /teachers/me/classes
16. Task 8.3: Create GET /teachers/me

### Phase 5: Audit Logging (Medium Priority)
17. Task 9.1: Add Audit Log: Teacher Creation
18. Task 9.2: Add Audit Log: Class Assignment
19. Task 9.3: Add Audit Log: Student Creation
20. Task 9.4: Add Audit Log: Attendance Marking
21. Task 9.5: Add Audit Log: Grade Entry

### Optional (Low Priority)
22. Task 3.2: Create requireAllPermissions

---

## DRY PRINCIPLE VERIFICATION

### Reusable Components Created:
- ✅ `requireAnyPermission()` middleware helper
- ✅ `assignAdditionalRole()` service helper
- ✅ `getUserWithAdditionalRoles()` service helper
- ✅ `removeAdditionalRole()` service helper

### Reused Components:
- ✅ `hasPermission()` function (from permissions.ts)
- ✅ `createAuditLog()` function (from enhancedAuditService.ts)
- ✅ `verifyTeacherAssignment` middleware (existing)
- ✅ Pagination middleware (existing)

### No Duplication:
- ✅ Permission checks use helpers (not duplicated)
- ✅ Role assignment uses helpers (not duplicated)
- ✅ Audit logging uses existing function (not duplicated)
- ✅ User retrieval uses helpers (not duplicated)

---

## VERIFICATION CHECKLIST

### After Each Task:
- [ ] Code compiles without errors
- [ ] TypeScript types are correct
- [ ] No linting errors
- [ ] Functionality works as expected
- [ ] Tests pass (if applicable)

### After Phase 1 (Foundation):
- [ ] Permission matrix updated correctly
- [ ] Database migration runs successfully
- [ ] Middleware helpers work correctly
- [ ] Service helpers work correctly

### After Phase 2 (Permission Fixes):
- [ ] Teachers can access student list
- [ ] Teachers can mark attendance
- [ ] Teachers can enter grades
- [ ] Admins still have full access

### After Phase 3 (Role Alignment):
- [ ] HOD assignment uses additional_roles
- [ ] User responses include additional_roles
- [ ] Frontend can parse responses

### After Phase 4 (New Routes):
- [ ] Teacher routes work correctly
- [ ] Routes return correct data
- [ ] Permissions are enforced

### After Phase 5 (Audit Logging):
- [ ] All actions log audit events
- [ ] Audit logs include required fields
- [ ] Audit logs appear in platform logs

---

## RISK MITIGATION

### Backward Compatibility:
- ✅ `additional_roles` table check with fallback
- ✅ Legacy role update support
- ✅ Graceful degradation if table missing

### Error Handling:
- ✅ Try-catch blocks for database operations
- ✅ Friendly error messages
- ✅ Proper HTTP status codes

### Testing:
- ✅ Unit tests for helpers
- ✅ Integration tests for routes
- ✅ End-to-end tests for flows

---

## CONCLUSION

This task breakdown provides atomic, dependency-ordered backend implementation tasks. Each task:
- ✅ Includes target files and expected modifications
- ✅ Follows DRY principles
- ✅ References permission matrix updates
- ✅ Creates separate tasks for teacher routes
- ✅ Unifies role system (role vs additional_roles)
- ✅ Identifies audit log types and schemas

**Ready for Phase 4: Implementation**

---

**PHASE 3 COMPLETE — READY FOR PHASE 4**

