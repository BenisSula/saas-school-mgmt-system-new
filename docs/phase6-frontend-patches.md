# PHASE 6 — FRONTEND CODE PATCHES

**Date:** 2025-01-XX  
**Status:** Implementation Complete  
**Branch:** `fix/superuser-flow-validation`

---

## PATCHES GROUPED BY FILE

### File: `frontend/src/lib/api.ts`

```diff
--- a/frontend/src/lib/api.ts
+++ b/frontend/src/lib/api.ts
@@ -620,7 +620,7 @@ export interface TenantUser {
   is_verified: boolean;
   created_at: string;
   status?: UserStatus;
-  additional_roles?: Array<{ role: string; metadata?: Record<string, unknown> }>;
+  additional_roles?: Array<{ role: string; granted_at?: string; granted_by?: string; metadata?: Record<string, unknown> }>;
   pending_profile_data?: Record<string, unknown> | null; // Profile data for pending users (available for admin review)
 }
 
@@ -720,6 +720,30 @@ export interface GradeScale {
   remark: string | null;
 }
 
+export interface TeacherProfile {
+  id: string;
+  name: string;
+  email: string;
+  subjects: string[];
+  assigned_classes: string[];
+  created_at?: string;
+  updated_at?: string;
+}
+
+export interface TeacherClassInfo {
+  id: string;
+  name: string;
+  studentCount: number;
+}
+
+export interface TeacherStudent {
+  id: string;
+  first_name: string;
+  last_name: string;
+  email?: string;
+  class_id?: string | null;
+  class_uuid?: string | null;
+  admission_number?: string | null;
+}
+
 export interface TeacherAssignmentSummary {
   id: string;
   subjectName: string;
```

---

### File: `frontend/src/lib/api.ts` (API Client Methods)

```diff
--- a/frontend/src/lib/api.ts
+++ b/frontend/src/lib/api.ts
@@ -1195,6 +1195,7 @@ export const api = {
     // ... existing methods ...
   },
   teacher: {
+    // DEPRECATED: Use teachers.getMe() instead
     async getProfile() {
       const response = await fetch(`${API_BASE_URL}/teacher/profile`, {
         method: 'GET',
@@ -1202,6 +1203,7 @@ export const api = {
       });
       return response.json();
     },
+    // DEPRECATED: Use teachers.getMyClasses() instead
     async listClasses() {
       const response = await fetch(`${API_BASE_URL}/teacher/classes`, {
         method: 'GET',
@@ -1209,6 +1212,7 @@ export const api = {
       });
       return response.json();
     },
+    // DEPRECATED: Use teachers.getMyStudents() instead
     async getClassRoster(classId: string) {
       const response = await fetch(`${API_BASE_URL}/teacher/classes/${classId}/roster`, {
         method: 'GET',
@@ -1217,6 +1221,7 @@ export const api = {
       });
       return response.json();
     }
   },
+  teachers: {
+    async getMe(): Promise<TeacherProfile> {
+      const response = await fetch(`${API_BASE_URL}/teachers/me`, {
+        method: 'GET',
+        headers: await getAuthHeaders()
+      });
+      if (!response.ok) {
+        throw new Error(`Failed to get teacher profile: ${response.statusText}`);
+      }
+      return response.json();
+    },
+    async getMyClasses(): Promise<TeacherClassInfo[]> {
+      const response = await fetch(`${API_BASE_URL}/teachers/me/classes`, {
+        method: 'GET',
+        headers: await getAuthHeaders()
+      });
+      if (!response.ok) {
+        throw new Error(`Failed to get teacher classes: ${response.statusText}`);
+      }
+      return response.json();
+    },
+    async getMyStudents(params?: { classId?: string; limit?: number; offset?: number }): Promise<PaginatedResponse<TeacherStudent>> {
+      const queryParams = new URLSearchParams();
+      if (params?.classId) queryParams.append('classId', params.classId);
+      if (params?.limit) queryParams.append('limit', params.limit.toString());
+      if (params?.offset) queryParams.append('offset', params.offset.toString());
+      const queryString = queryParams.toString();
+      const url = `${API_BASE_URL}/teachers/me/students${queryString ? `?${queryString}` : ''}`;
+      const response = await fetch(url, {
+        method: 'GET',
+        headers: await getAuthHeaders()
+      });
+      if (!response.ok) {
+        throw new Error(`Failed to get teacher students: ${response.statusText}`);
+      }
+      return response.json();
+    }
+  },
   students: {
     // ... existing methods ...
   },
```

