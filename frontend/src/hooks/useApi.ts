/**
 * Shared API hook for consistent data fetching patterns
 */

import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export interface UseApiOptions<TData, TError = Error> {
  enabled?: boolean;
  staleTime?: number;
  onSuccess?: (data: TData) => void;
  onError?: (error: TError) => void;
  successMessage?: string;
  errorMessage?: string;
}

/**
 * Generic API query hook with standardized error handling
 */
export function useApi<TData, TError = Error>(
  queryKey: readonly unknown[],
  queryFn: () => Promise<TData>,
  options?: UseApiOptions<TData, TError>
) {
  const queryResult = useQuery<TData, TError>({
    queryKey,
    queryFn,
    enabled: options?.enabled !== false,
    staleTime: options?.staleTime,
  });

  // Handle errors using useEffect since onError is deprecated
  React.useEffect(() => {
    if (queryResult.error && options?.onError) {
      const errorObj =
        queryResult.error instanceof Error
          ? queryResult.error
          : new Error(String(queryResult.error));
      const message = options?.errorMessage || errorObj.message || 'Failed to fetch data';
      toast.error(message);
      options.onError(queryResult.error);
    }
  }, [queryResult.error, options]);

  // Handle success
  React.useEffect(() => {
    if (queryResult.data && options?.onSuccess) {
      options.onSuccess(queryResult.data);
    }
  }, [queryResult.data, options]);

  return queryResult;
}

/**
 * Generic API mutation hook with automatic query invalidation
 */
export function useApiMutation<TData, TVariables, TError = Error>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  invalidateQueries: readonly unknown[][],
  options?: UseApiOptions<TData, TError>
) {
  const queryClient = useQueryClient();

  return useMutation<TData, TError, TVariables>({
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
    onError: (error: TError) => {
      const message = options?.errorMessage || (error as Error).message || 'An error occurred';
      toast.error(message);
      options?.onError?.(error);
    },
  });
}
