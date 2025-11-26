/**
 * React Query hook for HOD Department Report
 * Fetches department-level analytics and reports
 */

import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { useTenant } from '../../useTenant';

export interface HODDepartmentReport {
  department: {
    id: string;
    name: string;
  };
  summary: {
    teachers: number;
    classes: number;
    students: number;
  };
  performance: {
    avgScore: number;
    topPerformingClass: string | null;
    improvementTrend: number;
  };
  activity: {
    last7Days: number;
    last30Days: number;
  };
}

export interface UseHodDepartmentReportFilters {
  term?: string;
  classId?: string;
  subjectId?: string;
}

/**
 * Hook to fetch department report
 */
export function useHodDepartmentReport(filters?: UseHodDepartmentReportFilters) {
  const tenantId = useTenant();

  return useQuery({
    queryKey: ['hod', 'department-report', tenantId, filters],
    queryFn: async () => {
      const response = await api.hod.getDepartmentReport(filters);
      return response as HODDepartmentReport;
    },
    enabled: !!tenantId,
    staleTime: 60_000, // 1 minute
    retry: 1,
    refetchOnWindowFocus: false,
  });
}
