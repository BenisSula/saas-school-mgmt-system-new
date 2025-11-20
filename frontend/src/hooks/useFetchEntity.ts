/**
 * Shared hook for fetching a single entity by ID
 */

import { useApi } from './useApi';
import type { UseApiOptions } from './useApi';

export interface UseFetchEntityOptions<TData, TError = Error> extends UseApiOptions<TData, TError> {
  enabled?: boolean;
}

/**
 * Generic hook for fetching a single entity by ID
 */
export function useFetchEntity<TData, TError = Error>(
  entityType: string,
  entityId: string | null | undefined,
  fetchFn: (id: string) => Promise<TData>,
  options?: UseFetchEntityOptions<TData, TError>
) {
  return useApi<TData, TError>(
    [entityType, entityId],
    () => {
      if (!entityId) {
        throw new Error(`${entityType} ID is required`);
      }
      return fetchFn(entityId);
    },
    {
      enabled: options?.enabled !== false && Boolean(entityId),
      ...options
    }
  );
}

/**
 * Hook for fetching multiple entities with pagination
 */
export function useFetchEntities<TData, TError = Error>(
  entityType: string,
  fetchFn: (params?: { offset?: number; limit?: number }) => Promise<{ data: TData[]; total: number }>,
  pagination?: { offset: number; limit: number },
  options?: UseApiOptions<{ data: TData[]; total: number }, TError>
) {
  return useApi<{ data: TData[]; total: number }, TError>(
    [entityType, 'list', pagination],
    () => fetchFn(pagination),
    options
  );
}

