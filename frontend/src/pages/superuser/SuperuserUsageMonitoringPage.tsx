import { useMemo, useState } from 'react';
import { useUsage, useSchools } from '../../hooks/queries/useSuperuserQueries';
import { BarChart, type BarChartData } from '../../components/charts/BarChart';
import { LineChart, type LineChartDataPoint } from '../../components/charts/LineChart';
import { StatCard } from '../../components/charts/StatCard';
import { DataTable, type DataTableColumn } from '../../components/tables/DataTable';
import { Select } from '../../components/ui/Select';
import RouteMeta from '../../components/layout/RouteMeta';
import { Activity, Database, Zap, TrendingUp } from 'lucide-react';
import { formatDate } from '../../lib/utils/date';
import { formatNumber } from '../../lib/utils/data';

interface UsageData {
  tenantId: string;
  tenantName: string;
  activeUsers: number;
  storageUsed: number; // in GB
  apiCalls: number;
  lastActivity: string;
}

export default function SuperuserUsageMonitoringPage() {
  const [selectedTenantId, setSelectedTenantId] = useState<string>('all');

  const { data: schoolsData, isLoading: schoolsLoading } = useSchools();
  const { data: platformUsage } = useUsage(); // Platform-wide usage
  const { data: tenantUsage } = useUsage(selectedTenantId !== 'all' ? selectedTenantId : undefined);

  const schools = useMemo(() => schoolsData || [], [schoolsData]);

  // Generate usage data for each tenant
  const tenantUsageData: UsageData[] = useMemo(() => {
    // If a specific tenant is selected, use that tenant's usage data
    if (selectedTenantId !== 'all' && tenantUsage && 'tenantId' in tenantUsage && tenantUsage.tenantId) {
      return [{
        tenantId: tenantUsage.tenantId,
        tenantName: schools.find(s => s.id === tenantUsage.tenantId)?.name || 'Unknown',
        activeUsers: tenantUsage.activeUsers || 0,
        storageUsed: tenantUsage.storageUsed || 0,
        apiCalls: tenantUsage.apiCalls || 0,
        lastActivity: tenantUsage.lastActivity || new Date().toISOString()
      }];
    }

    // For all tenants, fetch individual usage or use school data
    return schools.map((school) => ({
      tenantId: school.id,
      tenantName: school.name,
      activeUsers: school.userCount || 0,
      storageUsed: 0, // Would need to fetch per-tenant usage
      apiCalls: 0, // Would need to fetch per-tenant usage
      lastActivity: school.createdAt || new Date().toISOString()
    }));
  }, [schools, selectedTenantId, tenantUsage]);

  // Usage charts
  const storageUsage: BarChartData[] = useMemo(() => {
    return tenantUsageData
      .sort((a, b) => b.storageUsed - a.storageUsed)
      .slice(0, 10)
      .map((item) => ({
        label: item.tenantName,
        value: Math.round(item.storageUsed * 10) / 10,
        color: 'var(--brand-primary)'
      }));
  }, [tenantUsageData]);

  const apiCallsTrend: LineChartDataPoint[] = useMemo(() => {
    return tenantUsageData
      .slice(0, 10)
      .sort((a, b) => b.apiCalls - a.apiCalls)
      .map((item) => ({
        label: item.tenantName.length > 15 ? `${item.tenantName.slice(0, 15)}...` : item.tenantName,
        value: item.apiCalls
      }));
  }, [tenantUsageData]);

  const stats = useMemo(() => {
    // Use platform-wide stats if available, otherwise calculate from tenant data
    if (platformUsage && 'totalActiveUsers' in platformUsage) {
      return {
        totalActiveUsers: platformUsage.totalActiveUsers || 0,
        totalStorage: Math.round((platformUsage.totalStorage || 0) * 10) / 10,
        totalApiCalls: platformUsage.totalApiCalls || 0,
        avgStoragePerTenant: schools.length > 0
          ? Math.round(((platformUsage.totalStorage || 0) / schools.length) * 10) / 10
          : 0
      };
    }

    // Fallback to calculating from tenant data
    const totalActiveUsers = tenantUsageData.reduce((sum, item) => sum + item.activeUsers, 0);
    const totalStorage = tenantUsageData.reduce((sum, item) => sum + item.storageUsed, 0);
    const totalApiCalls = tenantUsageData.reduce((sum, item) => sum + item.apiCalls, 0);
    const avgStoragePerTenant =
      tenantUsageData.length > 0 ? totalStorage / tenantUsageData.length : 0;

    return {
      totalActiveUsers,
      totalStorage: Math.round(totalStorage * 10) / 10,
      totalApiCalls,
      avgStoragePerTenant: Math.round(avgStoragePerTenant * 10) / 10
    };
  }, [tenantUsageData, platformUsage, schools.length]);

  const usageColumns: DataTableColumn<UsageData>[] = useMemo(
    () => [
      {
        key: 'tenantName',
        header: 'Tenant',
        render: (row) => row.tenantName,
        sortable: true
      },
      {
        key: 'activeUsers',
        header: 'Active Users',
        render: (row) => row.activeUsers,
        sortable: true
      },
      {
        key: 'storageUsed',
        header: 'Storage (GB)',
        render: (row) => `${Math.round(row.storageUsed * 10) / 10} GB`,
        sortable: true
      },
      {
        key: 'apiCalls',
        header: 'API Calls',
        render: (row) => formatNumber(row.apiCalls),
        sortable: true
      },
      {
        key: 'lastActivity',
        header: 'Last Activity',
        render: (row) => formatDate(row.lastActivity),
        sortable: true
      }
    ],
    []
  );

  return (
    <RouteMeta title="Usage Monitoring">
      <div className="space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--brand-surface-contrast)]">
              Usage Monitoring
            </h1>
            <p className="mt-1 text-sm text-[var(--brand-muted)]">
              Monitor resource usage across all tenants
            </p>
          </div>
          <div className="sm:w-48">
            <Select
              label="Filter Tenant"
              value={selectedTenantId}
              onChange={(e) => setSelectedTenantId(e.target.value)}
              options={[
                { label: 'All Tenants', value: 'all' },
                ...schools.map((s) => ({ label: s.name, value: s.id }))
              ]}
              disabled={schoolsLoading}
            />
          </div>
        </header>

        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Active Users"
            value={stats.totalActiveUsers}
            icon={<Activity className="h-5 w-5" />}
            description="Across all tenants"
          />
          <StatCard
            title="Total Storage"
            value={`${stats.totalStorage} GB`}
            icon={<Database className="h-5 w-5" />}
            description="Used storage"
          />
          <StatCard
            title="Total API Calls"
            value={formatNumber(stats.totalApiCalls)}
            icon={<Zap className="h-5 w-5" />}
            description="This month"
          />
          <StatCard
            title="Avg Storage/Tenant"
            value={`${stats.avgStoragePerTenant} GB`}
            icon={<TrendingUp className="h-5 w-5" />}
            description="Average usage"
          />
        </div>

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
            <BarChart
              data={storageUsage}
              title="Storage Usage by Tenant (Top 10)"
              height={300}
            />
          </div>
          <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
            <LineChart
              data={apiCallsTrend}
              title="API Calls Trend"
              height={300}
            />
          </div>
        </div>

        {/* Usage Table */}
        <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
          <DataTable<UsageData>
            data={tenantUsageData}
            columns={usageColumns}
            pagination={{ pageSize: 10, showSizeSelector: true }}
            emptyMessage="No usage data available"
            loading={schoolsLoading}
          />
        </div>
      </div>
    </RouteMeta>
  );
}

