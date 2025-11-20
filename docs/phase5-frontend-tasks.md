# PHASE 5 — FRONTEND FIX BLUEPRINT + TASKS

**Date:** 2025-01-XX  
**Status:** Task Breakdown Complete  
**Branch:** `fix/superuser-flow-validation`

---

## EXECUTIVE SUMMARY

This document provides atomic frontend implementation tasks to align the frontend with the backend fixes from Phase 4. Tasks are ordered by dependency to ensure proper implementation sequence. Each task includes target files, expected modifications, and follows DRY principles.

**No code is written in this phase** — only task breakdown.

---

## TASK DEPENDENCY ORDER

Tasks are ordered by dependency:
1. **Type Definitions** (foundation)
2. **API Client Updates** (foundation)
3. **Permission Helpers** (used by components)
4. **Role/User Type Updates** (used by components)
5. **Teacher Route Updates** (uses API client)
6. **Teacher Page Updates** (uses routes + API)
7. **Error Handling** (used by all pages)
8. **Shared Components** (DRY improvements)

---

## TASK GROUP 1: TYPE DEFINITIONS

### Task 1.1: Update TenantUser Interface to Match Backend

**Priority:** High  
**Dependencies:** None  
**Estimated Time:** 10 minutes

**Target File:** `frontend/src/lib/api.ts`

**Expected Modifications:**
- Update `TenantUser` interface (line 627)
- Ensure `additional_roles` array structure matches backend:
  ```typescript
  additional_roles?: Array<{
    role: string;
    granted_at?: string;
    granted_by?: string;
    metadata?: Record<string, unknown>;
  }>;
  ```
- Verify type is exported and used consistently

**DRY Principle:**
- Single source of truth for user types
- Type defined once, used everywhere

**Verification:**
- TypeScript compiles without errors
- All usages of `TenantUser` are compatible

**Related Tasks:**
- Task 2.1 (API client) uses this type
- Task 4.1 (Role helpers) uses this type

---

### Task 1.2: Add Teacher API Response Types

**Priority:** Medium  
**Dependencies:** None  
**Estimated Time:** 15 minutes

**Target File:** `frontend/src/lib/api.ts`

**Expected Modifications:**
- Add types for new teacher endpoints:
  - `GET /teachers/me` response type
  - `GET /teachers/me/classes` response type
  - `GET /teachers/me/students` response type
- Ensure types match backend response structure

**DRY Principle:**
- Types defined once, reused across components

**Verification:**
- TypeScript compiles without errors
- Types match backend OpenAPI spec

**Related Tasks:**
- Task 2.2 (API client) uses these types
- Task 5.1 (Teacher routes) uses these types

---

## TASK GROUP 2: API CLIENT UPDATES

### Task 2.1: Update User API Methods to Include Additional Roles

**Priority:** High  
**Dependencies:** Task 1.1 (Type Definitions)  
**Estimated Time:** 15 minutes

**Target File:** `frontend/src/lib/api.ts`

**Expected Modifications:**
- Verify `api.users.list()` response includes `additional_roles`
- Verify `api.users.get()` response includes `additional_roles`
- Verify `api.users.updateRole()` response includes `additional_roles`
- Ensure all user-related API methods handle `additional_roles` correctly

**DRY Principle:**
- API methods reuse type definitions
- No duplicate type definitions

**Verification:**
- API calls return correct data structure
- TypeScript types match actual responses

**Related Tasks:**
- Task 4.1 (Role helpers) uses these API methods

---

### Task 2.2: Add Teacher-Specific API Methods

**Priority:** High  
**Dependencies:** Task 1.2 (Teacher Types)  
**Estimated Time:** 30 minutes

**Target File:** `frontend/src/lib/api.ts`

**Expected Modifications:**
- Add new API methods:
  ```typescript
  api.teachers.getMe(): Promise<TeacherProfile>
  api.teachers.getMyClasses(): Promise<Array<ClassInfo>>
  api.teachers.getMyStudents(params?: { classId?: string }): Promise<PaginatedResponse<Student>>
  ```
- Ensure methods use correct endpoints:
  - `GET /teachers/me`
  - `GET /teachers/me/classes`
  - `GET /teachers/me/students`
- Add proper error handling
- Add TypeScript types

**DRY Principle:**
- Reuse existing API client patterns
- Reuse pagination utilities

**Verification:**
- API methods work correctly
- TypeScript types are correct
- Error handling is proper

