/**
 * React Query hook for HOD Teachers
 * Fetches list of teachers under HOD's department
 */

import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { useTenant } from '../../useTenant';

export interface HODTeacher {
  id: string;
  name: string;
  email: string | null;
  subjects: string[];
  classes: string[];
  lastActive: string | null;
  performanceScore?: number;
}

export interface UseHodTeachersFilters {
  search?: string;
  subject?: string;
}

/**
 * Hook to fetch teachers under HOD's department
 */
export function useHodTeachers(filters?: UseHodTeachersFilters) {
  const tenantId = useTenant();

  return useQuery({
    queryKey: ['hod', 'teachers', tenantId, filters],
    queryFn: async () => {
      const response = await api.hod.listTeachers(filters);
      return response as HODTeacher[];
    },
    enabled: !!tenantId,
    staleTime: 30_000, // 30 seconds
    retry: 1,
    refetchOnWindowFocus: false,
  });
}
