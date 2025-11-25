import { useQuery, queryOptions } from '@tanstack/react-query';
import { useTenant } from '../../useTenant';
import { api } from '../../../lib/api';
import { dashboardKeys } from './queryKeys';
import { dashboardQueryConfig } from './queryConfig';

export interface ClassStatsResponse {
  totalClasses: number;
  activeClasses: number;
  classesByLevel: Array<{
    level: string;
    count: number;
  }>;
}

export interface ClassStats {
  totalClasses: number;
  activeClasses: number;
  classesByLevel: Array<{
    level: string;
    count: number;
  }>;
}

/**
 * Query options for class stats
 */
export function classStatsQueryOptions(tenantId: string | null) {
  return queryOptions({
    queryKey: dashboardKeys.classStats(tenantId || ''),
    queryFn: async (): Promise<ClassStats> => {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      // TODO: Replace with dedicated endpoint /admin/classes/stats when available
      // For now, fetch all classes and compute stats client-side
      const classes = await api.listClasses();

      const totalClasses = classes.length;
      const activeClasses = classes.length; // Assuming all classes are active if they exist

      // Group by level (assuming classes have a level field)
      const levelMap = new Map<string, number>();
      classes.forEach((cls) => {
        const level = (cls as unknown as { level?: string }).level || 'Unassigned';
        levelMap.set(level, (levelMap.get(level) || 0) + 1);
      });

      const classesByLevel = Array.from(levelMap.entries()).map(([level, count]) => ({
        level,
        count
      }));

      return {
        totalClasses,
        activeClasses,
        classesByLevel
      };
    },
    enabled: !!tenantId,
    ...dashboardQueryConfig
  });
}

/**
 * Hook to fetch class statistics
 * @returns Class stats data with loading and error states
 */
export function useClassStatsQuery() {
  const tenantId = useTenant();
  const queryOptions = classStatsQueryOptions(tenantId);

  return useQuery({
    ...queryOptions,
    select: (data): ClassStats => ({
      totalClasses: data.totalClasses,
      activeClasses: data.activeClasses,
      classesByLevel: data.classesByLevel
    })
  });
}