**Related Tasks:**
- Task 5.1 (Teacher routes) uses these methods
- Task 6.1-6.3 (Teacher pages) use these methods

---

## TASK GROUP 3: PERMISSION HELPERS

### Task 3.1: Verify Permission Helpers Support New Permissions

**Priority:** Medium  
**Dependencies:** None  
**Estimated Time:** 10 minutes

**Target File:** `frontend/src/lib/rbac/filterSidebarLinks.ts`

**Expected Modifications:**
- Verify `students:view_own_class` permission is handled correctly
- Verify `attendance:mark` permission is handled correctly
- Verify `grades:enter` permission is handled correctly
- Ensure sidebar filtering works with these permissions

**DRY Principle:**
- Permission checks centralized in helpers
- No duplicate permission logic

**Verification:**
- Sidebar shows correct links for teachers
- Permission checks work correctly

**Related Tasks:**
- Task 6.1-6.3 (Teacher pages) depend on correct permissions

---

### Task 3.2: Update ProtectedRoute Component for New Permissions

**Priority:** Medium  
**Dependencies:** None  
**Estimated Time:** 15 minutes

**Target File:** `frontend/src/components/ProtectedRoute.tsx` (or similar)

**Expected Modifications:**
- Verify `ProtectedRoute` supports `students:view_own_class`
- Verify `ProtectedRoute` supports `attendance:mark`
- Verify `ProtectedRoute` supports `grades:enter`
- Ensure error messages are user-friendly

**DRY Principle:**
- Single `ProtectedRoute` component used everywhere
- No duplicate route protection logic

**Verification:**
- Routes are protected correctly
- Error messages are clear

**Related Tasks:**
- Task 5.1 (Teacher routes) uses this component

---

## TASK GROUP 4: ROLE/USER TYPE UPDATES

### Task 4.1: Create Helper Functions for Additional Roles

**Priority:** High  
**Dependencies:** Task 1.1 (Type Definitions)  
**Estimated Time:** 20 minutes

**Target File:** `frontend/src/lib/utils/userHelpers.ts` (NEW FILE or existing utils file)

**Expected Modifications:**
- Create helper functions:
  ```typescript
  export function isHOD(user: TenantUser): boolean
  export function getUserAdditionalRoles(user: TenantUser): Array<string>
  export function hasAdditionalRole(user: TenantUser, role: string): boolean
  ```
- Ensure helpers handle `additional_roles` array correctly
- Ensure helpers handle legacy `role` field correctly
- Add TypeScript types

**DRY Principle:**
- Single helper functions used everywhere
- No duplicate role checking logic

**Verification:**
- Helpers work correctly for HOD users
- Helpers work correctly for regular users
- TypeScript types are correct

**Related Tasks:**
- Task 4.2 (HOD pages) uses these helpers
- Task 6.1-6.3 (Teacher pages) may use these helpers

---

### Task 4.2: Update HOD Detection Logic

**Priority:** High  
**Dependencies:** Task 4.1 (Role Helpers)  
**Estimated Time:** 15 minutes

**Target File:** `frontend/src/pages/admin/HODsManagementPage.tsx`

**Expected Modifications:**
- Update HOD filtering logic (line 82-88)
- Use new helper function `isHOD()` instead of inline check
- Ensure filter correctly identifies HODs:
  - Primary role is `'teacher'`
  - `additional_roles` contains `'hod'`
- Verify display logic works correctly

**DRY Principle:**
- Uses helper function (no duplication)
- Consistent HOD detection across app

**Verification:**
- HODs are correctly identified
- HOD list displays correctly
- Filter logic works as expected

**Related Tasks:**
- Task 4.3 (Other HOD references) uses same logic

---

### Task 4.3: Update Other HOD References

**Priority:** Medium  
**Dependencies:** Task 4.1 (Role Helpers)  
**Estimated Time:** 20 minutes

**Target Files:**
- `frontend/src/pages/hod/HODProfilePage.tsx` (line 31, 35)
- `frontend/src/pages/admin/AdminOverviewPage.tsx` (line 29, 80-81)
- `frontend/src/hooks/queries/useDashboardQueries.ts` (line 114)

**Expected Modifications:**
- Replace inline HOD checks with `isHOD()` helper
- Ensure all HOD detection uses consistent logic
- Verify no hardcoded role checks remain

**DRY Principle:**
- All HOD checks use same helper
- No duplicate HOD detection logic

**Verification:**
- All HOD references work correctly
- No TypeScript errors
- Consistent behavior across app

**Related Tasks:**
- Task 4.2 (HOD management page) already updated

