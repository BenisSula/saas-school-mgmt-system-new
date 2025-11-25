import { useQuery, queryKeys } from '../useQuery';
import { api } from '../../lib/api';
import { unwrapApiResponse } from '../../lib/apiResponseUtils';

// Admin Overview - Uses aggregated backend endpoint
export function useAdminOverview() {
  return useQuery(queryKeys.admin.overview(), async () => {
    try {
      // Use the aggregated overview endpoint
      const overview = await api.admin.getOverview();
      const data = unwrapApiResponse(overview);
      
      if (!data) {
        console.warn('[useAdminOverview] No data returned from overview endpoint');
        return {
          school: null,
          users: [],
          teachers: [],
          students: [],
          classes: []
        };
      }
      
      // Transform the aggregated data to match the expected format
      // Note: We use recent items for display, but totals contain accurate counts
      return {
        school: data.school,
        users: data.recentUsers || [],
        teachers: data.recentTeachers || [],
        students: data.recentStudents || [], // Recent students for display
        classes: data.classes || [],
        // Include additional overview data - totals contain accurate counts from database
        totals: data.totals, // This contains the actual student count from database
        roleDistribution: data.roleDistribution,
        statusDistribution: data.statusDistribution,
        activeSessionsCount: data.activeSessionsCount,
        failedLoginAttemptsCount: data.failedLoginAttemptsCount
      };
    } catch (error) {
      console.error('[useAdminOverview] Error fetching overview:', error);
      // Fallback to individual API calls if overview endpoint fails
      const results = await Promise.allSettled([
        api.getSchool().catch(() => null),
        api.listUsers().catch(() => []),
        api.listTeachers().catch(() => []),
        api.listStudents().catch(() => []),
        api.listClasses().catch(() => [])
      ]);
      
      return {
        school: results[0].status === 'fulfilled' ? results[0].value : null,
        users: results[1].status === 'fulfilled' ? results[1].value : [],
        teachers: results[2].status === 'fulfilled' ? results[2].value : [],
        students: results[3].status === 'fulfilled' ? results[3].value : [],
        classes: results[4].status === 'fulfilled' ? results[4].value : []
      };
    }
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