---

### File: `frontend/src/lib/utils/userHelpers.ts` (NEW FILE)

```diff
+import type { TenantUser } from '../api';
+
+/**
+ * Check if a user is an HOD (Head of Department)
+ * HODs have role='teacher' and additional_roles containing 'hod'
+ */
+export function isHOD(user: TenantUser): boolean {
+  return user.role === 'teacher' && hasAdditionalRole(user, 'hod');
+}
+
+/**
+ * Get all additional roles for a user
+ */
+export function getUserAdditionalRoles(user: TenantUser): Array<string> {
+  return user.additional_roles?.map((r) => r.role) || [];
+}
+
+/**
+ * Check if a user has a specific additional role
+ */
+export function hasAdditionalRole(user: TenantUser, role: string): boolean {
+  return user.additional_roles?.some((r) => r.role === role) ?? false;
+}
```

---

### File: `frontend/src/pages/admin/HODsManagementPage.tsx`

```diff
--- a/frontend/src/pages/admin/HODsManagementPage.tsx
+++ b/frontend/src/pages/admin/HODsManagementPage.tsx
@@ -1,5 +1,6 @@
 import { useMemo } from 'react';
 import { isHOD } from '../../lib/utils/userHelpers';
+// DEPRECATED: Inline HOD check replaced with helper function
 import RouteMeta from '../../components/layout/RouteMeta';
 
@@ -81,9 +82,7 @@ export default function HODsManagementPage() {
 
   // Filter HODs: teachers with additional_roles containing 'hod'
   const hodUsers = useMemo(
-    () =>
-      users.filter(
-        (u) => u.role === 'teacher' && u.additional_roles?.some((r) => r.role === 'hod')
-      ),
+    () => users.filter((u) => isHOD(u)),
     [users]
   );
```

---

### File: `frontend/src/pages/hod/HODProfilePage.tsx`

```diff
--- a/frontend/src/pages/hod/HODProfilePage.tsx
+++ b/frontend/src/pages/hod/HODProfilePage.tsx
@@ -1,5 +1,6 @@
 import { useQuery } from '@tanstack/react-query';
 import { isHOD, hasAdditionalRole } from '../../lib/utils/userHelpers';
+// DEPRECATED: Inline HOD check replaced with helper function
 import RouteMeta from '../../components/layout/RouteMeta';
 
@@ -29,9 +30,7 @@ export default function HODProfilePage() {
         // Check if user has HOD role
         if (usersData.status === 'fulfilled') {
           const user = usersData.value.find((u) => u.email === teacherProfile.email);
-          const isHOD = user?.additional_roles?.some((r) => r.role === 'hod');
-
-          if (isHOD && user) {
+          if (user && isHOD(user)) {
             // Extract department from metadata
-            const hodRole = user.additional_roles?.find((r) => r.role === 'hod');
+            const hodRole = user.additional_roles?.find((r) => r.role === 'hod');
             const department =
               (hodRole?.metadata as { department?: string })?.department ||
               teacherProfile.subjects[0] ||
```

---

### File: `frontend/src/pages/admin/AdminOverviewPage.tsx`

