# Admin Dashboard Specification - Part 1

Complete specification for 7 core Admin Dashboard pages including purpose, database integration, file structure, integration notes, and additional requirements.

---

## Table of Contents

1. [Admin Overview Page](#1-admin-overview-page)
2. [User Management Page](#2-user-management-page)
3. [Teachers Management Page](#3-teachers-management-page)
4. [Students Management Page](#4-students-management-page)
5. [HODs Management Page](#5-hods-management-page)
6. [Classes & Subjects Page](#6-classes--subjects-page)
7. [Attendance Page](#7-attendance-page)

---

## 1. Admin Overview Page

### 1.1 Page Purpose & Contents

**Main Goal:** Executive dashboard providing high-level overview of school metrics, user statistics, and key performance indicators.

**Sections & Components:**
- **Header Section:**
  - Page title: "Executive Dashboard"
  - Description: "Overview of school information, users, and statistics for your organization"
  - Refresh button

- **School Information Card:**
  - School name
  - School address (city, country)
  - Displayed in a bordered card with grid layout

- **Statistics Cards (6 cards in grid):**
  - Total Users (with Users icon)
  - Teachers (with GraduationCap icon)
  - HODs (with UserCheck icon)
  - Students (with Users icon)
  - Admins (with Shield icon)
  - Pending Users (with AlertCircle icon)

- **Charts Section (2-column grid):**
  - Role Distribution Pie Chart (Teachers, Students, HODs, Admins)
  - User Status Distribution Bar Chart (Active, Pending, Suspended, etc.)

- **Data Tables:**
  - All Users Table (email, role, status, verified, created date)
  - Teachers Table (name, email, subjects, classes)
  - Students Table (name, admission number, class)

**Layout:**
- Full-width page with consistent spacing
- Responsive grid layouts (2 columns on mobile, 6 columns on desktop for stats)
- Cards with rounded borders and shadow
- Charts in bordered containers

### 1.2 Database Integration

**Data Required:**
- School information from `{{schema}}.schools` table
- All users from `shared.users` (filtered by tenant)
- Teachers from `{{schema}}.teachers`
- Students from `{{schema}}.students`
- Additional roles from `shared.additional_roles` (for HOD detection)

**Backend Queries:**
```typescript
// Parallel queries for performance
const [school, users, teachers, students, classes] = await Promise.all([
  api.getSchool(),           // GET /api/school
  api.listUsers(),           // GET /api/users
  api.listTeachers(),        // GET /api/teachers
  api.listStudents(),        // GET /api/students
  api.listClasses()          // GET /api/configuration/classes
]);
```

**Backend Endpoints:**
- `GET /api/school` - Get school information
- `GET /api/users` - List all tenant users
- `GET /api/teachers` - List all teachers
- `GET /api/students` - List all students
- `GET /api/configuration/classes` - List all classes

**Frontend Consumption:**
- Uses `useAdminOverview()` hook from `hooks/queries/useAdminQueries.ts`
- React Query for caching and state management
- Data transformed client-side for charts and statistics
- Memoized calculations for performance

**CRUD Operations:**
- **Read Only** - This is a dashboard view, no mutations

### 1.3 File Structure & Paths

**Frontend:**
- Page Component: `frontend/src/pages/admin/AdminOverviewPage.tsx`
- Query Hook: `frontend/src/hooks/queries/useAdminQueries.ts`
- Chart Components: 
  - `frontend/src/components/charts/StatCard.tsx`
  - `frontend/src/components/charts/PieChart.tsx`
  - `frontend/src/components/charts/BarChart.tsx`
- Table Component: `frontend/src/components/tables/DataTable.tsx`
- UI Components:
  - `frontend/src/components/ui/Button.tsx`
  - `frontend/src/components/ui/StatusBadge.tsx`
  - `frontend/src/components/ui/DashboardSkeleton.tsx`
  - `frontend/src/components/ui/StatusBanner.tsx`
- Layout: `frontend/src/components/layout/RouteMeta.tsx`
- Utilities: `frontend/src/lib/utils/userHelpers.ts` (isHOD function)
- API Client: `frontend/src/lib/api.ts`

**Backend:**
- Routes: 
  - `backend/src/routes/school.ts`
  - `backend/src/routes/users.ts`
  - `backend/src/routes/teachers.ts`
  - `backend/src/routes/students.ts`
  - `backend/src/routes/adminAcademics.ts` (for classes)
- Services:
  - `backend/src/services/schoolService.ts`
  - `backend/src/services/userService.ts`
  - `backend/src/services/teacherService.ts`
  - `backend/src/services/studentService.ts`
  - `backend/src/services/subjectService.ts`

**Database:**
- Schema: Tenant-specific schema (e.g., `tenant_abc123`)
- Tables:
  - `{{schema}}.schools`
  - `{{schema}}.teachers`
  - `{{schema}}.students`
  - `{{schema}}.classes`
  - `shared.users` (with tenant_id filter)
  - `shared.additional_roles` (for HOD detection)

### 1.4 Integration Notes

**API Endpoints:**
```
GET /api/school
GET /api/users
GET /api/teachers
GET /api/students
GET /api/configuration/classes
```

**Authentication/Authorization:**
- Required role: `admin` or `superadmin`
- Permission: `users:manage` (for viewing all users)
- Route protection: `ProtectedRoute` component with `allowedRoles={['admin', 'superadmin']}`
- Backend middleware: `authenticate`, `tenantResolver()`, `requirePermission('users:manage')`

**Shared Components:**
- `StatCard` - Reusable statistics display card
- `PieChart` - Role distribution visualization
- `BarChart` - Status distribution visualization
- `DataTable` - Generic table with pagination
- `DashboardSkeleton` - Loading state placeholder
- `StatusBanner` - Error/success message display

**Best Practices:**
- Use React Query for data fetching and caching
- Memoize expensive calculations (stats, chart data)
- Parallel API calls for faster loading
- Graceful error handling with user-friendly messages
- Responsive design with mobile-first approach
- Accessible components (ARIA labels, keyboard navigation)

### 1.5 Additional Requirements

**Naming Conventions:**
- Files: PascalCase for components (`AdminOverviewPage.tsx`)
- Functions: camelCase (`useAdminOverview`, `handleRefresh`)
- Constants: UPPER_SNAKE_CASE (`ROLE_DISTRIBUTION`)
- Types: PascalCase (`TenantUser`, `TeacherProfile`)

**Libraries/Frameworks:**
- Charts: Custom components (BarChart, PieChart) - no external library
- Tables: Custom `DataTable` component with built-in pagination
- Forms: N/A (read-only page)
- State Management: React Query (`@tanstack/react-query`)
- Icons: Lucide React (`lucide-react`)

**Error Handling:**
- Try-catch blocks around API calls
- Error state displayed via `StatusBanner`
- Fallback values for missing data (empty arrays, null checks)
- User-friendly error messages

**Loading States:**
- `DashboardSkeleton` component during initial load
- Individual loading states for each data section
- Skeleton matches final layout structure

**Responsive Design:**
- Mobile: Single column layout, stacked cards
- Tablet: 2-column grid for stats cards
- Desktop: 6-column grid for stats, 2-column for charts
- Breakpoints: `sm:`, `md:`, `lg:` Tailwind classes
- Touch-friendly button sizes (min 44x44px)

---

## 2. User Management Page

### 2.1 Page Purpose & Contents

**Main Goal:** Central hub for managing all users in the system, handling user registration, role assignment, status management, and pending user approvals.

**Sections & Components:**
- **Header Section:**
  - Page title: "Role management"
  - Description: "View tenant users, register new users, and adjust their role assignment"
  - Action buttons: "Register New User", "Refresh"

- **Pending User Approvals Section:**
  - List of users with `status='pending'`
  - Each pending user card displays:
    - Email address
    - Role
    - Verification status
    - Registration date
    - Pending profile data (name, gender, date of birth, parent/guardian info for students; phone, qualifications, subjects for teachers)
  - Action buttons per user: "Approve", "Reject"
  - Helpful tip about editing profiles after approval

- **All Users Table:**
  - Columns: Email, Role, Status, Verified, Created, Actions
  - Role dropdown for each user (inline editing)
  - Status badges (active, pending, suspended, rejected)
  - Verification indicator (Yes/No)

**Layout:**
- Full-width page
- Pending approvals in expandable cards
- Table below with all users
- Modal for user registration

### 2.2 Database Integration

**Data Required:**
- All users from `shared.users` (filtered by tenant_id)
- Pending users (status='pending')
- User profile data from `pending_profile_data` JSONB column
- Additional roles from `shared.additional_roles`

**Backend Queries:**
```typescript
// Two parallel queries
const [allUsers, pendingUsers] = await Promise.all([
  api.listUsers(),           // GET /api/users
  api.listPendingUsers()     // GET /api/users/pending
]);
```

**Backend Endpoints:**
- `GET /api/users` - List all tenant users
- `GET /api/users/pending` - List pending users
- `POST /api/users` - Register new user (via AdminUserRegistrationModal)
- `PUT /api/users/:id/role` - Update user role
- `POST /api/users/:id/approve` - Approve pending user
- `POST /api/users/:id/reject` - Reject pending user

**Frontend Consumption:**
- Direct API calls via `api.listUsers()` and `api.listPendingUsers()`
- State management with `useState` for users and pending users
- `useAsyncFeedback` hook for status messages
- Toast notifications for success/error

**CRUD Operations:**
- **Create:** Register new users via modal
- **Read:** List all users and pending users
- **Update:** Change user roles, approve/reject users
- **Delete:** N/A (soft delete via status change)

### 2.3 File Structure & Paths

**Frontend:**
- Page Component: `frontend/src/pages/admin/RoleManagementPage.tsx`
- Registration Modal: `frontend/src/components/admin/AdminUserRegistrationModal.tsx`
- Table Component: `frontend/src/components/ui/Table.tsx`
- UI Components:
  - `frontend/src/components/ui/Button.tsx`
  - `frontend/src/components/ui/Select.tsx`
  - `frontend/src/components/ui/StatusBanner.tsx`
- Hooks:
  - `frontend/src/hooks/useAsyncFeedback.ts`
- API Client: `frontend/src/lib/api.ts`

**Backend:**
- Routes: `backend/src/routes/users.ts`
- Admin Routes: `backend/src/routes/admin/users.ts`
- Services:
  - `backend/src/services/userService.ts`
  - `backend/src/services/userRegistrationService.ts`
  - `backend/src/services/adminUserService.ts`
- Validators: `backend/src/validators/userValidator.ts`

**Database:**
- Schema: `shared` (multi-tenant)
- Tables:
  - `shared.users` (id, email, password_hash, role, tenant_id, status, is_verified, pending_profile_data, created_at)
  - `shared.additional_roles` (user_id, role, tenant_id, granted_at, granted_by)

### 2.4 Integration Notes

**API Endpoints:**
```
GET /api/users
GET /api/users/pending
POST /api/users
PUT /api/users/:id/role
POST /api/users/:id/approve
POST /api/users/:id/reject
```

**Authentication/Authorization:**
- Required role: `admin` or `superadmin`
- Permission: `users:manage`
- Route protection: `ProtectedRoute` with `allowedRoles={['admin', 'superadmin']}`
- Backend middleware: `authenticate`, `tenantResolver()`, `requirePermission('users:manage')`

**Shared Components:**
- `AdminUserRegistrationModal` - Reusable user registration form
- `Table` - Generic table component
- `StatusBanner` - Status message display
- `Select` - Dropdown for role selection

**Best Practices:**
- Separate pending users from active users for clarity
- Inline role editing for better UX
- Confirmation dialogs for destructive actions (reject)
- Clear feedback after approval (profile created message)
- Handle edge cases (no users, no pending users)

### 2.5 Additional Requirements

**Naming Conventions:**
- Component: `RoleManagementPage` (PascalCase)
- Functions: `loadUsers`, `handleApprove`, `handleReject` (camelCase)
- State: `users`, `pendingUsers`, `loading` (camelCase)

**Libraries/Frameworks:**
- Forms: Custom form components (no external form library)
- Notifications: Sonner (`sonner`) for toast messages
- State: React hooks (`useState`, `useCallback`, `useEffect`)

**Error Handling:**
- Try-catch blocks around all API calls
- Error messages displayed via `StatusBanner` and toast
- Graceful fallback if pending users endpoint fails (filter from all users)
- User-friendly error messages

**Loading States:**
- Loading spinner on buttons during operations
- Disable buttons during loading to prevent double-submission
- Loading state for initial data fetch

**Responsive Design:**
- Mobile: Stacked layout, full-width cards
- Tablet/Desktop: Side-by-side layout for pending user cards
- Touch-friendly buttons and dropdowns
- Accessible form controls

---

## 3. Teachers Management Page

### 3.1 Page Purpose & Contents

**Main Goal:** Comprehensive management interface for teachers including profile management, class/subject assignments, and bulk operations.

**Sections & Components:**
- **Header Section:**
  - Page title: "Teachers management"
  - Description: "Manage teachers, assign classes and subjects, view qualifications and reports"
  - Action buttons: "Create Teacher", "Import CSV", "Activity Log", Export buttons (CSV, PDF, Excel), Bulk Delete

- **Advanced Filters Section:**
  - Search input (name, email, subject, class)
  - Class filter dropdown
  - Subject filter dropdown
  - Reset filters button
  - Results count display

- **Activity Log Section (toggleable):**
  - Recent activity for teachers
  - Entity type: "teacher"
  - Limit: 10 entries

- **Teachers Table:**
  - Columns: Checkbox, Name (with email), Subjects (badges), Classes (badges), Actions
  - Row selection for bulk operations
  - Action buttons: Details, View Profile, Assign Class/Subject
  - Pagination controls

- **Modals:**
  - Create Teacher Modal (AdminUserRegistrationModal)
  - CSV Import Modal
  - Teacher Profile Modal
  - Assignment Modal (class/subject assignment)
  - Teacher Detail View Modal

**Layout:**
- Full-width page with consistent spacing
- Filters in bordered card
- Table with pagination
- Modals overlay for actions

### 3.2 Database Integration

**Data Required:**
- Teachers from `{{schema}}.teachers`
- Classes from `{{schema}}.classes`
- Subjects from `{{schema}}.subjects`
- Teacher assignments from `{{schema}}.teacher_assignments`
- Activity logs from `shared.audit_logs`

**Backend Queries:**
```typescript
// Parallel queries with optional filters
const { data: teachers } = useTeachers({ search: debouncedSearch });
const { data: classes } = useClasses();
const { data: subjects } = useQuery(queryKeys.admin.subjects(), () => api.admin.listSubjects());
```

**Backend Endpoints:**
- `GET /api/teachers` - List teachers (with optional search filter)
- `GET /api/teachers/:id` - Get teacher details
- `POST /api/teachers` - Create teacher
- `PUT /api/teachers/:id` - Update teacher
- `DELETE /api/teachers/:id` - Delete teacher
- `POST /api/admin/teachers/:id/assignments` - Assign teacher to class/subject
- `POST /api/admin/csv/import` - Bulk import teachers
- `GET /api/admin/audit?entityType=teacher` - Get activity logs

**Frontend Consumption:**
- React Query hooks: `useTeachers()`, `useClasses()`, `useQuery()`
- Debounced search to prevent excessive API calls
- Client-side filtering for class/subject (can be moved to backend)
- Mutations: `useUpdateTeacher()`, `useDeleteTeacher()`

**CRUD Operations:**
- **Create:** Via registration modal or CSV import
- **Read:** List with filters, view details
- **Update:** Update profile, assign classes/subjects
- **Delete:** Single or bulk delete

### 3.3 File Structure & Paths

**Frontend:**
- Page Component: `frontend/src/pages/admin/TeachersManagementPage.tsx`
- Query Hooks: `frontend/src/hooks/queries/useTeachers.ts`
- Components:
  - `frontend/src/components/admin/PaginatedTable.tsx`
  - `frontend/src/components/admin/AdvancedFilters.tsx`
  - `frontend/src/components/admin/ExportButtons.tsx`
  - `frontend/src/components/admin/CSVImportModal.tsx`
  - `frontend/src/components/admin/ActivityLog.tsx`
  - `frontend/src/components/admin/TeacherDetailView.tsx`
  - `frontend/src/components/admin/AdminUserRegistrationModal.tsx`
  - `frontend/src/components/admin/EmptyState.tsx`
- Table Actions: `frontend/src/components/table-actions/`
- Hooks:
  - `frontend/src/hooks/useDebounce.ts`
  - `frontend/src/hooks/useExport.ts`
  - `frontend/src/hooks/useCSVImport.ts`
- API Client: `frontend/src/lib/api.ts`

**Backend:**
- Routes: `backend/src/routes/teachers.ts`
- Admin Routes: `backend/src/routes/adminAcademics.ts` (for assignments)
- Services:
  - `backend/src/services/teacherService.ts`
  - `backend/src/services/adminUserService.ts`
  - `backend/src/services/exportService.ts`
  - `backend/src/services/auditLogService.ts`
- Validators: `backend/src/validators/teacherValidator.ts`

**Database:**
- Schema: Tenant-specific schema
- Tables:
  - `{{schema}}.teachers` (id, name, email, subjects JSONB, assigned_classes JSONB, created_at, updated_at)
  - `{{schema}}.teacher_assignments` (teacher_id, class_id, subject_id, is_class_teacher)
  - `shared.audit_logs` (for activity tracking)

### 3.4 Integration Notes

**API Endpoints:**
```
GET /api/teachers?search=...
GET /api/teachers/:id
POST /api/teachers
PUT /api/teachers/:id
DELETE /api/teachers/:id
POST /api/admin/teachers/:id/assignments
POST /api/admin/csv/import
GET /api/admin/audit?entityType=teacher&limit=10
```

**Authentication/Authorization:**
- Required role: `admin` or `superadmin`
- Permission: `users:manage` (for CRUD operations)
- Route protection: `ProtectedRoute` with `allowedRoles={['admin', 'superadmin']}`
- Backend middleware: `authenticate`, `tenantResolver()`, `requirePermission('users:manage')`

**Shared Components:**
- `PaginatedTable` - Reusable paginated table
- `AdvancedFilters` - Reusable filter component
- `ExportButtons` - CSV/PDF/Excel export
- `CSVImportModal` - Bulk import interface
- `ActivityLog` - Activity tracking display
- `TeacherDetailView` - Detailed teacher information
- `EmptyState` - Empty state placeholder

**Best Practices:**
- Debounce search input (500ms delay)
- Client-side filtering for better UX (can be optimized with backend filtering)
- Bulk operations with confirmation dialogs
- Export functionality with filters applied
- Activity logging for audit trail
- Optimistic updates for better UX

### 3.5 Additional Requirements

**Naming Conventions:**
- Component: `TeachersManagementPage` (PascalCase)
- Hooks: `useTeachers`, `useUpdateTeacher` (camelCase)
- Functions: `handleViewProfile`, `handleAssignClass` (camelCase)
- Types: `TeacherProfile`, `TeacherFilters` (PascalCase)

**Libraries/Frameworks:**
- Charts: N/A
- Tables: Custom `PaginatedTable` component
- Forms: Custom form components
- Export: Custom export handlers (CSV, PDF, Excel)
- Icons: Lucide React

**Error Handling:**
- Error state displayed via `StatusBanner`
- Toast notifications for mutations
- Graceful handling of empty states
- Validation errors from backend displayed inline

**Loading States:**
- `DashboardSkeleton` during initial load
- Loading spinners on action buttons
- Disable interactions during mutations
- Skeleton loaders for table rows

**Responsive Design:**
- Mobile: Stacked filters, horizontal scroll for table
- Tablet: 2-column filter layout
- Desktop: Full table with all columns visible
- Touch-friendly action buttons
- Accessible modals with focus management

---

## 4. Students Management Page

### 4.1 Page Purpose & Contents

**Main Goal:** Complete student management system for creating, viewing, updating, and managing student records, class assignments, and parent/guardian information.

**Sections & Components:**
- **Header Section:**
  - Page title: "Students management"
  - Description: "Manage students, assign classes, manage parent/guardian information, and view academic history"
  - Action buttons: "Create Student", "Import CSV", "Activity Log", Export buttons, Bulk Delete

- **Advanced Filters Section:**
  - Search input (name, admission number, class)
  - Class filter dropdown
  - Enrollment status filter (All, Active, Graduated, Transferred, Suspended, Withdrawn)
  - Reset filters button
  - Results count display

- **Activity Log Section (toggleable):**
  - Recent activity for students
  - Entity type: "student"

- **Students Table:**
  - Columns: Checkbox, Name (with admission number), Class, Actions
  - Row selection for bulk operations
  - Action buttons: Details, View Profile, Assign Class, Manage Parent

- **Modals:**
  - Create Student Modal
  - CSV Import Modal
  - Student Profile Modal
  - Class Assignment Modal
  - Parent/Guardian Management Modal
  - Student Detail View Modal

**Layout:**
- Similar to Teachers Management Page
- Full-width layout with consistent spacing
- Filters and table in bordered cards

### 4.2 Database Integration

**Data Required:**
- Students from `{{schema}}.students`
- Classes from `{{schema}}.classes`
- Parent contacts from `parent_contacts` JSONB column
- Enrollment status from `enrollment_status` column

**Backend Queries:**
```typescript
// Queries with filters
const { data: students } = useStudents({
  classId: filters.classId !== 'all' ? filters.classId : undefined,
  enrollmentStatus: filters.enrollmentStatus !== 'all' ? filters.enrollmentStatus : undefined,
  search: debouncedSearch
});
const { data: classes } = useClasses();
```

**Backend Endpoints:**
- `GET /api/students?classId=...&enrollmentStatus=...&search=...` - List students with filters
- `GET /api/students/:id` - Get student details
- `POST /api/students` - Create student
- `PUT /api/students/:id` - Update student (class, parent contacts, etc.)
- `DELETE /api/students/:id` - Delete student
- `POST /api/students/bulk` - Bulk delete students
- `POST /api/admin/csv/import` - Bulk import students
- `GET /api/admin/audit?entityType=student` - Get activity logs

**Frontend Consumption:**
- React Query hooks: `useStudents()`, `useClasses()`
- Debounced search (500ms)
- Client-side filtering for enrollment status (can be backend)
- Mutations: `useUpdateStudent()`, `useBulkDeleteStudents()`

**CRUD Operations:**
- **Create:** Via registration modal or CSV import
- **Read:** List with filters, view details
- **Update:** Update class, parent contacts, enrollment status
- **Delete:** Single or bulk delete

### 4.3 File Structure & Paths

**Frontend:**
- Page Component: `frontend/src/pages/admin/StudentsManagementPage.tsx`
- Query Hooks: `frontend/src/hooks/queries/useStudents.ts`
- Components:
  - `frontend/src/components/admin/PaginatedTable.tsx`
  - `frontend/src/components/admin/AdvancedFilters.tsx`
  - `frontend/src/components/admin/ExportButtons.tsx`
  - `frontend/src/components/admin/CSVImportModal.tsx`
  - `frontend/src/components/admin/ActivityLog.tsx`
  - `frontend/src/components/admin/StudentDetailView.tsx`
  - `frontend/src/components/admin/AdminUserRegistrationModal.tsx`
  - `frontend/src/components/admin/EmptyState.tsx`
  - `frontend/src/components/shared/FormModal.tsx`
- Table Actions: `frontend/src/components/table-actions/`
- Hooks: Same as Teachers Management

**Backend:**
- Routes: `backend/src/routes/students.ts`
- Services:
  - `backend/src/services/studentService.ts`
  - `backend/src/services/adminUserService.ts`
  - `backend/src/services/exportService.ts`
- Validators: `backend/src/validators/studentValidator.ts`

**Database:**
- Schema: Tenant-specific schema
- Tables:
  - `{{schema}}.students` (id, first_name, last_name, date_of_birth, class_id, admission_number, parent_contacts JSONB, enrollment_status, created_at, updated_at)

### 4.4 Integration Notes

**API Endpoints:**
```
GET /api/students?classId=...&enrollmentStatus=...&search=...
GET /api/students/:id
POST /api/students
PUT /api/students/:id
DELETE /api/students/:id
POST /api/students/bulk
POST /api/admin/csv/import
```

**Authentication/Authorization:**
- Required role: `admin` or `superadmin`
- Permission: `users:manage`
- Route protection: `ProtectedRoute` with `allowedRoles={['admin', 'superadmin']}`
- Backend middleware: `authenticate`, `tenantResolver()`, `requirePermission('users:manage')`

**Shared Components:**
- Same as Teachers Management Page
- `FormModal` for class assignment and parent management
- `StudentDetailView` for comprehensive student information

**Best Practices:**
- Filter by enrollment status for better organization
- Parent/guardian management as separate modal
- Bulk operations with confirmation
- Export with current filters applied
- Activity logging for all changes

### 4.5 Additional Requirements

**Naming Conventions:**
- Component: `StudentsManagementPage` (PascalCase)
- Hooks: `useStudents`, `useUpdateStudent` (camelCase)
- Functions: `handleAssignClass`, `handleManageParent` (camelCase)
- Types: `StudentRecord`, `StudentFilters` (PascalCase)

**Libraries/Frameworks:**
- Same as Teachers Management Page
- No external charting library needed

**Error Handling:**
- Error state via `StatusBanner`
- Toast notifications for mutations
- Validation errors displayed inline
- Graceful handling of missing parent contacts

**Loading States:**
- `DashboardSkeleton` during initial load
- Loading spinners on buttons
- Disable interactions during mutations

**Responsive Design:**
- Mobile: Stacked layout, scrollable table
- Tablet/Desktop: Full table view
- Touch-friendly buttons and modals
- Accessible form controls

---

## 5. HODs Management Page

### 5.1 Page Purpose & Contents

**Main Goal:** Management interface for Heads of Department (HODs), including role assignment, department oversight, and department-level analytics.

**Sections & Components:**
- **Header Section:**
  - Page title: "HODs management"
  - Description: "Manage Heads of Department, assign departments, oversee teachers, and view department-level analytics"
  - Action buttons: "Create HOD", "Import CSV", "Activity Log", Export buttons, Bulk Remove HOD

- **Advanced Filters Section:**
  - Search input (name, email, department)
  - Department filter dropdown
  - Reset filters button
  - Results count display

- **Activity Log Section (toggleable):**
  - Recent activity for HODs
  - Entity type: "hod"

- **HODs Table:**
  - Columns: Checkbox, Name (with email), Department (badge), Subjects (badges), Teachers Under Oversight (count), Actions
  - Row selection for bulk operations
  - Action buttons: Details, View Profile, Assign Department, View Analytics

- **Modals:**
  - Create HOD Modal (CreateHODModal)
  - CSV Import Modal
  - HOD Profile Modal
  - Department Assignment Modal
  - Department Analytics Modal
  - HOD Detail View Modal

**Layout:**
- Similar structure to Teachers/Students pages
- Department badges for visual identification
- Analytics modal for department insights

### 5.2 Database Integration

**Data Required:**
- HODs from `{{schema}}.teachers` (filtered by additional_roles containing 'hod')
- Additional roles from `shared.additional_roles` (role='hod')
- Teachers from `{{schema}}.teachers` (for oversight calculation)
- Subjects from `{{schema}}.subjects` (for department mapping)

**Backend Queries:**
```typescript
// HODs are teachers with additional role 'hod'
const { data: hods } = useHODs({ search, department });
const { data: teachers } = useTeachers();
const { data: subjects } = useQuery(queryKeys.admin.subjects(), () => api.admin.listSubjects());
```

**Backend Endpoints:**
- `GET /api/users` - List all users (filtered client-side for HODs via additional_roles)
- `GET /api/teachers` - List all teachers (used to get HOD profile data)
- `PUT /api/admin/users/:id/department` - Assign department to HOD
- `DELETE /api/admin/users/hod/bulk` - Bulk remove HOD roles
- `POST /api/admin/csv/import` - Bulk import HODs (via user registration with HOD role)
- `GET /api/admin/audit?entityType=hod` - Get activity logs
- **Note:** HODs are not a separate entity but teachers with `additional_roles` containing 'hod'. Listing is done client-side by filtering users/teachers.

**Frontend Consumption:**
- React Query hooks: `useHODs()`, `useTeachers()`, `useAssignHODDepartment()`, `useBulkRemoveHODRoles()`
- Client-side calculation of teachers under oversight
- Department assignment via mutation

**CRUD Operations:**
- **Create:** Assign HOD role to teacher
- **Read:** List HODs with department info
- **Update:** Assign/change department
- **Delete:** Remove HOD role (bulk supported)

### 5.3 File Structure & Paths

**Frontend:**
- Page Component: `frontend/src/pages/admin/HODsManagementPage.tsx`
- Query Hooks: `frontend/src/hooks/queries/useHODs.ts`
- Components:
  - `frontend/src/components/admin/CreateHODModal.tsx`
  - `frontend/src/components/admin/HODDetailView.tsx`
  - `frontend/src/components/admin/PaginatedTable.tsx`
  - `frontend/src/components/admin/AdvancedFilters.tsx`
  - `frontend/src/components/admin/ExportButtons.tsx`
  - `frontend/src/components/admin/CSVImportModal.tsx`
  - `frontend/src/components/admin/ActivityLog.tsx`
  - `frontend/src/components/admin/EmptyState.tsx`
- Utilities: `frontend/src/lib/utils/userHelpers.ts` (isHOD function)

**Backend:**
- Routes: `backend/src/routes/admin/users.ts` (HOD-specific endpoints)
- Services:
  - `backend/src/services/userService.ts` (updateHODDepartment, bulkRemoveHODRoles)
  - `backend/src/services/adminUserService.ts`
- Validators: `backend/src/validators/userValidator.ts`

**Database:**
- Schema: `shared` for additional_roles, tenant schema for teachers
- Tables:
  - `shared.additional_roles` (user_id, role='hod', tenant_id, granted_at, granted_by, metadata JSONB)
  - `{{schema}}.teachers` (for HOD profile data)
  - `shared.users` (for user account info)

### 5.4 Integration Notes

**API Endpoints:**
```
GET /api/users (filtered client-side for HODs)
GET /api/teachers (for HOD profile data)
PUT /api/admin/users/:id/department
DELETE /api/admin/users/hod/bulk
POST /api/admin/csv/import
```

**Authentication/Authorization:**
- Required role: `admin` or `superadmin`
- Permission: `users:manage`
- Route protection: `ProtectedRoute` with `allowedRoles={['admin', 'superadmin']}`
- Backend middleware: `authenticate`, `tenantResolver()`, `requirePermission('users:manage')`

**Shared Components:**
- `CreateHODModal` - Specialized modal for HOD creation
- `HODDetailView` - Comprehensive HOD information
- Same shared components as Teachers/Students pages

**Best Practices:**
- HODs are teachers with additional role, not separate entity
- Department assignment stored in metadata or separate table
- Calculate teachers under oversight client-side (can be optimized)
- Analytics modal shows department-level statistics
- Bulk operations for role removal

### 5.5 Additional Requirements

**Naming Conventions:**
- Component: `HODsManagementPage` (PascalCase)
- Hooks: `useHODs`, `useAssignHODDepartment` (camelCase)
- Functions: `handleAssignDepartment`, `handleViewAnalytics` (camelCase)
- Types: `HODRecord`, `HODFilters` (PascalCase)

**Libraries/Frameworks:**
- Same as Teachers/Students pages
- No additional libraries needed

**Error Handling:**
- Error state via `StatusBanner`
- Toast notifications for mutations
- Validation for department assignment
- Graceful handling of missing departments

**Loading States:**
- `DashboardSkeleton` during initial load
- Loading spinners on buttons
- Disable interactions during mutations

**Responsive Design:**
- Mobile: Stacked layout
- Tablet/Desktop: Full table view
- Touch-friendly buttons
- Accessible modals

---

## 6. Classes & Subjects Page

### 6.1 Page Purpose & Contents

**Main Goal:** Management interface for academic classes and subjects, including class-subject mapping, teacher assignments, and student subject enrollment.

**Sections & Components:**
- **Header Section:**
  - Page title: "Classes & Subjects"
  - Description: "Manage classes, subjects, and their relationships"

- **Tabs/Sections:**
  1. **Subjects Management:**
     - Subjects table (name, code, description)
     - Create/Edit/Delete subject actions
     - Subject form modal

  2. **Classes Management:**
     - Classes table (name, description)
     - Create/Edit/Delete class actions
     - Class form modal

  3. **Class-Subject Mapping:**
     - Class selector dropdown
     - Selected class subjects (checkboxes or multi-select)
     - Save mapping button
     - View class details button

  4. **Teacher Assignments:**
     - Teacher selector
     - Class selector
     - Subject selector
     - "Is Class Teacher" checkbox
     - Assignment table/list

  5. **Student Subject Enrollment:**
     - Student selector
     - Subject checkboxes (multi-select)
     - Save enrollment button

  6. **Student Promotion:**
     - Student selector
     - From class (current)
     - To class (target)
     - Promotion date
     - Save promotion button

**Layout:**
- Tabbed interface or accordion sections
- Forms in modals or inline
- Tables for listing entities
- Class detail view modal

### 6.2 Database Integration

**Data Required:**
- Classes from `{{schema}}.classes`
- Subjects from `{{schema}}.subjects`
- Class-subject mappings from `{{schema}}.class_subjects`
- Teacher assignments from `{{schema}}.teacher_assignments`
- Student subjects from `{{schema}}.student_subjects`
- Students from `{{schema}}.students`
- Teachers from `{{schema}}.teachers`
- Promotion records from `{{schema}}.promotions`

**Backend Queries:**
```typescript
// Parallel data loading
const [classes, subjects, teachers, students, assignments] = await Promise.all([
  api.listClasses(),  // GET /api/configuration/classes
  api.admin.listSubjects(),  // GET /api/admin/subjects
  api.listTeachers(),  // GET /api/teachers
  api.listStudents(),  // GET /api/students
  api.admin.listTeacherAssignments()  // GET /api/admin/teacher-assignments
]);
```

**Backend Endpoints:**
- `GET /api/configuration/classes` - List all classes
- `GET /api/admin/subjects` - List all subjects
- `POST /api/admin/subjects` - Create subject
- `PUT /api/admin/subjects/:id` - Update subject
- `DELETE /api/admin/subjects/:id` - Delete subject
- `GET /api/admin/classes/:classId/subjects` - Get class subjects
- `POST /api/admin/classes/:classId/subjects` - Replace class subjects (uses POST, not PUT)
- `GET /api/admin/students/:studentId/subjects` - Get student subjects
- `POST /api/admin/students/:studentId/subjects` - Replace student subjects (uses POST, not PUT)
- `GET /api/admin/teacher-assignments` - List teacher assignments
- `POST /api/admin/teachers/:teacherId/assignments` - Create teacher assignment
- `DELETE /api/admin/teacher-assignments/:id` - Remove assignment
- `POST /api/admin/students/:studentId/promote` - Record student promotion

**Frontend Consumption:**
- Direct API calls via `api` client
- State management with `useState` for forms and selections
- `useAsyncFeedback` for status messages
- Toast notifications for success/error

**CRUD Operations:**
- **Create:** Subjects, classes, mappings, assignments, enrollments
- **Read:** List all entities and relationships
- **Update:** Edit subjects, classes, update mappings
- **Delete:** Remove subjects, classes, assignments

### 6.3 File Structure & Paths

**Frontend:**
- Page Component: `frontend/src/pages/admin/AdminClassesSubjectsPage.tsx`
- Components:
  - `frontend/src/components/admin/ClassDetailView.tsx`
  - `frontend/src/components/ui/Table.tsx`
  - `frontend/src/components/ui/Modal.tsx`
  - `frontend/src/components/ui/Input.tsx`
  - `frontend/src/components/ui/Select.tsx`
  - `frontend/src/components/ui/Button.tsx`
- Hooks: `frontend/src/hooks/useAsyncFeedback.ts`
- API Client: `frontend/src/lib/api.ts`

**Backend:**
- Routes: `backend/src/routes/adminAcademics.ts`
- Services:
  - `backend/src/services/subjectService.ts`
  - `backend/src/services/classService.ts` (if exists)
  - `backend/src/services/studentService.ts` (for promotions)
- Validators: `backend/src/validators/subjectValidator.ts`

**Database:**
- Schema: Tenant-specific schema
- Tables:
  - `{{schema}}.classes` (id, name, description, department_id, created_at, updated_at)
  - `{{schema}}.subjects` (id, name, code, description, created_at, updated_at)
  - `{{schema}}.class_subjects` (class_id, subject_id, UNIQUE constraint)
  - `{{schema}}.teacher_assignments` (teacher_id, class_id, subject_id, is_class_teacher)
  - `{{schema}}.student_subjects` (student_id, subject_id, class_id, academic_year)
  - `{{schema}}.promotions` (student_id, from_class_id, to_class_id, promoted_at, promoted_by)

### 6.4 Integration Notes

**API Endpoints:**
```
GET /api/configuration/classes
GET /api/admin/subjects
POST /api/admin/subjects
PUT /api/admin/subjects/:id
DELETE /api/admin/subjects/:id
GET /api/admin/classes/:classId/subjects
POST /api/admin/classes/:classId/subjects
GET /api/admin/students/:studentId/subjects
POST /api/admin/students/:studentId/subjects
GET /api/admin/teacher-assignments
POST /api/admin/teachers/:teacherId/assignments
DELETE /api/admin/teacher-assignments/:id
POST /api/admin/students/:studentId/promote
```

**Authentication/Authorization:**
- Required role: `admin` or `superadmin`
- Permission: `users:manage`
- Route protection: `ProtectedRoute` with `allowedRoles={['admin', 'superadmin']}`
- Backend middleware: `authenticate`, `tenantResolver()`, `requirePermission('users:manage')`

**Shared Components:**
- `ClassDetailView` - Comprehensive class information
- `Table` - Generic table component
- `Modal` - Reusable modal component
- Form components (Input, Select, Button)

**Best Practices:**
- Separate concerns: subjects, classes, mappings
- Replace operations for mappings (simpler than add/remove)
- Validation for subject codes (unique)
- Class detail view for quick overview
- Promotion tracking for audit trail

### 6.5 Additional Requirements

**Naming Conventions:**
- Component: `AdminClassesSubjectsPage` (PascalCase)
- Functions: `loadInitialData`, `handleSubjectSubmit` (camelCase)
- Types: `SubjectFormState`, `TeacherAssignmentForm` (PascalCase)

**Libraries/Frameworks:**
- Forms: Custom form components
- Tables: Custom `Table` component
- No external charting library

**Error Handling:**
- Error state via `StatusBanner`
- Toast notifications for mutations
- Validation errors from backend
- Graceful handling of missing data

**Loading States:**
- Loading spinner during data fetch
- Disable forms during submission
- Skeleton loaders for tables

**Responsive Design:**
- Mobile: Stacked forms, scrollable tables
- Tablet/Desktop: Side-by-side forms
- Touch-friendly controls
- Accessible modals

---

## 7. Attendance Page

### 7.1 Page Purpose & Contents

**Main Goal:** School-wide attendance management and monitoring interface for viewing and managing attendance records across all classes.

**Sections & Components:**
- **Header Section:**
  - Page title: "Attendance Management"
  - Description: "Track and manage attendance for all classes"

- **Filters Section:**
  - Class selector dropdown
  - Date picker (defaults to today)
  - Filter card with rounded border

- **Quick Actions Section:**
  - "Mark All Present" button
  - "Mark All Absent" button
  - "Mark All Late" button
  - Only visible when students are loaded

- **Attendance Table:**
  - Columns: Student (name with ID), Status (dropdown: Present/Absent/Late)
  - Inline status editing via dropdown
  - Pagination controls (20 per page)
  - Save button in table header

**Layout:**
- Full-width page
- Filters in bordered card
- Quick actions above table
- Table in bordered card
- Save button in table header

### 7.2 Database Integration

**Data Required:**
- Classes from `{{schema}}.classes`
- Students from `{{schema}}.students` (filtered by class)
- Attendance records from `{{schema}}.attendance_records`
- Current user (for marked_by field)

**Backend Queries:**
```typescript
// Load classes and students for selected class
const { data: classes } = useClasses();
const { data: students } = useQuery(
  ['class-roster', selectedClassId],
  async () => {
    if (!selectedClassId) return [];
    const allStudents = await api.listStudents();
    return allStudents.filter(s => s.class_uuid === selectedClassId || s.class_id === selectedClassId);
  },
  { enabled: !!selectedClassId }
);
```

**Backend Endpoints:**
- `GET /api/configuration/classes` - List classes
- `GET /api/students` - List students (filtered by class client-side)
- `POST /api/attendance/mark` - Mark attendance (bulk)
- `GET /api/attendance/:studentId` - Get student attendance history
- `GET /api/attendance/report/class?class_id=...&date=...` - Get class attendance report

**Frontend Consumption:**
- React Query hooks: `useClasses()`, `useQuery()`
- Mutation: `useMutationWithInvalidation()` for marking attendance
- Local state for attendance rows (before saving)
- Transform students to attendance rows on load

**CRUD Operations:**
- **Create:** Mark attendance (bulk operation)
- **Read:** Load students for class, view attendance history
- **Update:** Change attendance status before saving
- **Delete:** N/A (attendance records are immutable)

### 7.3 File Structure & Paths

**Frontend:**
- Page Component: `frontend/src/pages/admin/AdminAttendancePage.tsx`
- Query Hooks: `frontend/src/hooks/queries/useAdminQueries.ts` (useClasses)
- Components:
  - `frontend/src/components/tables/DataTable.tsx`
  - `frontend/src/components/ui/Button.tsx`
  - `frontend/src/components/ui/Select.tsx`
  - `frontend/src/components/ui/DatePicker.tsx`
- Hooks: `frontend/src/hooks/useQuery.ts` (useMutationWithInvalidation)
- Context: `frontend/src/context/AuthContext.tsx` (for current user)
- API Client: `frontend/src/lib/api.ts`
- Utilities: `frontend/src/lib/utils/date.ts` (defaultDate)

**Backend:**
- Routes: `backend/src/routes/attendance.ts`
- Services:
  - `backend/src/services/attendanceService.ts`
  - `backend/src/services/studentService.ts` (for class roster)
- Middleware:
  - `backend/src/middleware/verifyTeacherAssignment.ts` (verify teacher can mark attendance for class)
  - `backend/src/middleware/mutationRateLimiter.ts` (attendanceLimiter)

**Database:**
- Schema: Tenant-specific schema
- Tables:
  - `{{schema}}.attendance_records` (id, student_id, class_id, status, marked_by, attendance_date, metadata JSONB, recorded_at, UNIQUE constraint on student_id+class_id+attendance_date)

### 7.4 Integration Notes

**API Endpoints:**
```
GET /api/configuration/classes
GET /api/students
POST /api/attendance/mark
GET /api/attendance/:studentId?from=...&to=...
GET /api/attendance/report/class?class_id=...&date=...
```

**Authentication/Authorization:**
- Required role: `admin` or `superadmin`
- Permission: `attendance:manage` or `attendance:mark`
- Route protection: `ProtectedRoute` with `allowedRoles={['admin', 'superadmin']}`
- Backend middleware: 
  - `authenticate`, `tenantResolver()`, `ensureTenantContext()`
  - `requireAnyPermission('attendance:manage', 'attendance:mark')`
  - `verifyTeacherAssignment()` (for teachers, allows admins)
  - `attendanceLimiter` (rate limiting)

**Shared Components:**
- `DataTable` - Generic table with pagination
- `DatePicker` - Date selection component
- `Select` - Class selector dropdown
- `Button` - Action buttons

**Best Practices:**
- Bulk save operation (all students at once)
- Local state for unsaved changes
- Quick actions for common operations
- Date-based filtering
- Class selection required before loading students
- Rate limiting to prevent abuse
- Teacher assignment verification (teachers can only mark for their classes)

### 7.5 Additional Requirements

**Naming Conventions:**
- Component: `AdminAttendancePage` (PascalCase)
- Functions: `handleSave`, `updateRowStatus`, `markAll` (camelCase)
- Types: `AttendanceRow`, `AttendanceStatus` (PascalCase)

**Libraries/Frameworks:**
- Tables: Custom `DataTable` component
- Date Picker: Custom `DatePicker` component
- Forms: Inline dropdowns (no form library)
- No charting library needed

**Error Handling:**
- Error state via `StatusBanner`
- Toast notifications for save operations
- Validation for required fields (class, date)
- Graceful handling of empty class rosters

**Loading States:**
- Loading spinner on save button
- Disable interactions during save
- Loading state for student list
- Skeleton loader for table

**Responsive Design:**
- Mobile: Stacked filters, scrollable table
- Tablet/Desktop: Side-by-side filters
- Touch-friendly dropdowns and buttons
- Accessible form controls
- Keyboard navigation for status dropdowns

---

## General Best Practices Across All Pages

### Code Organization
- Follow DRY principles - extract shared logic to hooks and utilities
- Use TypeScript for type safety
- Consistent file naming (PascalCase for components, camelCase for functions)
- Modular component structure

### Performance
- Use React Query for caching and automatic refetching
- Debounce search inputs (500ms)
- Memoize expensive calculations
- Lazy load modals and heavy components
- Pagination for large datasets

### Accessibility
- ARIA labels on interactive elements
- Keyboard navigation support
- Focus management in modals
- Screen reader friendly
- Color contrast compliance

### Security
- All endpoints require authentication
- Role-based access control (RBAC)
- Permission checks on both frontend and backend
- Input validation and sanitization
- CSRF protection
- Rate limiting on mutations

### Testing
- Unit tests for utility functions
- Integration tests for API endpoints
- Component tests for UI interactions
- E2E tests for critical user flows

---

## Next Steps

This specification covers Part 1 (7 pages). Part 2 will cover:
- Class Assignment Page
- Department Analytics Page
- Examinations Page
- Fees & Payments Page
- Reports Page
- Settings/Configuration Page

