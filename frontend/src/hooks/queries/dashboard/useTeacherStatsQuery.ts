import { useQuery, queryOptions } from '@tanstack/react-query';
import { useTenant } from '../../useTenant';
import { api } from '../../../lib/api';
import { dashboardKeys } from './queryKeys';
import { dashboardQueryConfig } from './queryConfig';

export interface TeacherStatsResponse {
  totalTeachers: number;
  activeTeachers: number;
  teachersByDepartment: Array<{
    department: string;
    count: number;
  }>;
}

export interface TeacherStats {
  totalTeachers: number;
  activeTeachers: number;
  teachersByDepartment: Array<{
    department: string;
    count: number;
  }>;
}

/**
 * Query options for teacher stats
 */
export function teacherStatsQueryOptions(tenantId: string | null) {
  return queryOptions({
    queryKey: dashboardKeys.teacherStats(tenantId || ''),
    queryFn: async (): Promise<TeacherStats> => {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      // TODO: Replace with dedicated endpoint /admin/teachers/stats when available
      // For now, fetch all teachers and compute stats client-side
      const teachers = await api.listTeachers();

      const totalTeachers = teachers.length;
      const activeTeachers = teachers.length; // All teachers are considered active (no status field in TeacherProfile)

      // Group by department (assuming teachers have a department field)
      const departmentMap = new Map<string, number>();
      teachers.forEach((teacher) => {
        const dept = (teacher as unknown as { department?: string }).department || 'Unassigned';
        departmentMap.set(dept, (departmentMap.get(dept) || 0) + 1);
      });

      const teachersByDepartment = Array.from(departmentMap.entries()).map(
        ([department, count]) => ({
          department,
          count,
        })
      );

      return {
        totalTeachers,
        activeTeachers,
        teachersByDepartment,
      };
    },
    enabled: !!tenantId,
    ...dashboardQueryConfig,
  });
}

/**
 * Hook to fetch teacher statistics
 * @returns Teacher stats data with loading and error states
 */
export function useTeacherStatsQuery() {
  const tenantId = useTenant();
  const queryOptions = teacherStatsQueryOptions(tenantId);

  return useQuery({
    ...queryOptions,
    select: (data): TeacherStats => ({
      totalTeachers: data.totalTeachers,
      activeTeachers: data.activeTeachers,
      teachersByDepartment: data.teachersByDepartment,
    }),
  });
}
