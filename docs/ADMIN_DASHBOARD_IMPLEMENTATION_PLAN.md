# School Admin Dashboard Implementation Plan

## Overview
This document outlines the implementation plan for PROMPT 5 - School Admin Dashboard with full tenant-level administrative capabilities.

## Implementation Status

### ✅ Already Implemented
- Admin academics routes (`/admin` - subjects, classes, teacher assignments)
- Admin users routes (`/admin/users` - HOD department assignment)
- Admin password management (`/admin/passwords`)
- User creation service (`adminUserService.ts`)
- Subject management service
- Student/Teacher services

### 🔨 To Be Implemented

#### Backend Services
1. **Department Management Service** (`services/admin/departmentService.ts`)
   - Create, read, update, delete departments
   - Assign HOD to department
   - List departments with user counts

2. **Class Management Service** (`services/admin/classService.ts`)
   - Create, read, update, delete classes
   - Assign class teacher
   - Manage student enrollment
   - List classes with student/teacher counts

3. **Admin User Management Service** (extend existing)
   - Create HOD users
   - List all users with filters
   - Enable/disable users
   - Bulk operations

4. **Admin Reporting Service** (`services/admin/reportingService.ts`)
   - Activity logs
   - Login reports
   - Performance summaries

5. **Admin Notification Service** (extend existing)
   - Create announcements
   - Send to specific roles
   - List announcements

#### Backend Routes
1. **Admin Dashboard Routes** (`routes/admin/dashboard.ts`)
   - GET `/admin/dashboard` - Dashboard stats

2. **Admin User Management Routes** (`routes/admin/userManagement.ts`)
   - POST `/admin/users/hod/create`
   - POST `/admin/users/teacher/create`
   - POST `/admin/users/student/create`
   - GET `/admin/users`
   - PATCH `/admin/users/:id/disable`
   - PATCH `/admin/users/:id/enable`

3. **Department Routes** (`routes/admin/departments.ts`)
   - POST `/admin/departments`
   - GET `/admin/departments`
   - PATCH `/admin/departments/:id`
   - DELETE `/admin/departments/:id`
   - PATCH `/admin/departments/:id/assign-hod`

4. **Class Routes** (`routes/admin/classes.ts`)
   - POST `/admin/classes`
   - GET `/admin/classes`
   - PATCH `/admin/classes/:id`
   - DELETE `/admin/classes/:id`
   - POST `/admin/classes/:id/assign-students`
   - PATCH `/admin/classes/:id/assign-teacher`

5. **Reporting Routes** (`routes/admin/reports.ts`)
   - GET `/admin/reports/activity`
   - GET `/admin/reports/logins`
   - GET `/admin/reports/performance`

6. **Notification Routes** (`routes/admin/notifications.ts`)
   - POST `/admin/announcements`
   - GET `/admin/announcements`

#### Frontend Pages
1. **Admin Dashboard** (`pages/admin/dashboard/page.tsx`)
2. **Users Management** (`pages/admin/users/page.tsx`)
3. **Departments** (`pages/admin/departments/page.tsx`)
4. **Classes** (`pages/admin/classes/page.tsx`)
5. **Subjects** (`pages/admin/subjects/page.tsx`) - may already exist
6. **Reports** (`pages/admin/reports/page.tsx`)
7. **Announcements** (`pages/admin/announcements/page.tsx`)

## Database Requirements
- Verify tenant schema tables exist:
  - `departments` (in shared schema)
  - `classes` (in tenant schema)
  - `subjects` (in tenant schema)
  - `activity_logs` (in tenant schema)
  - `announcements` (in tenant schema)

## Security Requirements
- All routes require `authenticate` + `tenantResolver()` + `ensureTenantContext()`
- RBAC: `requirePermission('users:manage')` or appropriate permissions
- Audit logging for all admin actions
- Input validation with Zod schemas
- Rate limiting on sensitive operations

## DRY Principles
- Reuse existing services where possible
- Extract shared validation logic
- Use existing audit logging utilities
- Share UI components across admin pages

