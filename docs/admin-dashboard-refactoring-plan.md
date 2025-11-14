# Admin Dashboard Refactoring Plan

## Current Issues

1. **User Management Confusion**: Verified users (`is_verified=true`) are appearing in pending approvals when they have `status='pending'`. This is confusing because:
   - `is_verified` indicates email verification
   - `status` indicates account approval/activation
   - These should be separate concerns but displayed clearly

2. **Lack of Organization**: All user types (HODs, Teachers, Students) are mixed together in one page
3. **No Dedicated Management Pages**: Each entity type needs its own dedicated management page
4. **Overview Page is Too Cluttered**: The overview page tries to show everything at once

## Proposed Structure

### 1. Dashboard Overview (`/dashboard/overview`)
**Purpose**: High-level summaries and quick stats
**Sections**:
- School Information Card
- Key Metrics Cards (Total Users, Teachers, Students, HODs, Admins, Pending Approvals)
- Recent Activity Feed
- Quick Actions (Create User, Generate Report, etc.)
- Charts/Graphs (Attendance Trends, Fee Collection, etc.)

### 2. User Management (`/dashboard/users`)
**Purpose**: Central user management hub with tabs
**Tabs**:
- **All Users**: Complete list with filters (role, status, verified)
- **Pending Approvals**: Only users with `status='pending'` (regardless of verification)
- **HODs**: Filtered view of HODs with management actions
- **Teachers**: Filtered view of teachers with management actions
- **Students**: Filtered view of students with management actions

### 3. HODs Management (`/dashboard/hods`)
**Purpose**: Dedicated page for managing Heads of Department
**Sections**:
- HODs List Table (Name, Email, Department, Status, Actions)
- Create/Edit HOD Modal
- Assign Department
- Remove HOD Role
- HOD Statistics

### 4. Teachers Management (`/dashboard/teachers`)
**Purpose**: Dedicated page for managing teachers
**Sections**:
- Teachers List Table (Name, Email, Subjects, Classes, Status, Actions)
- Create/Edit Teacher Modal
- Assign Subjects/Classes
- Teacher Statistics
- Bulk Actions (Assign to Class, Assign Subject)

### 5. Students Management (`/dashboard/students`)
**Purpose**: Dedicated page for managing students
**Sections**:
- Students List Table (Name, Admission Number, Class, Status, Actions)
- Create/Edit Student Modal
- Assign to Class
- Promote/Transfer Students
- Student Statistics
- Bulk Actions (Assign to Class, Export List)

### 6. Subjects Management (`/dashboard/subjects`)
**Purpose**: Manage subjects catalog
**Sections**:
- Subjects List Table (Name, Code, Description, Actions)
- Create/Edit Subject Modal
- Subject Statistics
- Class-Subject Mapping
- Student-Subject Enrollment

### 7. Grades/Marks Management (`/dashboard/grades`)
**Purpose**: Manage grades and exam results
**Sections**:
- Exams List
- Grade Entry Interface
- Grade Statistics
- Grade Reports
- Grade Scale Configuration

### 8. Attendance Management (`/dashboard/attendance`)
**Purpose**: Manage attendance records
**Sections**:
- Attendance Overview
- Mark Attendance (by Class/Date)
- Attendance Statistics
- Attendance Reports
- Bulk Attendance Actions

## Backend API Requirements

### User Management APIs
- `GET /users?status=pending` - List pending users
- `PATCH /users/:userId/status` - Update user status (approve/reject)
- `GET /users?role=hod` - List HODs
- `GET /users?role=teacher` - List teachers
- `GET /users?role=student` - List students

### HOD Management APIs
- `POST /users/:userId/roles/hod` - Assign HOD role
- `DELETE /users/:userId/roles/hod` - Remove HOD role
- `PATCH /users/:userId/department` - Assign department

### Teacher Management APIs
- `POST /teachers` - Create teacher
- `PATCH /teachers/:id` - Update teacher
- `POST /teachers/:id/assignments` - Assign to class/subject
- `DELETE /teachers/:id/assignments/:assignmentId` - Remove assignment

### Student Management APIs
- `POST /students` - Create student
- `PATCH /students/:id` - Update student
- `PATCH /students/:id/promote` - Promote/transfer student
- `POST /students/bulk` - Bulk create students

### Subject Management APIs
- Already exists via `api.admin.listSubjects()`, `api.admin.createSubject()`, etc.

### Grades Management APIs
- Already exists via `api.listExams()`, `api.createExam()`, etc.

### Attendance Management APIs
- Already exists via `api.markAttendance()`, `api.getClassAttendanceSnapshot()`, etc.

## Frontend Implementation Plan

### Phase 1: Fix User Management Logic
1. Fix `listPendingUsers` to properly filter by `status='pending'`
2. Update `AdminRoleManagementPage` to show verified status clearly
3. Separate pending approvals from verified users

### Phase 2: Create New Management Pages
1. Create `AdminHODsManagementPage`
2. Create `AdminTeachersManagementPage`
3. Create `AdminStudentsManagementPage`
4. Create `AdminSubjectsManagementPage` (refactor from ClassesSubjectsPage)
5. Create `AdminGradesManagementPage`
6. Refactor `AdminAttendancePage` (already exists, improve it)

### Phase 3: Refactor Overview Page
1. Convert to dashboard-style layout
2. Add summary cards
3. Add quick actions
4. Add charts/graphs (optional)

### Phase 4: Update Navigation
1. Update `AdminShell` navigation
2. Add new routes to `App.tsx`
3. Update breadcrumbs

## File Structure

```
frontend/src/pages/admin/
├── AdminOverviewPage.tsx (Dashboard)
├── AdminUserManagementPage.tsx (Central hub with tabs)
├── AdminHODsManagementPage.tsx
├── AdminTeachersManagementPage.tsx
├── AdminStudentsManagementPage.tsx
├── AdminSubjectsManagementPage.tsx
├── AdminGradesManagementPage.tsx
├── AdminAttendancePage.tsx (already exists, improve)
├── AdminClassesSubjectsPage.tsx (keep for class-subject mapping)
├── AdminConfigurationPage.tsx (keep)
├── AdminReportsPage.tsx (keep)
├── AdminInvoicePage.tsx (keep)
└── AdminExamConfigPage.tsx (keep)
```

## Status Field Logic

- `status='pending'`: User registered but not approved by admin
- `status='active'`: User approved and can sign in
- `status='rejected'`: User registration rejected
- `status='suspended'`: User temporarily suspended
- `is_verified`: Email verification status (separate from status)

## Approval Logic

- Only users with `status='pending'` should appear in pending approvals
- `is_verified` is informational only
- Approving a user sets `status='active'`
- Rejecting a user sets `status='rejected'`

