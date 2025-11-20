# Data Classification & RBAC Architecture

## Overview
This document classifies all data entities in the database with respect to RBAC (Role-Based Access Control) and multi-tenant architecture.

---

## Database Architecture

### Schema Structure
- **`shared` schema**: Platform-wide data (multi-tenant)
- **`{tenant_schema}` schemas**: Tenant-specific data (isolated per school)

---

## 1. SCHOOL

### Classification: **PLATFORM-LEVEL ENTITY**

#### Database Location
- **Shared Schema**: `shared.schools`
- **Tenant Schema**: `{schema}.schools` (tenant-specific school info)

#### Schema Structure
```sql
-- shared.schools (Platform-level)
- id (UUID, PK)
- tenant_id (UUID, FK → shared.tenants) -- Links to tenant
- name (TEXT)
- address (TEXT)
- contact_phone (TEXT)
- contact_email (TEXT)
- registration_code (TEXT, UNIQUE)
- metadata (JSONB)
- created_at, updated_at

-- {schema}.schools (Tenant-specific)
- id (UUID, PK)
- name (TEXT)
- address (JSONB)
- created_at, updated_at
```

#### RBAC Access
- **SuperAdmin**: Full CRUD (`tenants:manage`, `school:manage`)
- **Admin**: Read/Update own school (`school:manage`)
- **HOD**: Read only (department-level)
- **Teacher**: Read only
- **Student**: Read only

#### Data Isolation
- Platform-level: One school per tenant (1:1 relationship)
- Tenant-level: School-specific configuration

---

## 2. HOD (Head of Department)

### Classification: **ROLE-BASED ENTITY (TEACHER WITH ADDITIONAL ROLE)**

#### Database Location
- **Shared Schema**: `shared.users` (role = 'teacher' + `shared.user_roles` with role = 'hod')
- **Shared Schema**: `shared.departments` (department assignment)
- **Tenant Schema**: `{schema}.teachers` (profile data)

#### Schema Structure
```sql
-- shared.users
- id (UUID, PK)
- email (TEXT, UNIQUE)
- role (TEXT) -- 'teacher'
- tenant_id (UUID, FK)
- school_id (UUID, FK → shared.schools)
- department_id (UUID, FK → shared.departments) -- Department assignment
- is_teaching_staff (BOOLEAN) -- TRUE

-- shared.user_roles (Additional role)
- user_id (UUID, FK → shared.users)
- role_name (TEXT) -- 'hod'
- metadata (JSONB) -- Department info

-- shared.departments
- id (UUID, PK)
- school_id (UUID, FK → shared.schools)
- name (TEXT)
- slug (TEXT)
- contact_email, contact_phone
- metadata (JSONB)

-- {schema}.teachers (Profile)
- id (UUID, PK)
- name (TEXT)
- email (TEXT, UNIQUE)
- subjects (JSONB) -- Array of subject IDs
- assigned_classes (JSONB) -- Array of class IDs
- qualifications (TEXT)
- years_of_experience (INTEGER)
```

#### RBAC Access
- **SuperAdmin**: Full CRUD (`users:manage`, `tenants:manage`)
- **Admin**: Full CRUD within tenant (`users:manage`, `teachers:manage`)
- **HOD**: Read own department, manage department teachers (`department-analytics`)
- **Teacher**: Read own profile (`profile:view_self`)
- **Student**: No access

#### Data Isolation
- **Tenant-level**: HODs belong to a tenant
- **School-level**: HODs belong to a school (via `school_id`)
- **Department-level**: HODs manage a department (via `department_id`)

#### Key Relationships
- HOD is a **Teacher** with additional `hod` role in `shared.user_roles`
- HOD manages a **Department** (`shared.departments`)
- HOD oversees **Teachers** in their department
- HOD monitors **Classes** taught by department teachers
- HOD views **Students** in department classes

---

## 3. TEACHER

### Classification: **TENANT-SPECIFIC ENTITY**

#### Database Location
- **Shared Schema**: `shared.users` (authentication & role)
- **Tenant Schema**: `{schema}.teachers` (profile data)
- **Tenant Schema**: `{schema}.teacher_assignments` (class/subject assignments)

#### Schema Structure
```sql
-- shared.users
- id (UUID, PK)
- email (TEXT, UNIQUE)
- role (TEXT) -- 'teacher'
- tenant_id (UUID, FK)
- school_id (UUID, FK → shared.schools)
- department_id (UUID, FK → shared.departments) -- Optional
- is_teaching_staff (BOOLEAN) -- TRUE

-- {schema}.teachers
- id (UUID, PK)
- name (TEXT)
- email (TEXT, UNIQUE)
- subjects (JSONB) -- Array of subject IDs
- assigned_classes (JSONB) -- Array of class IDs
- qualifications (TEXT)
- years_of_experience (INTEGER)
- created_at, updated_at

-- {schema}.teacher_assignments
- id (UUID, PK)
- teacher_id (UUID, FK → {schema}.teachers)
- class_id (UUID, FK → {schema}.classes)
- subject_id (UUID, FK → {schema}.subjects)
- is_class_teacher (BOOLEAN)
- metadata (JSONB) -- Room, etc.
```

