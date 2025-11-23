import { useQuery, queryOptions } from '@tanstack/react-query';
import { useTenant } from '../../useTenant';
import { api } from '../../../lib/api';
import { dashboardKeys } from './queryKeys';
import { dashboardQueryConfig } from './queryConfig';

export interface TodayAttendanceResponse {
  presentCount: number;
  absentCount: number;
  attendanceRate: number; // 0-100
}

export interface TodayAttendance {
  presentCount: number;
  absentCount: number;
  attendanceRate: number; // 0-100
}

/**
 * Query options for today's attendance
 */
export function todayAttendanceQueryOptions(tenantId: string | null) {
  return queryOptions({
    queryKey: dashboardKeys.attendanceToday(tenantId || ''),
    queryFn: async (): Promise<TodayAttendance> => {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      // TODO: Replace with dedicated endpoint /admin/attendance/today when available
      // For now, fetch today's attendance aggregate
      const today = new Date().toISOString().split('T')[0];
      const attendance = await api.getAttendanceAggregate({ from: today, to: today });

      let presentCount = 0;
      let absentCount = 0;
      let total = 0;

      attendance.forEach((record) => {
        if (record.status === 'present' || record.status === 'late') {
          presentCount += record.count;
        } else if (record.status === 'absent') {
          absentCount += record.count;
        }
        total += record.count;
      });

      const attendanceRate = total > 0 ? Math.round((presentCount / total) * 100) : 0;

      return {
        presentCount,
        absentCount,
        attendanceRate
      };
    },
    enabled: !!tenantId,
    ...dashboardQueryConfig
  });
}

/**
 * Hook to fetch today's attendance statistics
 * @returns Today's attendance data with loading and error states
 */
export function useTodayAttendanceQuery() {
  const tenantId = useTenant();
  const queryOptions = todayAttendanceQueryOptions(tenantId);

  return useQuery({
    ...queryOptions,
    select: (data): TodayAttendance => ({
      presentCount: data.presentCount,
      absentCount: data.absentCount,
      attendanceRate: data.attendanceRate
    })
  });
}