```diff
--- a/frontend/src/pages/admin/AdminOverviewPage.tsx
+++ b/frontend/src/pages/admin/AdminOverviewPage.tsx
@@ -1,5 +1,6 @@
 import { useMemo } from 'react';
 import { isHOD } from '../../lib/utils/userHelpers';
+// DEPRECATED: Inline HOD check replaced with helper function
 import RouteMeta from '../../components/layout/RouteMeta';
 
@@ -25,9 +26,7 @@ export default function AdminOverviewPage() {
     const totalUsers = users.length;
     const totalTeachers = users.filter((u) => u.role === 'teacher').length;
     const totalStudents = users.filter((u) => u.role === 'student').length;
-    const totalHODs = users.filter(
-      (u) => u.role === 'teacher' && u.additional_roles?.some((r) => r.role === 'hod')
-    ).length;
+    const totalHODs = users.filter((u) => isHOD(u)).length;
     const totalAdmins = users.filter((u) => u.role === 'admin').length;
     const pendingUsers = users.filter((u) => u.status === 'pending').length;
 
@@ -77,9 +76,7 @@ export default function AdminOverviewPage() {
         render: (row) => {
           const additionalRoles = row.additional_roles?.map((r) => r.role).join(', ') || '';
-          return row.role === 'teacher' && additionalRoles.includes('hod')
-            ? 'Teacher (HOD)'
-            : row.role.charAt(0).toUpperCase() + row.role.slice(1);
+          return isHOD(row) ? 'Teacher (HOD)' : row.role.charAt(0).toUpperCase() + row.role.slice(1);
         },
```

---

### File: `frontend/src/hooks/queries/useDashboardQueries.ts`

```diff
--- a/frontend/src/hooks/queries/useDashboardQueries.ts
+++ b/frontend/src/hooks/queries/useDashboardQueries.ts
@@ -1,5 +1,6 @@
 import { useQuery } from '@tanstack/react-query';
 import { api } from '../../lib/api';
+import { isHOD, hasAdditionalRole } from '../../lib/utils/userHelpers';
+// DEPRECATED: Inline HOD check replaced with helper function
 import { useAuth } from '../../context/AuthContext';
 
@@ -110,7 +111,7 @@ export function useTeacherDashboard() {
       // Get teacher profile to determine department
       const teacherProfile = await api.teacher.getProfile();
       const users = await api.listUsers();
       const currentUser = users.find((u) => u.id === user?.id);
-      const hodRole = currentUser?.additional_roles?.find((r) => r.role === 'hod');
+      const isUserHOD = currentUser && isHOD(currentUser);
       const department =
-        (hodRole?.metadata as { department?: string })?.department ||
+        (isUserHOD && hasAdditionalRole(currentUser, 'hod') ? (currentUser.additional_roles?.find((r) => r.role === 'hod')?.metadata as { department?: string })?.department : undefined) ||
         teacherProfile.subjects[0] ||
         'General';
```

---

### File: `frontend/src/App.tsx`

```diff
--- a/frontend/src/App.tsx
+++ b/frontend/src/App.tsx
@@ -490,6 +490,7 @@ function App() {
                 <RouteMeta title="Teacher Classes">
                   <TeacherClassesPage />
                 </RouteMeta>
+                {/* DEPRECATED: Use ProtectedRoute with allowedPermissions instead */}
               </ProtectedRoute>
               <ProtectedRoute
                 allowedRoles={['teacher', 'admin', 'superadmin']}
+                allowedPermissions={['attendance:mark']}
               >
                 <RouteMeta title="Mark Attendance">
                   <TeacherAttendancePage />
                 </RouteMeta>
               </ProtectedRoute>
               <ProtectedRoute
                 allowedRoles={['teacher', 'admin', 'superadmin']}
+                allowedPermissions={['grades:enter']}
               >
                 <RouteMeta title="Enter Grades">
                   <TeacherGradeEntryPage />
                 </RouteMeta>
               </ProtectedRoute>
+              <ProtectedRoute
+                allowedRoles={['teacher', 'admin', 'superadmin']}
+                allowedPermissions={['students:view_own_class']}
+              >
+                <RouteMeta title="My Students">
+                  <TeacherStudentsPage />
+                </RouteMeta>
+              </ProtectedRoute>
```

---

### File: `frontend/src/pages/teacher/TeacherStudentsPage.tsx` (NEW FILE)

