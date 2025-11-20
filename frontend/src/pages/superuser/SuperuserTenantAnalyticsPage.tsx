import { useMemo, useState } from 'react';
import { useTenantAnalytics, useSchools } from '../../hooks/queries/useSuperuserQueries';
import { BarChart, type BarChartData } from '../../components/charts/BarChart';
import { LineChart, type LineChartDataPoint } from '../../components/charts/LineChart';
import { PieChart, type PieChartData } from '../../components/charts/PieChart';
import { StatCard, ChartContainer, PageHeader } from '../../components/charts';
import { Card } from '../../components/ui/Card';
import { DataTable, type DataTableColumn } from '../../components/tables/DataTable';
import { Select } from '../../components/ui/Select';
import RouteMeta from '../../components/layout/RouteMeta';
import { Building2, Users, TrendingUp, Activity } from 'lucide-react';
import type { PlatformSchool } from '../../lib/api';
import { formatDate } from '../../lib/utils/date';

export default function SuperuserTenantAnalyticsPage() {
  const [selectedTenantId, setSelectedTenantId] = useState<string>('all');

  const { data: schoolsData, isLoading: schoolsLoading } = useSchools();
  const { data: analyticsData } = useTenantAnalytics(
    selectedTenantId !== 'all' ? selectedTenantId : undefined
  );

  const schools = useMemo(() => schoolsData || [], [schoolsData]);

  // Tenant distribution chart
  const tenantDistribution: BarChartData[] = useMemo(() => {
    const statusCounts = new Map<string, number>();
    schools.forEach((school) => {
      const status = school.status || 'unknown';
      statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
    });
    return Array.from(statusCounts.entries()).map(([label, value]) => ({
      label,
      value,
      color: 'var(--brand-primary)'
    }));
  }, [schools]);

  // Subscription distribution
  const subscriptionDistribution: PieChartData[] = useMemo(() => {
    const subCounts = new Map<string, number>();
    schools.forEach((school) => {
      const subType = school.subscriptionType || 'trial';
      subCounts.set(subType, (subCounts.get(subType) || 0) + 1);
    });
    return Array.from(subCounts.entries()).map(([label, value]) => ({
      label: label.charAt(0).toUpperCase() + label.slice(1),
      value
    }));
  }, [schools]);

  // Growth trend based on actual creation dates
  const growthTrend: LineChartDataPoint[] = useMemo(() => {
    // Sort by creation date and show growth
    const sorted = [...schools].sort(
      (a, b) => new Date(a.createdAt || '').getTime() - new Date(b.createdAt || '').getTime()
    );
    let cumulative = 0;
    return sorted.map((school) => {
      cumulative += 1;
      const date = new Date(school.createdAt || '');
      return {
        label: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        value: cumulative
      };
    });
  }, [schools]);

  const stats = useMemo(() => {
    // Use analytics data if available for specific tenant
    if (analyticsData && 'userCount' in analyticsData) {
      return {
        totalTenants: 1,
        activeTenants: analyticsData.userCount > 0 ? 1 : 0,
        totalUsers: analyticsData.userCount,
        avgUsersPerTenant: analyticsData.userCount
      };
    }

    // Platform-wide stats
    const totalTenants = schools.length;
    const activeTenants = schools.filter((s) => s.status === 'active').length;
    const totalUsers = schools.reduce((sum, s) => sum + (s.userCount || 0), 0);
    const avgUsersPerTenant = totalTenants > 0 ? totalUsers / totalTenants : 0;

    return {
      totalTenants,
      activeTenants,
      totalUsers,
      avgUsersPerTenant: Math.round(avgUsersPerTenant * 10) / 10
    };
  }, [schools, analyticsData]);

  const tenantColumns: DataTableColumn<PlatformSchool>[] = useMemo(
    () => [
      {
        key: 'name',
        header: 'School Name',
        render: (row) => row.name,
        sortable: true
      },
      {
        key: 'status',
        header: 'Status',
        render: (row) => (
          <span
            className={`rounded-full px-2 py-1 text-xs font-semibold ${
              row.status === 'active'
                ? 'bg-emerald-500/20 text-emerald-200'
                : 'bg-red-500/20 text-red-200'
            }`}
          >
            {row.status || 'unknown'}
          </span>
        )
      },
      {
        key: 'userCount',
        header: 'Users',
        render: (row) => row.userCount || 0
      },
      {
        key: 'subscriptionType',
        header: 'Subscription',
        render: (row) => row.subscriptionType || 'trial'
      },
      {
        key: 'createdAt',
        header: 'Created',
        render: (row) => formatDate(row.createdAt)
      }
    ],
    []
  );

  return (
    <RouteMeta title="Tenant Analytics">
      <div className="space-y-6">
        <PageHeader
          title="Tenant Analytics"
          description="Platform-wide tenant statistics and insights"
          action={
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
          }
        />

        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Tenants"
            value={stats.totalTenants}
            icon={<Building2 className="h-5 w-5" />}
            description="Registered schools"
          />
          <StatCard
            title="Active Tenants"
            value={stats.activeTenants}
            icon={<Activity className="h-5 w-5" />}
            description="Currently active"
          />
          <StatCard
            title="Total Users"
            value={stats.totalUsers}
            icon={<Users className="h-5 w-5" />}
            description="Across all tenants"
          />
          <StatCard
            title="Avg Users/Tenant"
            value={stats.avgUsersPerTenant}
            icon={<TrendingUp className="h-5 w-5" />}
            description="Average per school"
          />
        </div>

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartContainer>
            <BarChart
              data={tenantDistribution}
              title="Tenant Distribution by Status"
              height={250}
            />
          </ChartContainer>
          <ChartContainer>
            <PieChart
              data={subscriptionDistribution}
              title="Subscription Distribution"
              size={250}
            />
          </ChartContainer>
          <ChartContainer className="lg:col-span-2">
            <LineChart data={growthTrend} title="Platform Growth Trend" height={200} />
          </ChartContainer>
        </div>

        {/* Tenants Table */}
        <Card padding="md">
          <DataTable<PlatformSchool>
            data={schools}
            columns={tenantColumns}
            pagination={{ pageSize: 10, showSizeSelector: true }}
            emptyMessage="No tenants found"
            loading={schoolsLoading}
          />
        </Card>
      </div>
    </RouteMeta>
  );
}