---

## TASK GROUP 5: TEACHER ROUTE UPDATES

### Task 5.1: Update Teacher Routes to Use New Endpoints

**Priority:** High  
**Dependencies:** Task 2.2 (Teacher API Methods)  
**Estimated Time:** 30 minutes

**Target File:** `frontend/src/App.tsx` or route configuration file

**Expected Modifications:**
- Verify teacher routes exist:
  - `/teacher/dashboard`
  - `/teacher/classes`
  - `/teacher/students` (NEW or update existing)
  - `/teacher/attendance` (NEW or update existing)
  - `/teacher/grades` (NEW or update existing)
- Ensure routes use correct permissions:
  - `students:view_own_class` for students route
  - `attendance:mark` for attendance route
  - `grades:enter` for grades route
- Add `ProtectedRoute` wrappers with correct permissions

**DRY Principle:**
- Routes use shared `ProtectedRoute` component
- Permission checks centralized

**Verification:**
- Routes are accessible to teachers
- Routes are protected correctly
- Navigation works as expected

**Related Tasks:**
- Task 6.1-6.3 (Teacher pages) use these routes

---

## TASK GROUP 6: TEACHER PAGE UPDATES

### Task 6.1: Update/Create Teacher Students Page

**Priority:** High  
**Dependencies:** Task 2.2 (Teacher API Methods), Task 5.1 (Teacher Routes)  
**Estimated Time:** 45 minutes

**Target File:** `frontend/src/pages/teacher/TeacherStudentsPage.tsx` (NEW or update existing)

**Expected Modifications:**
- Use `api.teachers.getMyStudents()` instead of `api.students.list()`
- Add class filter functionality (if not exists)
- Display students from teacher's assigned classes only
- Add proper loading states
- Add proper error handling
- Ensure pagination works correctly
- Use `students:view_own_class` permission check

**DRY Principle:**
- Reuse existing student list components if available
- Reuse pagination components
- Reuse loading/error components

**Verification:**
- Page displays students correctly
- Class filter works
- Pagination works
- Error handling works
- Loading states work

**Related Tasks:**
- Task 6.2 (Attendance page) may reuse student selection logic

---

### Task 6.2: Update/Create Teacher Attendance Page

**Priority:** High  
**Dependencies:** Task 2.2 (Teacher API Methods), Task 5.1 (Teacher Routes)  
**Estimated Time:** 45 minutes

**Target File:** `frontend/src/pages/TeacherAttendancePage.tsx` or `frontend/src/pages/teacher/TeacherAttendancePage.tsx`

**Expected Modifications:**
- Verify page uses `attendance:mark` permission
- Ensure page calls correct API endpoint (`POST /attendance/mark`)
- Verify teacher can only mark attendance for assigned classes
- Add class selection if teacher has multiple classes
- Add proper error handling
- Add success feedback
- Ensure `verifyTeacherAssignment` middleware works correctly

**DRY Principle:**
- Reuse existing attendance components if available
- Reuse form components
- Reuse error handling components

**Verification:**
- Page works correctly for teachers
- Class selection works
- Attendance marking works
- Error handling works
- Success feedback works

**Related Tasks:**
- Task 6.1 (Students page) may provide student list

---

### Task 6.3: Update/Create Teacher Grade Entry Page

**Priority:** High  
**Dependencies:** Task 2.2 (Teacher API Methods), Task 5.1 (Teacher Routes)  
**Estimated Time:** 45 minutes

**Target File:** `frontend/src/pages/TeacherGradeEntryPage.tsx` or `frontend/src/pages/teacher/TeacherGradeEntryPage.tsx`

**Expected Modifications:**
- Verify page uses `grades:enter` permission
- Ensure page calls correct API endpoint (`POST /grades/bulk`)
- Verify teacher can only enter grades for assigned classes
- Add class/subject selection if teacher has multiple classes
- Add proper error handling
- Add success feedback
- Ensure `verifyTeacherAssignment` middleware works correctly

**DRY Principle:**
- Reuse existing grade entry components if available
- Reuse form components
- Reuse error handling components

**Verification:**
- Page works correctly for teachers
- Class/subject selection works
- Grade entry works
- Error handling works
- Success feedback works

**Related Tasks:**
- Task 6.1 (Students page) may provide student list

---

### Task 6.4: Update Teacher Dashboard Page

**Priority:** Medium  
**Dependencies:** Task 2.2 (Teacher API Methods)  
**Estimated Time:** 30 minutes

