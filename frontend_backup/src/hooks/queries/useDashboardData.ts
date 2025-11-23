import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

/**
 * Hook to fetch platform active sessions
 */
export function usePlatformActiveSessions() {
  return useQuery({
    queryKey: ['superuser', 'dashboard', 'active-sessions'],
    queryFn: () => api.superuser.getAllActiveSessions({ limit: 1000 }),
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000 // Refetch every minute
  });
}

/**
 * Hook to fetch failed login attempts count
 */
export function useFailedLoginAttempts() {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  return useQuery({
    queryKey: ['superuser', 'dashboard', 'failed-login-attempts'],
    queryFn: async () => {
      const result = await api.superuser.getLoginAttempts({
        success: false,
        startDate: oneDayAgo,
        limit: 1000
      });
      return result.total;
    },
    staleTime: 60000, // 1 minute
    refetchInterval: 120000 // Refetch every 2 minutes
  });
}

/**
 * Hook to fetch recent critical audit logs
 */
export function useRecentCriticalAuditLogs() {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  return useQuery({
    queryKey: ['superuser', 'dashboard', 'critical-audit-logs'],
    queryFn: async () => {
      const result = await api.superuser.getPlatformAuditLogs({
        severity: 'critical',
        startDate: oneHourAgo,
        tags: ['security', 'authentication'],
        limit: 50
      });
      return result.logs;
    },
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000 // Refetch every minute
  });
}

/**
 * Hook to fetch tenant breakdown data
 */
export function useTenantBreakdown() {
  return useQuery({
    queryKey: ['superuser', 'dashboard', 'tenant-breakdown'],
    queryFn: async () => {
      const schools = await api.superuser.listSchools();
      return schools.map((school) => ({
        id: school.id,
        name: school.name,
        userCount: school.userCount || 0,
        status: school.status
      }));
    },
    staleTime: 120000 // 2 minutes
  });
}

/**
 * Hook to fetch device breakdown from active sessions
 */
export function useDeviceBreakdown() {
  return useQuery({
    queryKey: ['superuser', 'dashboard', 'device-breakdown'],
    queryFn: async () => {
      const sessions = await api.superuser.getAllActiveSessions({ limit: 1000 });
      const deviceCounts = {
        mobile: 0,
        tablet: 0,
        desktop: 0,
        unknown: 0
      };

      sessions.sessions.forEach((session) => {
        const deviceType = session.deviceInfo?.deviceType;
        if (deviceType === 'mobile') {
          deviceCounts.mobile++;
        } else if (deviceType === 'tablet') {
          deviceCounts.tablet++;
        } else if (deviceType === 'desktop') {
          deviceCounts.desktop++;
        } else {
          deviceCounts.unknown++;
        }
      });

      return deviceCounts;
    },
    staleTime: 30000,
    refetchInterval: 60000
  });
}

/**
 * Hook to fetch session distribution over time (last 24 hours)
 */
export function useSessionDistribution() {
  return useQuery({
    queryKey: ['superuser', 'dashboard', 'session-distribution'],
    queryFn: async () => {
      const sessions = await api.superuser.getAllActiveSessions({ limit: 1000 });
      
      // Group sessions by hour of login
      const hourlyCounts: Record<string, number> = {};
      const now = new Date();
      
      // Initialize last 24 hours
      for (let i = 23; i >= 0; i--) {
        const hour = new Date(now.getTime() - i * 60 * 60 * 1000);
        const hourKey = `${hour.getHours().toString().padStart(2, '0')}:00`;
        hourlyCounts[hourKey] = 0;
      }

      // Count sessions per hour
      sessions.sessions.forEach((session) => {
        const loginDate = new Date(session.loginAt);
        const hoursDiff = Math.floor((now.getTime() - loginDate.getTime()) / (60 * 60 * 1000));
        
        if (hoursDiff >= 0 && hoursDiff < 24) {
          const hour = new Date(loginDate);
          hour.setMinutes(0, 0, 0);
          const hourKey = `${hour.getHours().toString().padStart(2, '0')}:00`;
          if (hourlyCounts[hourKey] !== undefined) {
            hourlyCounts[hourKey]++;
          }
        }
      });

      // Convert to array and sort by hour
      const sortedEntries = Object.entries(hourlyCounts).sort((a, b) => {
        const hourA = parseInt(a[0].split(':')[0], 10);
        const hourB = parseInt(b[0].split(':')[0], 10);
        return hourA - hourB;
      });

      return sortedEntries.map(([label, value]) => ({ label, value }));
    },
    staleTime: 30000,
    refetchInterval: 60000
  });
}

