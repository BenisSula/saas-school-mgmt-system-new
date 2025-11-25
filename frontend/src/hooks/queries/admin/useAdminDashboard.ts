/**
 * React Query hooks for Admin Dashboard
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { toast } from 'sonner';
import { unwrapApiResponse } from '../../../lib/apiResponseUtils';

export function useAdminDashboard() {
  return useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: async () => {
      const response = await api.admin.getDashboard();
      return unwrapApiResponse(response);
    },
    staleTime: 60000, // 1 minute
  });
}

export function useRefreshDashboard() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
    toast.success('Dashboard refreshed');
  };
}