```diff
+import { useState, useCallback, useEffect } from 'react';
+import { useQuery } from '@tanstack/react-query';
+import RouteMeta from '../../components/layout/RouteMeta';
+import { DashboardSkeleton } from '../../components/ui/DashboardSkeleton';
+import { StatusBanner } from '../../components/ui/StatusBanner';
+import { DataTable, type DataTableColumn } from '../../components/tables/DataTable';
+import { Select } from '../../components/ui/Select';
+import { api, type TeacherStudent, type TeacherClassInfo } from '../../lib/api';
+import { extractPaginatedData } from '../../lib/api/pagination';
+import { Users } from 'lucide-react';
+
+export default function TeacherStudentsPage() {
+  const [selectedClassId, setSelectedClassId] = useState<string>('');
+
+  const { data: classes, isLoading: loadingClasses, error: classesError } = useQuery<TeacherClassInfo[]>({
+    queryKey: ['teacher-classes'],
+    queryFn: () => api.teachers.getMyClasses()
+  });
+
+  const { data: studentsData, isLoading: loadingStudents, error: studentsError } = useQuery({
+    queryKey: ['teacher-students', selectedClassId],
+    queryFn: () => api.teachers.getMyStudents({ classId: selectedClassId || undefined }),
+    enabled: !!classes && classes.length > 0
+  });
+
+  const students = studentsData ? extractPaginatedData(studentsData) : [];
+  const error = classesError || studentsError;
+
+  useEffect(() => {
+    if (classes && classes.length > 0 && !selectedClassId) {
+      setSelectedClassId(classes[0].id);
+    }
+  }, [classes, selectedClassId]);
+
+  const columns: DataTableColumn<TeacherStudent>[] = [
+    {
+      key: 'name',
+      header: 'Name',
+      render: (row) => `${row.first_name} ${row.last_name}`,
+      sortable: true
+    },
+    {
+      key: 'admission_number',
+      header: 'Admission Number',
+      render: (row) => row.admission_number || 'N/A',
+      sortable: true
+    },
+    {
+      key: 'class_id',
+      header: 'Class',
+      render: (row) => row.class_id || 'N/A',
+      sortable: true
+    }
+  ];
+
+  if (loadingClasses || loadingStudents) {
+    return (
+      <RouteMeta title="My Students">
+        <DashboardSkeleton />
+      </RouteMeta>
+    );
+  }
+
+  return (
+    <RouteMeta title="My Students">
+      <div className="space-y-6">
+        <div className="flex items-center justify-between">
+          <h1 className="text-2xl font-bold flex items-center gap-2">
+            <Users className="h-6 w-6" />
+            My Students
+          </h1>
+        </div>
+
+        {error && (
+          <StatusBanner variant="error" title="Error loading students">
+            {error instanceof Error ? error.message : 'Failed to load students'}
+          </StatusBanner>
+        )}
+
+        {classes && classes.length > 0 && (
+          <div className="flex items-center gap-4">
+            <label className="text-sm font-medium">Filter by Class:</label>
+            <Select
+              value={selectedClassId}
+              onValueChange={setSelectedClassId}
+              options={classes.map((c) => ({ value: c.id, label: `${c.name} (${c.studentCount} students)` }))}
+            />
+          </div>
+        )}
+
+        {students.length === 0 && !error && (
+          <StatusBanner variant="info" title="No students found">
+            {selectedClassId ? 'No students found in the selected class.' : 'You are not assigned to any classes yet.'}
+          </StatusBanner>
+        )}
+
+        {students.length > 0 && (
+          <DataTable columns={columns} data={students} />
+        )}
+      </div>
+    </RouteMeta>
+  );
+}
```

---

### File: `frontend/src/pages/TeacherAttendancePage.tsx`

```diff
--- a/frontend/src/pages/TeacherAttendancePage.tsx
+++ b/frontend/src/pages/TeacherAttendancePage.tsx
@@ -43,7 +43,7 @@ export function TeacherAttendancePage() {
   const loadClasses = useCallback(async () => {
     setLoadingClasses(true);
     setError(null);
     try {
-      const summaries = await api.teacher.listClasses();
+      const summaries = await api.teachers.getMyClasses();
       setClasses(summaries);
       if (summaries.length > 0) {
         setSelectedClassId((current) => current || summaries[0].id);
```

