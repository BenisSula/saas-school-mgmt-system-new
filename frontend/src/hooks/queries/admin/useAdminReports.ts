/**
 * React Query hooks for Admin Reports
 */

import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { unwrapApiResponse } from '../../../lib/apiResponseUtils';

export interface ActivityReportFilters {
  startDate?: string;
  endDate?: string;
  userId?: string;
  action?: string;
  limit?: number;
  offset?: number;
}

export interface LoginReportFilters {
  startDate?: string;
  endDate?: string;
  userId?: string;
  limit?: number;
  offset?: number;
}

export interface PerformanceReportFilters {
  classId?: string;
  subjectId?: string;
  academicYear?: string;
}

export function useActivityReport(filters?: ActivityReportFilters) {
  return useQuery({
    queryKey: ['admin', 'reports', 'activity', filters],
    queryFn: async () => {
      const response = await api.admin.getActivityReport(filters);
      return unwrapApiResponse(response);
    },
    staleTime: 30000, // 30 seconds
  });
}

export function useLoginReport(filters?: LoginReportFilters) {
  return useQuery({
    queryKey: ['admin', 'reports', 'logins', filters],
    queryFn: async () => {
      const response = await api.admin.getLoginReport(filters);
      return unwrapApiResponse(response);
    },
    staleTime: 30000,
  });
}

export function usePerformanceReport(filters?: PerformanceReportFilters) {
  return useQuery({
    queryKey: ['admin', 'reports', 'performance', filters],
    queryFn: async () => {
      const response = await api.admin.getPerformanceReport(filters);
      return unwrapApiResponse(response);
    },
    staleTime: 60000, // 1 minute
  });
}
