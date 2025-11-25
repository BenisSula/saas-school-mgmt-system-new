import { useQuery, queryOptions } from '@tanstack/react-query';
import { useTenant } from '../../useTenant';
import { api } from '../../../lib/api';
import { dashboardKeys } from './queryKeys';
import { dashboardQueryConfig } from './queryConfig';
import type { AuditLogEntry } from '../../../lib/api';

export interface RecentActivity {
  id: string;
  action: string;
  resourceType: string | undefined;
  resourceId: string | null | undefined;
  userAgent: string | undefined;
  tags: string[];
  requestId: string | undefined;
  details: Record<string, unknown> | null | undefined;
  createdAt: string | Date | undefined;
}

export interface RecentActivityResponse {
  activities: RecentActivity[];
}

/**
 * Query options for recent activity
 */
export function recentActivityQueryOptions(tenantId: string | null, limit: number = 20) {
  return queryOptions({
    queryKey: dashboardKeys.recentActivity(tenantId || ''),
    queryFn: async (): Promise<RecentActivityResponse> => {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      // Fetch from /admin/audit-logs/recent or use getAuditLogs with limit
      // Ensure tags, requestId, and details are returned and typed
      const logs = await api.getAuditLogs(undefined, {
        limit,
        // Add filters for recent activity (last 24 hours)
        from: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      });

      // Transform to match the required interface with ALL fields identified as missing
      const activities: RecentActivity[] = logs.map((log: AuditLogEntry) => ({
        id: log.id,
        action: log.action,
        resourceType: log.resourceType || log.entityType,
        resourceId: log.resourceId || log.entityId,
        userAgent: log.userAgent || null,
        tags: log.tags || [],
        requestId: log.requestId || undefined,
        details: log.details || null,
        createdAt: log.createdAt || log.timestamp,
      }));

      return {
        activities,
      };
    },
    enabled: !!tenantId,
    ...dashboardQueryConfig,
  });
}

/**
 * Hook to fetch recent activity logs
 * Returned fields must include ALL fields identified as missing in the audit report:
 * - action
 * - resourceType
 * - resourceId
 * - userAgent
 * - tags[]
 * - requestId
 * - details (JSONB)
 * - createdAt
 * @param limit Number of recent activities to fetch (default: 20)
 * @returns Recent activity data with loading and error states
 */
export function useRecentActivityQuery(limit: number = 20) {
  const tenantId = useTenant();
  const queryOptions = recentActivityQueryOptions(tenantId, limit);

  return useQuery({
    ...queryOptions,
    select: (data): RecentActivityResponse => ({
      activities: data.activities,
    }),
  });
}