#### RBAC Access
- **SuperAdmin**: Full CRUD (`users:manage`, `teachers:manage`)
- **Admin**: Full CRUD within tenant (`users:manage`, `teachers:manage`)
- **HOD**: Read/manage teachers in own department (`department-analytics`)
- **Teacher**: Read own profile, manage own classes (`profile:view_self`, `students:view_own_class`)
- **Student**: No direct access

#### Data Isolation
- **Tenant-level**: Teachers belong to a tenant
- **School-level**: Teachers belong to a school (via `school_id`)
- **Department-level**: Teachers may belong to a department (via `department_id`)

#### Key Relationships
- Teacher teaches **Subjects** (via `subjects` JSONB array)
- Teacher assigned to **Classes** (via `assigned_classes` JSONB + `teacher_assignments`)
- Teacher teaches **Students** (via class assignments)
- Teacher may be managed by **HOD** (if in department)

---

## 4. STUDENT

### Classification: **TENANT-SPECIFIC ENTITY**

#### Database Location
- **Shared Schema**: `shared.users` (authentication & role)
- **Tenant Schema**: `{schema}.students` (profile data)
- **Tenant Schema**: `{schema}.student_subjects` (subject enrollments)
- **Tenant Schema**: `{schema}.student_promotions` (class changes)

#### Schema Structure
```sql
-- shared.users
- id (UUID, PK)
- email (TEXT, UNIQUE)
- role (TEXT) -- 'student'
- tenant_id (UUID, FK)
- school_id (UUID, FK → shared.schools)
- department_id (UUID, FK → shared.departments) -- Via class
- is_teaching_staff (BOOLEAN) -- FALSE

-- {schema}.students
- id (UUID, PK)
- user_id (UUID, FK → shared.users) -- Links to auth
- first_name, last_name (TEXT)
- full_name (TEXT)
- email (TEXT, UNIQUE)
- date_of_birth (DATE)
- gender (TEXT) -- 'M' or 'F'
- class_id (TEXT) -- Class name (legacy)
- class_uuid (UUID, FK → {schema}.classes) -- Class UUID
- admission_number (TEXT, UNIQUE)
- enrollment_date (DATE)
- parent_contacts (JSONB) -- Array of parent info
- school_id (UUID) -- Reference to shared.schools
- department_id (UUID) -- Via class assignment
- status (TEXT) -- 'active', 'inactive', etc.
- metadata (JSONB)

-- {schema}.student_subjects
- id (UUID, PK)
- student_id (UUID, FK → {schema}.students)
- subject_id (UUID, FK → {schema}.subjects)
- class_id (UUID, FK → {schema}.classes)
- academic_year (TEXT)
- enrollment_status (TEXT) -- 'enrolled', 'dropped', etc.
```

#### RBAC Access
- **SuperAdmin**: Full CRUD (`users:manage`, `students:manage`)
- **Admin**: Full CRUD within tenant (`users:manage`, `students:manage`)
- **HOD**: Read students in department classes (`department-analytics`)
- **Teacher**: Read students in own classes (`students:view_own_class`)
- **Student**: Read own profile (`students:view_self`, `profile:view_self`)

#### Data Isolation
- **Tenant-level**: Students belong to a tenant
- **School-level**: Students belong to a school (via `school_id`)
- **Class-level**: Students assigned to a class (via `class_uuid`)
- **Department-level**: Students inherit department from class

#### Key Relationships
- Student enrolled in **Class** (via `class_uuid`)
- Student takes **Subjects** (via `student_subjects`)
- Student taught by **Teachers** (via class assignments)
- Student may be monitored by **HOD** (via department)

---

## 5. CLASS

### Classification: **TENANT-SPECIFIC ENTITY**

#### Database Location
- **Tenant Schema**: `{schema}.classes`

#### Schema Structure
```sql
-- {schema}.classes
- id (UUID, PK)
- name (TEXT, UNIQUE)
- description (TEXT)
- school_id (UUID) -- Reference to shared.schools
- department_id (UUID) -- Reference to shared.departments
- grade_level (TEXT) -- e.g., 'Grade 10'
- section (TEXT) -- e.g., 'A', 'B', 'C'
- class_teacher_id (UUID, FK → {schema}.teachers)
- capacity (INTEGER)
- academic_year (TEXT)
- metadata (JSONB)
- created_at, updated_at
```

