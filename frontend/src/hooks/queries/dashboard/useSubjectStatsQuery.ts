import { useQuery, queryOptions } from '@tanstack/react-query';
import { useTenant } from '../../useTenant';
import { api } from '../../../lib/api';
import { dashboardKeys } from './queryKeys';
import { dashboardQueryConfig } from './queryConfig';

export interface SubjectStatsResponse {
  totalSubjects: number;
  assignedSubjects: number;
  unassignedSubjects: number;
}

export interface SubjectStats {
  totalSubjects: number;
  assignedSubjects: number;
  unassignedSubjects: number;
}

/**
 * Query options for subject stats
 */
export function subjectStatsQueryOptions(tenantId: string | null) {
  return queryOptions({
    queryKey: dashboardKeys.subjectStats(tenantId || ''),
    queryFn: async (): Promise<SubjectStats> => {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      // TODO: Replace with dedicated endpoint /admin/subjects/stats when available
      // For now, fetch all subjects and teachers to compute stats client-side
      const [subjects, teachers] = await Promise.all([
        api.admin.listSubjects(),
        api.listTeachers(),
      ]);

      const totalSubjects = subjects.length;

      // Count assigned subjects (subjects that appear in teacher assignments)
      const assignedSubjectIds = new Set(teachers.flatMap((t) => t.subjects || []).filter(Boolean));
      const assignedSubjects = assignedSubjectIds.size;
      const unassignedSubjects = totalSubjects - assignedSubjects;

      return {
        totalSubjects,
        assignedSubjects,
        unassignedSubjects,
      };
    },
    enabled: !!tenantId,
    ...dashboardQueryConfig,
  });
}

/**
 * Hook to fetch subject statistics
 * @returns Subject stats data with loading and error states
 */
export function useSubjectStatsQuery() {
  const tenantId = useTenant();
  const queryOptions = subjectStatsQueryOptions(tenantId);

  return useQuery({
    ...queryOptions,
    select: (data): SubjectStats => ({
      totalSubjects: data.totalSubjects,
      assignedSubjects: data.assignedSubjects,
      unassignedSubjects: data.unassignedSubjects,
    }),
  });
}
