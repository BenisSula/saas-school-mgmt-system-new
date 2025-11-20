# Admin Dashboard Data Organization (RBAC-Based)

## Overview
This document describes how data is organized across the Admin Dashboard according to RBAC principles, ensuring each management page contains only its relevant data.

---

## Data Distribution by Page

### 1. **Admin Overview Page** (`/dashboard/overview`)
**Purpose**: High-level dashboard with statistics and quick navigation

**Data Displayed**:
- ✅ School information summary
- ✅ Statistics cards (Total Users, Teachers, HODs, Students, Admins, Pending)
- ✅ Role distribution chart
- ✅ User status distribution chart
- ✅ Quick access buttons to management pages

**Data NOT Displayed**:
- ❌ Detailed user tables (moved to respective pages)
- ❌ Teacher details (moved to Teachers Management)
- ❌ Student details (moved to Students Management)
- ❌ HOD details (moved to HODs Management)

---

### 2. **User Management Page** (`/dashboard/users`)
**Purpose**: General user role management and approvals

**Data Displayed**:
- ✅ All users (for role assignment)
- ✅ Pending user approvals (all roles)
- ✅ User registration functionality
- ✅ Role change functionality

**Data NOT Displayed**:
- ❌ Detailed teacher profiles (use Teachers Management)
- ❌ Detailed student profiles (use Students Management)
- ❌ Detailed HOD profiles (use HODs Management)

**Quick Links**:
- Links to Teachers Management
- Links to Students Management
- Links to HODs Management

---

### 3. **HODs Management Page** (`/dashboard/hods`)
**Purpose**: Manage Heads of Department

**Data Displayed**:
- ✅ **HODs only** (teachers with `additional_roles` containing 'hod')
- ✅ Department assignments
- ✅ Classes monitored by department
- ✅ Teachers under HOD oversight
- ✅ Students in department classes
- ✅ Department analytics
- ✅ HOD profile information
- ✅ Pending HOD approvals

**RBAC Filtering**:
- Filters users: `role === 'teacher' && additional_roles.some(r => r.role === 'hod')`
- Excludes regular teachers

**Features**:
- Create HOD
- Assign department
- Manage classes
- Manage teachers in department
- Manage students in department
- View analytics
- Password management

---

### 4. **Teachers Management Page** (`/dashboard/teachers`)
**Purpose**: Manage regular teachers (excluding HODs)

**Data Displayed**:
- ✅ **Regular teachers only** (excludes HODs)
- ✅ Teacher profiles (name, email, subjects, classes)
- ✅ Qualifications and experience
- ✅ Class assignments
- ✅ Subject assignments
- ✅ Pending teacher approvals

**RBAC Filtering**:
- Filters out HODs: Excludes teachers whose email matches users with `additional_roles` containing 'hod'
- Shows only: `teachers.filter(t => !hodEmails.has(t.email))`

**Features**:
- Create teacher
- Assign classes and subjects
- Manage subjects (add/edit/delete)
- Manage assignments (class/subject/room)
- View reports
- Password management
- Qualifications management

---

### 5. **Students Management Page** (`/dashboard/students`)
**Purpose**: Manage student records

**Data Displayed**:
- ✅ **Students only** (`role === 'student'`)
- ✅ Student profiles (name, admission number, class)
- ✅ Class assignments
- ✅ Subject enrollments
- ✅ Parent/guardian information
- ✅ Enrollment dates
- ✅ Pending student approvals

**RBAC Filtering**:
- Filters users: `role === 'student'`
- Excludes teachers, HODs, admins

**Features**:
- Create student
- Assign class
- Manage subjects
- Manage parent/guardian contacts
- Password management
- Academic history

---

### 6. **Classes & Subjects Page** (`/dashboard/classes`)
**Purpose**: Manage academic structure

**Data Displayed**:
- ✅ **Classes** (all classes in tenant)
- ✅ **Subjects** (all subjects in tenant)
- ✅ Class-subject mappings
- ✅ Teacher-class-subject assignments
- ✅ Student subject enrollments
- ✅ Student promotions/transfers

