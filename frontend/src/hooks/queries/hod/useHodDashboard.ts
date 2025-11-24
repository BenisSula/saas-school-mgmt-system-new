/**
 * React Query hook for HOD Dashboard
 * Fetches HOD overview dashboard data
 */

import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { useTenant } from '../../useTenant';

export interface HODDashboardData {
  department: {
    id: string;
    name: string;
  };
  teachers: {
    total: number;
    active: number;
    bySubject: Array<{ subject: string; count: number }>;
  };
  classes: {
    total: number;
    byLevel: Array<{ level: string; count: number }>;
  };
  performance: {
    avgScore: number;
    totalExams: number;
    recentActivity: number;
  };
}

/**
 * Hook to fetch HOD dashboard overview
 */
export function useHodDashboard() {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['hod', 'dashboard', tenantId],
    queryFn: async () => {
      const response = await api.hod.getDashboard();
      return response as HODDashboardData;
    },
    enabled: !!tenantId,
    staleTime: 60_000, // 1 minute
    retry: 1,
    refetchOnWindowFocus: false,
  });
}
