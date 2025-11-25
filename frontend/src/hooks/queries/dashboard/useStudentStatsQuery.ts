import { useQuery, queryOptions } from '@tanstack/react-query';
import { useTenant } from '../../useTenant';
import { api } from '../../../lib/api';
import { dashboardKeys } from './queryKeys';
import { dashboardQueryConfig } from './queryConfig';

export interface StudentStatsResponse {
  totalStudents: number;
  activeStudents: number;
  studentsByClass: Array<{
    classId: string;
    className: string;
    count: number;
  }>;
  maleCount: number;
  femaleCount: number;
}

export interface StudentStats {
  totalStudents: number;
  activeStudents: number;
  studentsByClass: Array<{
    classId: string;
    className: string;
    count: number;
  }>;
  maleCount: number;
  femaleCount: number;
}

/**
 * Query options for student stats
 */
export function studentStatsQueryOptions(tenantId: string | null) {
  return queryOptions({
    queryKey: dashboardKeys.studentStats(tenantId || ''),
    queryFn: async (): Promise<StudentStats> => {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      // TODO: Replace with dedicated endpoint /admin/students/stats when available
      // For now, fetch all students and compute stats client-side
      const [students, classes] = await Promise.all([api.listStudents(), api.listClasses()]);

      const classMap = new Map(classes.map((c) => [c.id, c.name]));

      const totalStudents = students.length;
      const activeStudents = students.filter(
        (s) => s.enrollment_status === 'active' || !s.enrollment_status
      ).length;

      // Count by class
      const classCountMap = new Map<string, number>();
      students.forEach((student) => {
        const classId = student.class_id || 'unassigned';
        classCountMap.set(classId, (classCountMap.get(classId) || 0) + 1);
      });

      const studentsByClass = Array.from(classCountMap.entries()).map(([classId, count]) => ({
        classId,
        className: classMap.get(classId) || 'Unassigned',
        count,
      }));

      // Count by gender
      let maleCount = 0;
      let femaleCount = 0;
      students.forEach((student) => {
        const gender = (student as unknown as { gender?: string }).gender?.toLowerCase() || '';
        if (gender === 'male' || gender === 'm') {
          maleCount++;
        } else if (gender === 'female' || gender === 'f') {
          femaleCount++;
        }
      });

      return {
        totalStudents,
        activeStudents,
        studentsByClass,
        maleCount,
        femaleCount,
      };
    },
    enabled: !!tenantId,
    ...dashboardQueryConfig,
  });
}

/**
 * Hook to fetch student statistics
 * @returns Student stats data with loading and error states
 */
export function useStudentStatsQuery() {
  const tenantId = useTenant();
  const queryOptions = studentStatsQueryOptions(tenantId);

  return useQuery({
    ...queryOptions,
    select: (data): StudentStats => ({
      totalStudents: data.totalStudents,
      activeStudents: data.activeStudents,
      studentsByClass: data.studentsByClass,
      maleCount: data.maleCount,
      femaleCount: data.femaleCount,
    }),
  });
}
