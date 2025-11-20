import { useQuery, queryKeys } from '../useQuery';
import { api } from '../../lib/api';

// Admin Overview
export function useAdminOverview() {
  return useQuery(queryKeys.admin.overview(), async () => {
    const [school, users, teachers, students, classes] = await Promise.all([
      api.getSchool().catch(() => null), // School info may not exist
      api.listUsers(),
      api.listTeachers(),
      api.listStudents(),
      api.listClasses()
    ]);
    return { school, users, teachers, students, classes };
  });
}

// Classes
export function useClasses() {
  return useQuery(queryKeys.admin.classes(), () => api.listClasses());
}

// Subjects
export function useSubjects() {
  return useQuery(queryKeys.admin.subjects(), () => api.admin.listSubjects());
}

// Teachers
export function useTeachers() {
  return useQuery(queryKeys.admin.teachers(), () => api.listTeachers());
}

// Students
export function useStudents() {
  return useQuery(queryKeys.admin.students(), () => api.listStudents());
}

// Exams
export function useExams() {
  return useQuery(queryKeys.admin.exams(), () => api.listExams());
}

// Attendance
export function useAttendance(filters?: { from?: string; to?: string; classId?: string }) {
  return useQuery(
    queryKeys.admin.attendance(filters),
    () => api.getAttendanceAggregate(filters),
    { enabled: true } // Always enabled, filters are optional
  );
}

// Department Analytics
export function useDepartmentAnalytics(departmentId?: string) {
  return useQuery(
    queryKeys.admin.departmentAnalytics(departmentId),
    () => api.getDepartmentAnalytics(departmentId),
    { enabled: true }
  );
}

// User Growth Trends
export function useUserGrowthTrends(days: number = 30) {
  return useQuery(
    ['admin', 'user-growth', days],
    () => api.getUserGrowthTrends(days),
    { enabled: true }
  );
}

// Teachers Per Department
export function useTeachersPerDepartment() {
  return useQuery(
    ['admin', 'teachers-per-department'],
    () => api.getTeachersPerDepartment(),
    { enabled: true }
  );
}

// Students Per Class
export function useStudentsPerClass() {
  return useQuery(
    ['admin', 'students-per-class'],
    () => api.getStudentsPerClass(),
    { enabled: true }
  );
}
