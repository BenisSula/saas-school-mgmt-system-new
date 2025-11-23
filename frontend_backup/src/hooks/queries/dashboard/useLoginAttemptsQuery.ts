import { useQuery, queryOptions } from '@tanstack/react-query';
import { useTenant } from '../../useTenant';
import { api } from '../../../lib/api';
import { dashboardKeys } from './queryKeys';
import { dashboardQueryConfig } from './queryConfig';
import type { LoginAttemptRecord } from '../../../lib/api';

export interface LoginAttempt {
  email: string;
  userAgent: string | null;
  ipAddress: string | null;
  success: boolean;
  failureReason: string | null;
  attemptedAt: string;
}

export interface LoginAttemptsResponse {
  attempts: LoginAttempt[];
  total: number;
}

/**
 * Query options for login attempts
 */
export function loginAttemptsQueryOptions(tenantId: string | null, days: number = 1) {
  return queryOptions({
    queryKey: dashboardKeys.loginAttempts(tenantId || ''),
    queryFn: async (): Promise<LoginAttemptsResponse> => {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      // IMPORTANT: MUST switch to dedicated endpoint /superuser/login-attempts
      // Use backend handler for getLoginAttempts()
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const endDate = new Date();

      const result = await api.superuser.getLoginAttempts({
        tenantId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        limit: 100 // Adjust limit as needed
      });

      // Transform to match the required interface
      const attempts: LoginAttempt[] = result.attempts.map((attempt: LoginAttemptRecord) => ({
        email: attempt.email,
        userAgent: attempt.userAgent,
        ipAddress: attempt.ipAddress,
        success: attempt.success,
        failureReason: attempt.failureReason,
        attemptedAt: attempt.attemptedAt
      }));

      return {
        attempts,
        total: result.total
      };
    },
    enabled: !!tenantId,
    ...dashboardQueryConfig
  });
}

/**
 * Hook to fetch login attempts
 * IMPORTANT: MUST switch to dedicated endpoint /superuser/login-attempts
 * @param days Number of days to look back (default: 1)
 * @returns Login attempts data with loading and error states
 */
export function useLoginAttemptsQuery(days: number = 1) {
  const tenantId = useTenant();
  const queryOptions = loginAttemptsQueryOptions(tenantId, days);

  return useQuery({
    ...queryOptions,
    select: (data): LoginAttemptsResponse => ({
      attempts: data.attempts,
      total: data.total
    })
  });
}

