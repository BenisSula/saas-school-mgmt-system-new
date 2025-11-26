import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { queryKeys } from '../useQuery';

export interface ActivityLogFilters {
  entityType?: 'teacher' | 'student' | 'hod' | 'user' | string;
  entityId?: string;
  userId?: string;
  limit?: number;
  from?: string;
  to?: string;
}

export interface ActivityLogEntry {
  id: string;
  action: string;
  description: string;
  entityType: string;
  entityId: string;
  userId: string;
  userEmail: string | null;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

/**
 * Hook to fetch activity logs with optional filters
 */
export function useActivityLogs(filters?: ActivityLogFilters) {
  return useQuery({
    queryKey: [...queryKeys.admin.reports('activity'), filters] as const,
    queryFn: async (): Promise<ActivityLogEntry[]> => {
      // Use the audit logs API endpoint
      const logs = await api.getAuditLogs(filters?.userId, {
        entityType: filters?.entityType,
        from: filters?.from,
        to: filters?.to,
        limit: filters?.limit || 10,
      });

      // Filter by entityId if provided
      let filteredLogs = logs;
      if (filters?.entityId) {
        filteredLogs = logs.filter((log) => log.entityId === filters.entityId);
      }

      // Transform to ActivityLogEntry format
      return filteredLogs.map((log): ActivityLogEntry => ({
        id: log.id,
        action: log.action,
        description: `${log.action} on ${log.entityType || 'resource'}`,
        entityType: log.entityType || '',
        entityId: log.entityId || '',
        userId: log.userId || '',
        userEmail: log.userEmail || null,
        timestamp: log.timestamp || log.createdAt?.toString() || new Date().toISOString(),
        metadata: log.details || undefined,
      }));
    },
    staleTime: 30000, // 30 seconds
  });
}