**Target File:** `frontend/src/pages/teacher/TeacherDashboardPage.tsx`

**Expected Modifications:**
- Use `api.teachers.getMe()` to get teacher profile
- Use `api.teachers.getMyClasses()` to get assigned classes
- Display teacher's assigned classes
- Display quick stats (student count, etc.)
- Add links to students/attendance/grades pages
- Ensure proper loading states
- Ensure proper error handling

**DRY Principle:**
- Reuse existing dashboard components
- Reuse stat card components
- Reuse loading/error components

**Verification:**
- Dashboard displays correctly
- Links work correctly
- Stats are accurate
- Loading/error states work

**Related Tasks:**
- Task 6.1-6.3 (Other teacher pages) linked from dashboard

---

### Task 6.5: Update Teacher Classes Page

**Priority:** Low  
**Dependencies:** Task 2.2 (Teacher API Methods)  
**Estimated Time:** 20 minutes

**Target File:** `frontend/src/pages/teacher/TeacherClassesPage.tsx`

**Expected Modifications:**
- Use `api.teachers.getMyClasses()` to get assigned classes
- Display classes with student counts
- Add links to students/attendance/grades for each class
- Ensure proper loading states
- Ensure proper error handling

**DRY Principle:**
- Reuse existing class list components
- Reuse card components
- Reuse loading/error components

**Verification:**
- Classes display correctly
- Links work correctly
- Loading/error states work

**Related Tasks:**
- Task 6.1-6.3 (Other teacher pages) linked from classes page

---

## TASK GROUP 7: ERROR HANDLING

### Task 7.1: Create Permission Denied Component

**Priority:** Medium  
**Dependencies:** None  
**Estimated Time:** 30 minutes

**Target File:** `frontend/src/components/shared/PermissionDenied.tsx` (NEW FILE)

**Expected Modifications:**
- Create reusable `PermissionDenied` component
- Display user-friendly error message
- Show which permission is required
- Add link back to dashboard
- Use consistent styling with app theme

**DRY Principle:**
- Single component used everywhere
- No duplicate error messages

**Verification:**
- Component displays correctly
- Message is clear
- Styling is consistent

**Related Tasks:**
- Task 7.2 (Error handling) uses this component

---

### Task 7.2: Add Error Handling to Teacher Pages

**Priority:** Medium  
**Dependencies:** Task 7.1 (Permission Denied Component)  
**Estimated Time:** 20 minutes

**Target Files:**
- All teacher pages (Task 6.1-6.5)

**Expected Modifications:**
- Add error handling for 403 (Forbidden) errors
- Display `PermissionDenied` component when permission denied
- Add error handling for 404 (Not Found) errors
- Add error handling for network errors
- Ensure error messages are user-friendly

**DRY Principle:**
- Reuse `PermissionDenied` component
- Reuse error handling utilities

**Verification:**
- Error handling works correctly
- Error messages are clear
- User experience is good

**Related Tasks:**
- Task 6.1-6.5 (Teacher pages) need error handling

---

## TASK GROUP 8: SHARED COMPONENTS (DRY)

### Task 8.1: Extract Student List Component

**Priority:** Low  
**Dependencies:** Task 6.1 (Teacher Students Page)  
**Estimated Time:** 30 minutes

**Target File:** `frontend/src/components/shared/StudentList.tsx` (NEW FILE)

**Expected Modifications:**
- Extract student list display logic into reusable component
- Support filtering by class
- Support pagination
- Support selection (for attendance/grades)
- Make component flexible for different use cases

**DRY Principle:**
- Single component used in multiple places
- No duplicate student list logic

**Verification:**
- Component works correctly
- Can be reused in multiple pages
- TypeScript types are correct

**Related Tasks:**
- Task 6.1 (Teacher Students Page) uses this component
- Task 6.2 (Attendance Page) may use this component
- Task 6.3 (Grade Entry Page) may use this component

---

### Task 8.2: Extract Class Selector Component

**Priority:** Low  
**Dependencies:** Task 6.2-6.3 (Attendance/Grade Pages)  
**Estimated Time:** 20 minutes

**Target File:** `frontend/src/components/shared/ClassSelector.tsx` (NEW FILE)

**Expected Modifications:**
- Extract class selection logic into reusable component
- Support filtering by teacher's assigned classes
- Display class name and student count
- Make component flexible for different use cases

**DRY Principle:**
- Single component used in multiple places
- No duplicate class selection logic

**Verification:**
- Component works correctly
- Can be reused in multiple pages
- TypeScript types are correct

