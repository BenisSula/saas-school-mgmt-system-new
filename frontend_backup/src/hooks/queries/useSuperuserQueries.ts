import { useQuery, queryKeys } from '../useQuery';
import { api } from '../../lib/api';

// Superuser Overview
export function useSuperuserOverview() {
  return useQuery(queryKeys.superuser.overview(), () => api.superuser.getOverview());
}

// Schools/Tenants
export function useSchools() {
  return useQuery(queryKeys.superuser.schools(), () => api.superuser.listSchools());
}

// Platform Users
export function usePlatformUsers() {
  return useQuery(queryKeys.superuser.users(), () => api.superuser.listUsers());
}

// Tenant Analytics
export function useTenantAnalytics(tenantId?: string) {
  return useQuery(
    queryKeys.superuser.tenantAnalytics(tenantId),
    async () => {
      if (!tenantId) {
        const schools = await api.superuser.listSchools();
        return {
          totalTenants: schools.length,
          activeTenants: schools.filter((s) => s.status === 'active').length,
          totalUsers: schools.reduce((sum, s) => sum + (s.userCount || 0), 0)
        };
      }
      return await api.superuser.getTenantAnalytics(tenantId);
    },
    { enabled: !!tenantId || tenantId === undefined }
  );
}

// Subscriptions
export function useSubscriptions() {
  return useQuery(queryKeys.superuser.subscriptions(), async () => {
    const schools = await api.superuser.listSchools();
    return schools.map((school) => ({
      id: school.id,
      name: school.name,
      subscriptionType: school.subscriptionType || 'trial',
      status: school.status,
      billingEmail: school.billingEmail,
      createdAt: school.createdAt,
      userCount: school.userCount
    }));
  });
}

// Usage Monitoring
export function useUsage(tenantId?: string) {
  return useQuery(queryKeys.superuser.usage(tenantId), () => api.superuser.getUsage(tenantId), {
    enabled: true
  });
}
