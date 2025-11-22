import { keepPreviousData } from '@tanstack/react-query';
import type { QueryOptions } from '@tanstack/react-query';

/**
 * Shared query configuration for dashboard queries
 * Applies DRY principle - all dashboard queries use the same base configuration
 */
export const dashboardQueryConfig = {
  retry: 1,
  staleTime: 60_000, // 60 seconds
  refetchOnWindowFocus: false,
  placeholderData: keepPreviousData
} as const satisfies Partial<QueryOptions<unknown, Error, unknown, unknown>>;

/**
 * Creates base query options with shared dashboard configuration
 * @param tenantId - Tenant ID for multi-tenant awareness
 * @param queryKey - Query key array
 * @param queryFn - Query function
 */
export function createDashboardQueryOptions<TData>(
  tenantId: string | null,
  queryKey: readonly unknown[],
  queryFn: () => Promise<TData>
) {
  return {
    queryKey,
    queryFn,
    enabled: !!tenantId,
    ...dashboardQueryConfig
  };
}