**Related Tasks:**
- Task 6.2 (Attendance Page) uses this component
- Task 6.3 (Grade Entry Page) uses this component

---

### Task 8.3: Extract Loading/Error States Components

**Priority:** Low  
**Dependencies:** None  
**Estimated Time:** 15 minutes

**Target File:** `frontend/src/components/shared/LoadingStates.tsx` (NEW FILE or update existing)

**Expected Modifications:**
- Create reusable loading spinner component
- Create reusable error display component
- Create reusable empty state component
- Ensure consistent styling

**DRY Principle:**
- Single components used everywhere
- No duplicate loading/error logic

**Verification:**
- Components work correctly
- Styling is consistent
- Can be reused easily

**Related Tasks:**
- All pages use these components

---

## TASK SUMMARY TABLE

| Task ID | Task Name | Priority | Dependencies | Estimated Time | Target File |
|---------|-----------|----------|--------------|----------------|-------------|
| 1.1 | Update TenantUser Interface | High | None | 10 min | `api.ts` |
| 1.2 | Add Teacher API Response Types | Medium | None | 15 min | `api.ts` |
| 2.1 | Update User API Methods | High | 1.1 | 15 min | `api.ts` |
| 2.2 | Add Teacher-Specific API Methods | High | 1.2 | 30 min | `api.ts` |
| 3.1 | Verify Permission Helpers | Medium | None | 10 min | `filterSidebarLinks.ts` |
| 3.2 | Update ProtectedRoute Component | Medium | None | 15 min | `ProtectedRoute.tsx` |
| 4.1 | Create Role Helper Functions | High | 1.1 | 20 min | `userHelpers.ts` (NEW) |
| 4.2 | Update HOD Detection Logic | High | 4.1 | 15 min | `HODsManagementPage.tsx` |
| 4.3 | Update Other HOD References | Medium | 4.1 | 20 min | Multiple files |
| 5.1 | Update Teacher Routes | High | 2.2 | 30 min | `App.tsx` |
| 6.1 | Update/Create Teacher Students Page | High | 2.2, 5.1 | 45 min | `TeacherStudentsPage.tsx` |
| 6.2 | Update/Create Teacher Attendance Page | High | 2.2, 5.1 | 45 min | `TeacherAttendancePage.tsx` |
| 6.3 | Update/Create Teacher Grade Entry Page | High | 2.2, 5.1 | 45 min | `TeacherGradeEntryPage.tsx` |
| 6.4 | Update Teacher Dashboard Page | Medium | 2.2 | 30 min | `TeacherDashboardPage.tsx` |
| 6.5 | Update Teacher Classes Page | Low | 2.2 | 20 min | `TeacherClassesPage.tsx` |
| 7.1 | Create Permission Denied Component | Medium | None | 30 min | `PermissionDenied.tsx` (NEW) |
| 7.2 | Add Error Handling to Teacher Pages | Medium | 7.1 | 20 min | Multiple files |
| 8.1 | Extract Student List Component | Low | 6.1 | 30 min | `StudentList.tsx` (NEW) |
| 8.2 | Extract Class Selector Component | Low | 6.2-6.3 | 20 min | `ClassSelector.tsx` (NEW) |
| 8.3 | Extract Loading/Error States | Low | None | 15 min | `LoadingStates.tsx` |

**Total Estimated Time:** ~7 hours

---

## IMPLEMENTATION ORDER

### Phase 1: Foundation (Critical Path)
1. Task 1.1: Update TenantUser Interface
2. Task 1.2: Add Teacher API Response Types
3. Task 2.1: Update User API Methods
4. Task 2.2: Add Teacher-Specific API Methods
5. Task 4.1: Create Role Helper Functions

### Phase 2: Role Updates (High Priority)
6. Task 4.2: Update HOD Detection Logic
7. Task 4.3: Update Other HOD References

### Phase 3: Routes and Pages (High Priority)
8. Task 3.1: Verify Permission Helpers
9. Task 3.2: Update ProtectedRoute Component
10. Task 5.1: Update Teacher Routes
11. Task 6.1: Update/Create Teacher Students Page
12. Task 6.2: Update/Create Teacher Attendance Page
13. Task 6.3: Update/Create Teacher Grade Entry Page

### Phase 4: Polish (Medium Priority)
14. Task 6.4: Update Teacher Dashboard Page
15. Task 6.5: Update Teacher Classes Page
16. Task 7.1: Create Permission Denied Component
17. Task 7.2: Add Error Handling to Teacher Pages

