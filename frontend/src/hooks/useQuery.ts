import { useQuery as useReactQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// Query keys factory
export const queryKeys = {
  // Admin queries
  admin: {
    overview: () => ['admin', 'overview'] as const,
    classes: () => ['admin', 'classes'] as const,
    subjects: () => ['admin', 'subjects'] as const,
    teachers: () => ['admin', 'teachers'] as const,
    students: () => ['admin', 'students'] as const,
    hods: () => ['admin', 'hods'] as const,
    exams: () => ['admin', 'exams'] as const,
    gradeScales: () => ['admin', 'grade-scales'] as const,
    attendance: (filters?: { from?: string; to?: string; classId?: string }) =>
      ['admin', 'attendance', filters] as const,
    reports: (type?: string) => ['admin', 'reports', type] as const,
    departmentAnalytics: (departmentId?: string) =>
      ['admin', 'department-analytics', departmentId] as const
  },
  // Superuser queries
  superuser: {
    overview: () => ['superuser', 'overview'] as const,
    schools: () => ['superuser', 'schools'] as const,
    users: () => ['superuser', 'users'] as const,
    tenantAnalytics: (tenantId?: string) => ['superuser', 'tenant-analytics', tenantId] as const,
    subscriptions: () => ['superuser', 'subscriptions'] as const,
    usage: (tenantId?: string) => ['superuser', 'usage', tenantId] as const
  }
};

// Generic query hook wrapper
export function useQuery<T>(
  queryKey: readonly unknown[],
  queryFn: () => Promise<T>,
  options?: { enabled?: boolean; staleTime?: number }
) {
  return useReactQuery({
    queryKey,
    queryFn: async () => {
      try {
        return await queryFn();
      } catch (error) {
        // Suppress console errors for expected failures
        const apiError = error as Error & { suppressLog?: boolean };
        if (apiError?.suppressLog) {
          // Re-throw but mark it so React Query doesn't log it
          const silentError = new Error(apiError.message);
          (silentError as Error & { suppressLog?: boolean }).suppressLog = true;
          throw silentError;
        }
        // Log unexpected errors in dev mode
        if (import.meta.env.DEV) {
          console.error('[Query Error]', queryKey, error);
        }
        throw error;
      }
    },
    enabled: options?.enabled !== false,
    staleTime: options?.staleTime,
    // Don't retry expected errors
    retry: (failureCount, error) => {
      const apiError = error as Error & { suppressLog?: boolean };
      if (apiError?.suppressLog) {
        return false;
      }
      return failureCount < 1;
    }
  });
}

// Generic mutation hook wrapper
export function useMutationWithInvalidation<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  invalidateQueries: readonly unknown[][],
  options?: {
    onSuccess?: (data: TData) => void;
    onError?: (error: Error) => void;
    successMessage?: string;
  }
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: (data) => {
      // Invalidate related queries
      invalidateQueries.forEach((queryKey) => {
        queryClient.invalidateQueries({ queryKey });
      });
      if (options?.successMessage) {
        toast.success(options.successMessage);
      }
      options?.onSuccess?.(data);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'An error occurred');
      options?.onError?.(error);
    }
  });
}
