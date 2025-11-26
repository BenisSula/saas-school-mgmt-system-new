import { useQuery, queryOptions } from '@tanstack/react-query';
import { useTenant } from '../../useTenant';
import { api } from '../../../lib/api';
import { dashboardKeys } from './queryKeys';
import { dashboardQueryConfig } from './queryConfig';
import type { UserSession } from '../../../lib/api';

export interface ActiveSession {
  id: string;
  userId: string;
  ipAddress: string | null;
  loginAt: string;
  expiresAt: string;
  deviceInfo: Record<string, unknown>;
  updatedAt: string;
  tenantId: string | null;
  userAgent: string | null;
}

export interface ActiveSessionsResponse {
  sessions: ActiveSession[];
  total: number;
}

/**
 * Query options for active sessions
 */
export function activeSessionsQueryOptions(tenantId: string | null) {
  return queryOptions({
    queryKey: dashboardKeys.activeSessions(tenantId || ''),
    queryFn: async (): Promise<ActiveSessionsResponse> => {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      // Use the real active sessions endpoint
      // IMPORTANT: This MUST use the real active sessions, NOT the outdated estimate
      const result = await api.superuser.getAllActiveSessions({
        tenantId,
        limit: 100, // Adjust limit as needed
      });

      // Transform to match the required interface
      const sessions: ActiveSession[] = result.sessions
        .filter((session) => session.isActive)
        .map((session: UserSession) => ({
          id: session.id,
          userId: session.userId,
          ipAddress: session.ipAddress,
          loginAt: session.loginAt,
          expiresAt: session.expiresAt,
          deviceInfo: session.deviceInfo || {},
          updatedAt: session.updatedAt,
          tenantId: session.tenantId,
          userAgent: session.userAgent,
        }));

      return {
        sessions,
        total: result.total,
      };
    },
    enabled: !!tenantId,
    ...dashboardQueryConfig,
  });
}

/**
 * Hook to fetch active sessions
 * IMPORTANT: This MUST use the real active sessions, NOT the outdated estimate
 * @returns Active sessions data with loading and error states
 */
export function useActiveSessionsQuery() {
  const tenantId = useTenant();
  const queryOptionsResult = activeSessionsQueryOptions(tenantId);

  return useQuery({
    queryKey: queryOptionsResult.queryKey,
    queryFn: queryOptionsResult.queryFn,
    enabled: queryOptionsResult.enabled,
    staleTime: 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
    select: (data: ActiveSessionsResponse): ActiveSessionsResponse => ({
      sessions: data.sessions,
      total: data.total,
    }),
  });
}