**RBAC Filtering**:
- Shows all classes and subjects (tenant-level)
- Uses teachers/students for assignment purposes only

**Features**:
- Create/edit/delete subjects
- Create/edit classes
- Map subjects to classes
- Assign teachers to classes/subjects
- Manage student subject enrollments
- Promote/transfer students between classes

---

## RBAC Data Access Rules

### Admin Access
- **Full access** to all data within tenant
- Can view and manage:
  - All users (via User Management)
  - All teachers (via Teachers Management)
  - All students (via Students Management)
  - All HODs (via HODs Management)
  - All classes and subjects (via Classes & Subjects)

### HOD Access (if implemented)
- **Department-level access** only
- Can view and manage:
  - Teachers in their department
  - Students in department classes
  - Classes in their department
  - Subjects taught in department

### Teacher Access
- **Class-level access** only
- Can view and manage:
  - Students in assigned classes
  - Own profile

### Student Access
- **Self-access** only
- Can view:
  - Own profile
  - Own class roster
  - Own subjects
  - Own attendance/grades

---

## Data Flow Summary

```
Admin Overview
├── Statistics & Charts (summary only)
└── Quick Links
    ├── User Management → All users (role management)
    ├── Teachers Management → Regular teachers only
    ├── Students Management → Students only
    ├── HODs Management → HODs only
    └── Classes & Subjects → Classes and subjects

User Management (/dashboard/users)
├── All users table
├── Pending approvals (all roles)
└── Quick Links → Teachers/Students/HODs pages

Teachers Management (/dashboard/teachers)
├── Regular teachers only (HODs excluded)
├── Teacher profiles
├── Class/subject assignments
└── Pending teacher approvals

Students Management (/dashboard/students)
├── Students only
├── Student profiles
├── Class assignments
└── Pending student approvals

HODs Management (/dashboard/hods)
├── HODs only (teachers with hod role)
├── Department management
├── Department classes
├── Department teachers
└── Department students

Classes & Subjects (/dashboard/classes)
├── All classes
├── All subjects
├── Class-subject mappings
└── Teacher/student assignments
```

---

## Implementation Details

### HODs Filtering
```typescript
// HODsManagementPage.tsx
const hodUsers = users.filter(
  (u) => u.role === 'teacher' && u.additional_roles?.some((r) => r.role === 'hod')
);
```

### Teachers Filtering (Exclude HODs)
```typescript
// TeachersManagementPage.tsx
const hodEmails = new Set(
  users
    .filter((u) => u.role === 'teacher' && u.additional_roles?.some((r) => r.role === 'hod'))
    .map((u) => u.email.toLowerCase())
);
const regularTeachers = allTeachers.filter(
  (t) => !hodEmails.has(t.email?.toLowerCase() ?? '')
);
```

### Students Filtering
```typescript
// StudentsManagementPage.tsx
const pending = pendingUsersResult.value.filter(
  (u) => u.role === 'student' && u.status === 'pending'
);
```

---

## Backend RBAC Filtering

The backend services now apply RBAC filtering:

### `listTeachers()` with RBAC
- **HOD**: Returns teachers in their department only
- **Teacher**: Returns own profile only
- **Admin/SuperAdmin**: Returns all teachers

### `listStudents()` with RBAC
- **HOD**: Returns students in department classes only
- **Teacher**: Returns students in assigned classes only
- **Student**: Returns own profile only
- **Admin/SuperAdmin**: Returns all students

---

## Verification Checklist

- ✅ Admin Overview shows only statistics and quick links
- ✅ User Management shows all users for role management
- ✅ HODs Management shows only HODs (teachers with hod role)
- ✅ Teachers Management shows only regular teachers (HODs excluded)
- ✅ Students Management shows only students
- ✅ Classes & Subjects shows classes and subjects
- ✅ Each page has appropriate CRUD operations
- ✅ Backend applies RBAC filtering based on user role
- ✅ No data duplication across pages