---

### File: `frontend/src/pages/TeacherGradeEntryPage.tsx`

```diff
--- a/frontend/src/pages/TeacherGradeEntryPage.tsx
+++ b/frontend/src/pages/TeacherGradeEntryPage.tsx
@@ -1,5 +1,6 @@
 import { useCallback, useEffect, useMemo, useState } from 'react';
 import { toast } from 'sonner';
+import { api } from '../lib/api';
 import Table from '../components/Table';
 import type { TableColumn } from '../components/Table';
 import { Button } from '../components/ui/Button';
@@ -7,7 +8,6 @@ import { Input } from '../components/ui/Input';
 import { useAuth } from '../context/AuthContext';
 import {
-  api,
   type GradeEntryInput,
   type GradeAggregate,
   type TeacherClassRosterEntry,
@@ -30,6 +30,7 @@ export function TeacherGradeEntryPage() {
   const [loading, setLoading] = useState<boolean>(true);
   const [error, setError] = useState<string | null>(null);
 
+  // DEPRECATED: Update to use api.teachers.getMyClasses() instead of api.teacher.listClasses()
   const loadClasses = useCallback(async () => {
     setLoading(true);
     setError(null);
     try {
-      const summaries = await api.teacher.listClasses();
+      const summaries = await api.teachers.getMyClasses();
       setClasses(summaries);
       if (summaries.length > 0) {
```

---

### File: `frontend/src/pages/teacher/TeacherDashboardPage.tsx`

```diff
--- a/frontend/src/pages/teacher/TeacherDashboardPage.tsx
+++ b/frontend/src/pages/teacher/TeacherDashboardPage.tsx
@@ -1,5 +1,6 @@
 import { useMemo } from 'react';
 import RouteMeta from '../../components/layout/RouteMeta';
+import { Link } from 'react-router-dom';
 import { DashboardSkeleton } from '../../components/ui/DashboardSkeleton';
 import { StatusBanner } from '../../components/ui/StatusBanner';
 import { DataTable, type DataTableColumn } from '../../components/tables/DataTable';
@@ -9,6 +10,7 @@ import { StatCard } from '../../components/charts/StatCard';
 import { useTeacherDashboard } from '../../hooks/queries/useDashboardQueries';
 import { Users, BookOpen, GraduationCap, AlertCircle } from 'lucide-react';
 import type { TeacherAssignmentSummary } from '../../lib/api';
+import { Button } from '../../components/ui/Button';
 
 export default function TeacherDashboardPage() {
   const { overview, loading, error } = useTeacherDashboard();
@@ -45,6 +47,20 @@ export default function TeacherDashboardPage() {
       }
     ];
   }, [overview]);
+
+  const quickActions = useMemo(() => {
+    return [
+      { label: 'View Students', path: '/dashboard/teacher/students', icon: Users },
+      { label: 'Mark Attendance', path: '/dashboard/teacher/attendance', icon: BookOpen },
+      { label: 'Enter Grades', path: '/dashboard/teacher/grades', icon: GraduationCap }
+    ];
+  }, []);
+
+  const quickActionButtons = useMemo(() => {
+    return quickActions.map((action) => (
+      <Link key={action.path} to={action.path}>
+        <Button variant="outline">{action.label}</Button>
+      </Link>
+    ));
+  }, [quickActions]);
 
   // Class distribution chart
   const classDistribution: BarChartData[] = useMemo(() => {
```

---

### File: `frontend/src/pages/teacher/TeacherClassesPage.tsx`