#### RBAC Access
- **SuperAdmin**: Full CRUD (`settings:classes`, `tenants:manage`)
- **Admin**: Full CRUD within tenant (`settings:classes`)
- **HOD**: Read classes in own department (`department-analytics`)
- **Teacher**: Read classes assigned to them (`students:view_own_class`)
- **Student**: Read own class (`profile:view_self`)

#### Data Isolation
- **Tenant-level**: Classes belong to a tenant schema
- **School-level**: Classes belong to a school (via `school_id`)
- **Department-level**: Classes belong to a department (via `department_id`)

#### Key Relationships
- Class belongs to **Department** (via `department_id`)
- Class has **Class Teacher** (via `class_teacher_id`)
- Class contains **Students** (via `students.class_uuid`)
- Class has **Subjects** (via `class_subjects`)
- Class taught by **Teachers** (via `teacher_assignments`)

---

## 6. SUBJECTS

### Classification: **TENANT-SPECIFIC ENTITY**

#### Database Location
- **Tenant Schema**: `{schema}.subjects`
- **Tenant Schema**: `{schema}.class_subjects` (class-subject mapping)
- **Tenant Schema**: `{schema}.student_subjects` (student-subject enrollment)

#### Schema Structure
```sql
-- {schema}.subjects
- id (UUID, PK)
- name (TEXT, UNIQUE)
- code (TEXT, UNIQUE)
- description (TEXT)
- metadata (JSONB)
- created_at, updated_at

-- {schema}.class_subjects
- id (UUID, PK)
- class_id (UUID, FK → {schema}.classes)
- subject_id (UUID, FK → {schema}.subjects)
- metadata (JSONB)
- UNIQUE (class_id, subject_id)

-- {schema}.student_subjects
- id (UUID, PK)
- student_id (UUID, FK → {schema}.students)
- subject_id (UUID, FK → {schema}.subjects)
- class_id (UUID, FK → {schema}.classes)
- academic_year (TEXT)
- enrollment_status (TEXT)
- UNIQUE (student_id, subject_id, academic_year)
```

#### RBAC Access
- **SuperAdmin**: Full CRUD (`settings:classes`, `tenants:manage`)
- **Admin**: Full CRUD within tenant (`settings:classes`, `settings:terms`)
- **HOD**: Read subjects in department (`department-analytics`)
- **Teacher**: Read subjects they teach (`profile:view_self`)
- **Student**: Read subjects enrolled (`profile:view_self`)

#### Data Isolation
- **Tenant-level**: Subjects belong to a tenant schema
- **No school/department isolation**: Subjects are shared across tenant

#### Key Relationships
- Subject taught in **Classes** (via `class_subjects`)
- Subject taught by **Teachers** (via `teacher_assignments`)
- Subject enrolled by **Students** (via `student_subjects`)
- Subject may belong to **Department** (via class → department)

---

## RBAC Permission Matrix

| Permission | SuperAdmin | Admin | HOD | Teacher | Student |
|------------|-----------|-------|-----|---------|---------|
| `tenants:manage` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `users:manage` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `teachers:manage` | ✅ | ✅ | ⚠️* | ❌ | ❌ |
| `students:manage` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `school:manage` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `settings:classes` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `department-analytics` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `students:view_own_class` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `students:view_self` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `profile:view_self` | ✅ | ✅ | ✅ | ✅ | ✅ |

*HOD can manage teachers in their department only

---

## Data Access Patterns

### Tenant Isolation
- All tenant-specific data is isolated by schema (`SET search_path = {tenant_schema}`)
- Services use `tenantClient` with search_path set
- RBAC middleware enforces tenant context

### School Isolation (within tenant)
- Some tenants may have multiple schools (via `school_id`)
- Currently: 1:1 tenant:school relationship
- Future: Multi-school tenants supported

### Department Isolation (within school)
- Departments belong to schools (`shared.departments.school_id`)
- HODs manage departments (`shared.users.department_id`)
- Teachers may belong to departments (`shared.users.department_id`)
- Classes belong to departments (`{schema}.classes.department_id`)

---

## Implementation Recommendations

1. **Enforce Department-Level Access**: HODs should only access data in their department
2. **Class-Level Access**: Teachers should only access their assigned classes
3. **Student Self-Access**: Students should only access their own data
4. **Admin Override**: Admins have full access within tenant
5. **SuperAdmin Override**: SuperAdmins have platform-wide access

---

## Current Issues & Fixes Needed

1. **Missing Department Filtering**: Services don't filter by `department_id` for HOD access
2. **Missing Class Filtering**: Services don't filter by teacher assignments
3. **Missing Self-Access Checks**: Some endpoints don't verify self-access for students
4. **Inconsistent School References**: Some tables use `school_id`, some don't

