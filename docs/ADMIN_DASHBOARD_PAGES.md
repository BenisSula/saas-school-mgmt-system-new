# Admin Dashboard Pages - Overview

This document lists all available pages in the Admin Dashboard with their purposes and routes.

## Admin Dashboard Pages

### 1. **Admin Overview Page** (`/dashboard/overview`)
**File:** `frontend/src/pages/admin/AdminOverviewPage.tsx`  
**Purpose:** Executive dashboard providing a high-level overview of the school's key metrics and statistics. Displays summary cards for total users, teachers, students, HODs, and admins. Includes role distribution charts (pie chart), user status distribution (bar chart), and recent user activity table. Serves as the main landing page for administrators.

---

### 2. **User Management Page** (`/dashboard/users`)
**File:** `frontend/src/pages/admin/RoleManagementPage.tsx`  
**Purpose:** Central hub for managing all users in the system. Handles user registration, role assignment, status management (pending/active/suspended), and user verification. Displays all users and pending users separately. Allows admins to approve/reject pending user registrations, assign roles, and manage user accounts.

---

### 3. **Teachers Management Page** (`/dashboard/teachers`)
**File:** `frontend/src/pages/admin/TeachersManagementPage.tsx`  
**Purpose:** Comprehensive management interface for teachers. Enables creating, viewing, updating, and deleting teacher profiles. Features include: teacher assignment to classes/subjects, CSV import/export, advanced filtering (by class, subject, search), bulk operations, activity logs, and detailed teacher profile views. Supports assigning teachers to specific classes and subjects.

---

### 4. **Students Management Page** (`/dashboard/students`)
**File:** `frontend/src/pages/admin/StudentsManagementPage.tsx`  
**Purpose:** Complete student management system. Allows creating, viewing, updating, and deleting student records. Features include: class assignment, enrollment status management, CSV import/export, advanced filtering (by class, enrollment status, search), bulk operations, activity logs, student promotion/transfer, and detailed student profile views.

---

### 5. **HODs Management Page** (`/dashboard/hods`)
**File:** `frontend/src/pages/admin/HODsManagementPage.tsx`  
**Purpose:** Management interface for Heads of Department (HODs). Enables creating HOD roles, assigning departments to HODs, viewing teachers under HOD oversight, department-level analytics, CSV import/export, advanced filtering (by department, search), and viewing HOD details. HODs are teachers with additional 'hod' role assigned.

---

### 6. **Classes & Subjects Page** (`/dashboard/classes`)
**File:** `frontend/src/pages/admin/AdminClassesSubjectsPage.tsx`  
**Purpose:** Management interface for academic classes and subjects. Allows creating, updating, and deleting classes and subjects. Features include: class-subject mapping, teacher assignment to class-subject combinations, viewing class details (students, subjects, teachers), subject code management, and class roster management.

---

### 7. **Attendance Page** (`/dashboard/attendance`)
**File:** `frontend/src/pages/admin/AdminAttendancePage.tsx`  
**Purpose:** School-wide attendance management and monitoring. Allows admins to view and manage attendance records across all classes. Features include: class selection, date-based attendance viewing, attendance status tracking (present/absent/late), and attendance record management. Provides administrative oversight of attendance data.

---

### 8. **Class Assignment Page** (`/dashboard/class-assignment`)
**File:** `frontend/src/pages/admin/AdminClassAssignmentPage.tsx`  
**Purpose:** Interface for assigning students and teachers to classes. Enables bulk assignment operations, assigning students to classes, assigning teachers to classes/subjects (including class teacher designation), and viewing current class assignments. Streamlines the process of organizing academic structure.

---

### 9. **Department Analytics Page** (`/dashboard/department-analytics`)
**File:** `frontend/src/pages/admin/AdminDepartmentAnalyticsPage.tsx`  
**Purpose:** Analytics and insights dashboard for departments. Displays department-level statistics including: teacher distribution by department, student distribution by class, department performance metrics, and visual charts (bar charts, pie charts, line charts). Allows filtering by specific department for detailed analysis.

---

### 10. **Examinations Page** (`/dashboard/examinations`)
**File:** `frontend/src/pages/admin/AdminExamConfigPage.tsx`  
**Purpose:** Examination configuration and management. Allows creating, updating, and deleting exams. Features include: exam name and description management, exam date setting, grading scale configuration, exam listing with details, and exam deletion. Manages the examination schedule and configuration.

---

### 11. **Fees & Payments Page** (`/dashboard/fees`)
**File:** `frontend/src/pages/admin/InvoicePage.tsx`  
**Purpose:** Financial management interface for student fees and invoices. Enables creating invoices for students, managing invoice items (descriptions and amounts), setting due dates, tracking invoice status (pending/paid/overdue), filtering invoices by status, and viewing all invoices. Handles the school's billing and payment tracking.

---

### 12. **Reports Page** (`/dashboard/reports`)
**File:** `frontend/src/pages/admin/AdminReportsPage.tsx`  
**Purpose:** Comprehensive reporting and export functionality. Provides attendance reports, grade reports, fee reports, and printable student reports. Features include: date range filtering, class-based filtering, exam-based grade reports, fee status reports, export capabilities (CSV, PDF, Excel), and aggregate data visualization with charts.

---

### 13. **Settings/Configuration Page** (`/dashboard/settings`)
**File:** `frontend/src/pages/admin/ConfigurationPage.tsx`  
**Purpose:** School configuration and settings management. Allows managing academic terms (create, update, delete), school classes, branding configuration (logo, colors, theme flags), and general school settings. Features include: term date management, class management, branding customization, and system configuration options.

---

## Additional Notes

- All pages require `admin` or `superadmin` role access
- Pages use React Query for data fetching and caching
- Common features across management pages: CSV import/export, advanced filtering, pagination, bulk operations, activity logs
- All pages follow consistent UI patterns using shared components (Modal, Table, Button, etc.)
- Pages are protected by RBAC (Role-Based Access Control) middleware
- Responsive design with mobile-friendly layouts
- Error handling and loading states implemented throughout

---

## Route Structure

```
/dashboard/overview              → Admin Overview
/dashboard/users                 → User Management
/dashboard/teachers              → Teachers Management
/dashboard/students              → Students Management
/dashboard/hods                  → HODs Management
/dashboard/classes               → Classes & Subjects
/dashboard/attendance            → Attendance
/dashboard/class-assignment      → Class Assignment
/dashboard/department-analytics  → Department Analytics
/dashboard/examinations          → Examinations
/dashboard/fees                  → Fees & Payments
/dashboard/reports               → Reports
/dashboard/settings              → Settings/Configuration
```