### Phase 5: DRY Improvements (Low Priority)
18. Task 8.1: Extract Student List Component
19. Task 8.2: Extract Class Selector Component
20. Task 8.3: Extract Loading/Error States

---

## AFFECTED FILES SUMMARY

### Files to Create (NEW):
- `frontend/src/lib/utils/userHelpers.ts`
- `frontend/src/components/shared/PermissionDenied.tsx`
- `frontend/src/components/shared/StudentList.tsx`
- `frontend/src/components/shared/ClassSelector.tsx`
- `frontend/src/components/shared/LoadingStates.tsx` (or update existing)
- `frontend/src/pages/teacher/TeacherStudentsPage.tsx` (if not exists)
- `frontend/src/pages/teacher/TeacherAttendancePage.tsx` (if not exists)
- `frontend/src/pages/teacher/TeacherGradeEntryPage.tsx` (if not exists)

### Files to Update:
- `frontend/src/lib/api.ts`
- `frontend/src/lib/rbac/filterSidebarLinks.ts`
- `frontend/src/components/ProtectedRoute.tsx` (or similar)
- `frontend/src/pages/admin/HODsManagementPage.tsx`
- `frontend/src/pages/hod/HODProfilePage.tsx`
- `frontend/src/pages/admin/AdminOverviewPage.tsx`
- `frontend/src/hooks/queries/useDashboardQueries.ts`
- `frontend/src/App.tsx` (or route configuration)
- `frontend/src/pages/teacher/TeacherDashboardPage.tsx`
- `frontend/src/pages/teacher/TeacherClassesPage.tsx`
- `frontend/src/pages/TeacherAttendancePage.tsx` (if exists at root)
- `frontend/src/pages/TeacherGradeEntryPage.tsx` (if exists at root)

---

## DRY PRINCIPLE VERIFICATION

### Reusable Components Created:
- ✅ `PermissionDenied` component
- ✅ `StudentList` component
- ✅ `ClassSelector` component
- ✅ `LoadingStates` components

### Reusable Helpers Created:
- ✅ `isHOD()` helper function
- ✅ `getUserAdditionalRoles()` helper function
- ✅ `hasAdditionalRole()` helper function

### Reused Components:
- ✅ `ProtectedRoute` component (existing)
- ✅ Permission helpers (existing)
- ✅ API client (existing)
- ✅ Pagination utilities (existing)

### No Duplication:
- ✅ HOD detection uses helper (not duplicated)
- ✅ Permission checks use helpers (not duplicated)
- ✅ Student list uses component (not duplicated)
- ✅ Class selection uses component (not duplicated)

---

## VERIFICATION CHECKLIST

### After Each Task:
- [ ] Code compiles without errors
- [ ] TypeScript types are correct
- [ ] No linting errors
- [ ] Functionality works as expected

### After Phase 1 (Foundation):
- [ ] Types match backend
- [ ] API methods work correctly
- [ ] Helper functions work correctly

### After Phase 2 (Role Updates):
- [ ] HOD detection works correctly
- [ ] All HOD references updated
- [ ] No hardcoded role checks

### After Phase 3 (Routes and Pages):
- [ ] Teacher routes work correctly
- [ ] Teacher pages work correctly
- [ ] Permissions are enforced
- [ ] API calls work correctly

### After Phase 4 (Polish):
- [ ] Error handling works correctly
- [ ] User experience is good
- [ ] All pages are polished

### After Phase 5 (DRY):
- [ ] Components are reusable
- [ ] No duplicate code
- [ ] Code is maintainable

---

## RISK MITIGATION

### Backward Compatibility:
- ✅ Types support both old and new structures
- ✅ Helpers handle legacy role field
- ✅ API methods maintain compatibility

### Error Handling:
- ✅ Try-catch blocks for API calls
- ✅ User-friendly error messages
- ✅ Proper error states

### Testing:
- ✅ Manual testing for each page
- ✅ Verify permissions work correctly
- ✅ Verify API calls work correctly

---

## CONCLUSION

This task breakdown provides atomic, dependency-ordered frontend implementation tasks. Each task:
- ✅ Includes target files and expected modifications
- ✅ Follows DRY principles
- ✅ References backend API changes
- ✅ Creates separate tasks for each page
- ✅ Identifies shared components to extract
- ✅ Orders tasks by dependency

**Ready for Phase 6: Implementation**

---

**PHASE 5 COMPLETE — READY FOR PHASE 6**