```diff
--- a/frontend/src/pages/teacher/TeacherClassesPage.tsx
+++ b/frontend/src/pages/teacher/TeacherClassesPage.tsx
@@ -1,5 +1,6 @@
 import { useQuery } from '@tanstack/react-query';
 import RouteMeta from '../../components/layout/RouteMeta';
+import { Link } from 'react-router-dom';
 import { DashboardSkeleton } from '../../components/ui/DashboardSkeleton';
 import { StatusBanner } from '../../components/ui/StatusBanner';
 import { Card } from '../../components/ui/Card';
@@ -7,6 +8,7 @@ import { api, type TeacherClassInfo } from '../../lib/api';
 import { BookOpen, Users } from 'lucide-react';
+import { Button } from '../../components/ui/Button';
 
 export default function TeacherClassesPage() {
-  const { data: classes, isLoading, error } = useQuery({
+  const { data: classes, isLoading, error } = useQuery<TeacherClassInfo[]>({
     queryKey: ['teacher-classes'],
-    queryFn: () => api.teacher.listClasses()
+    queryFn: () => api.teachers.getMyClasses()
   });
 
   if (isLoading) {
@@ -30,6 +32,18 @@ export default function TeacherClassesPage() {
             <p className="text-sm text-muted-foreground">{classInfo.studentCount} students</p>
           </Card>
         ))}
+        {classes.map((classInfo) => (
+          <Card key={classInfo.id} className="p-4">
+            <div className="flex items-center justify-between">
+              <div>
+                <h3 className="font-semibold">{classInfo.name}</h3>
+                <p className="text-sm text-muted-foreground">{classInfo.studentCount} students</p>
+              </div>
+              <div className="flex gap-2">
+                <Link to={`/dashboard/teacher/students?classId=${classInfo.id}`}>
+                  <Button variant="outline" size="sm">View Students</Button>
+                </Link>
+              </div>
+            </div>
+          </Card>
+        ))}
       </div>
     </RouteMeta>
   );
```

---

### File: `frontend/src/components/shared/PermissionDenied.tsx` (NEW FILE)

```diff
+import { Link } from 'react-router-dom';
+import { AlertCircle } from 'lucide-react';
+import { Card } from '../ui/Card';
+import { Button } from '../ui/Button';
+
+interface PermissionDeniedProps {
+  permission?: string;
+  message?: string;
+}
+
+export function PermissionDenied({ permission, message }: PermissionDeniedProps) {
+  return (
+    <Card className="p-6">
+      <div className="flex flex-col items-center justify-center text-center space-y-4">
+        <AlertCircle className="h-12 w-12 text-red-500" />
+        <div>
+          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
+          {message ? (
+            <p className="text-muted-foreground">{message}</p>
+          ) : permission ? (
+            <p className="text-muted-foreground">
+              You do not have the required permission: <strong>{permission}</strong>
+            </p>
+          ) : (
+            <p className="text-muted-foreground">You do not have permission to access this page.</p>
+          )}
+        </div>
+        <Link to="/dashboard">
+          <Button variant="outline">Return to Dashboard</Button>
+        </Link>
+      </div>
+    </Card>
+  );
+}
```

---

### File: `frontend/src/components/shared/index.ts`

```diff
--- a/frontend/src/components/shared/index.ts
+++ b/frontend/src/components/shared/index.ts
 export * from './DeviceInfoBadge';
 export * from './MetadataViewer';
 export * from './TimelineStepper';
+export * from './PermissionDenied';
```

---

### File: `frontend/src/App.tsx` (Import TeacherStudentsPage)

```diff
--- a/frontend/src/App.tsx
+++ b/frontend/src/App.tsx
 const TeacherProfilePage = lazy(() => import('./pages/teacher/TeacherProfilePage'));
+const TeacherStudentsPage = lazy(() => import('./pages/teacher/TeacherStudentsPage'));
 const SuperuserDashboardPage = lazy(() => import('./pages/superuser/dashboard'));
```

---

### File: `frontend/src/config/permissions.ts`

```diff
--- a/frontend/src/config/permissions.ts
+++ b/frontend/src/config/permissions.ts
@@ -64,6 +64,8 @@ export const rolePermissions: Record<Role, Permission[]> = {
     'performance:charts',
     'reports:view',
     'performance:charts',
     'messages:send',
+    'users:manage',
+    'teachers:manage'
   ],
   admin: [
```

---

