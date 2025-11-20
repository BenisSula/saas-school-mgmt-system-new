import { useMemo } from 'react';
import { RouteMeta } from '../../components/layout/RouteMeta';
import { DashboardSkeleton } from '../../components/ui/DashboardSkeleton';
import { StatusBanner } from '../../components/ui/StatusBanner';
import { DataTable, type DataTableColumn } from '../../components/tables/DataTable';
import { BarChart, type BarChartData } from '../../components/charts/BarChart';
import { PieChart, type PieChartData } from '../../components/charts/PieChart';
import { StatCard } from '../../components/charts/StatCard';
import { useSuperuserOverview } from '../../hooks/queries/useSuperuserQueries';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../hooks/useQuery';
import { Button } from '../../components/ui/Button';
import type { PlatformOverview, SubscriptionTier } from '../../lib/api';
import { Building2, Users, AlertCircle, DollarSign } from 'lucide-react';
import { formatDate } from '../../lib/utils/date';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { formatCurrency, formatNumber } from '../../lib/utils/data';

const SUBSCRIPTION_LABELS: Record<SubscriptionTier, string> = {
  free: 'Free',
  trial: 'Trial',
  paid: 'Paid'
};

// Using shared formatters from utils

export default function SuperuserOverviewPage() {
  const queryClient = useQueryClient();
  const { data: overview, isLoading, error } = useSuperuserOverview();

  const statTiles = useMemo(() => {
    if (!overview) return [];
    return [
      {
        title: 'Total schools',
        value: overview.totals.schools,
        description: `${overview.totals.activeSchools} active, ${overview.totals.suspendedSchools} suspended`,
        icon: <Building2 className="h-5 w-5" />
      },
      {
        title: 'Total users',
        value: overview.totals.users,
        description: `${overview.roleDistribution.admins} admins • ${overview.roleDistribution.hods} HODs • ${overview.roleDistribution.teachers} teachers • ${overview.roleDistribution.students} students`,
        icon: <Users className="h-5 w-5" />
      },
      {
        title: 'Pending approvals',
        value: overview.totals.pendingUsers,
        description: 'Users awaiting activation',
        icon: <AlertCircle className="h-5 w-5" />
      },
      {
        title: 'Lifetime revenue',
        value: overview.revenue.total,
        description: 'Sum of succeeded payments',
        icon: <DollarSign className="h-5 w-5" />
      }
    ];
  }, [overview]);

  // Subscription breakdown chart
  const subscriptionBreakdown: PieChartData[] = useMemo(() => {
    if (!overview) return [];
    return Object.entries(overview.subscriptionBreakdown)
      .filter(([, value]) => value > 0)
      .map(([tier, value]) => ({
        label: SUBSCRIPTION_LABELS[tier as SubscriptionTier],
        value
      }));
  }, [overview]);

  // Role distribution chart
  const roleDistribution: BarChartData[] = useMemo(() => {
    if (!overview) return [];
    return [
      { label: 'Admins', value: overview.roleDistribution.admins, color: 'var(--brand-primary)' },
      { label: 'HODs', value: overview.roleDistribution.hods, color: 'var(--brand-accent)' },
      { label: 'Teachers', value: overview.roleDistribution.teachers, color: 'var(--brand-info)' },
      {
        label: 'Students',
        value: overview.roleDistribution.students,
        color: 'var(--brand-success)'
      }
    ].filter((item) => item.value > 0);
  }, [overview]);

  // Revenue by tenant chart
  const revenueByTenant: BarChartData[] = useMemo(() => {
    if (!overview || overview.revenue.byTenant.length === 0) return [];
    return overview.revenue.byTenant
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10)
      .map((entry) => ({
        label: entry.tenantId.slice(0, 8) + '…',
        value: entry.amount,
        color: 'var(--brand-primary)'
      }));
  }, [overview]);

  const recentColumns: DataTableColumn<PlatformOverview['recentSchools'][number]>[] = useMemo(
    () => [
      {
        key: 'name',
        header: 'School',
        render: (row) => row.name,
        sortable: true
      },
      {
        key: 'subscriptionType',
        header: 'Subscription',
        render: (row) => SUBSCRIPTION_LABELS[row.subscriptionType],
        sortable: true
      },
      {
        key: 'status',
        header: 'Status',
        render: (row) => <StatusBadge status={row.status} />,
        sortable: true
      },
      {
        key: 'createdAt',
        header: 'Created',
        render: (row) => formatDate(row.createdAt),
        sortable: true
      }
    ],
    []
  );

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.superuser.overview() });
  };

  if (isLoading) {
    return (
      <RouteMeta title="Dashboard overview">
        <DashboardSkeleton />
      </RouteMeta>
    );
  }

  if (error) {
    return (
      <RouteMeta title="Dashboard overview">
        <StatusBanner status="error" message={(error as Error).message} />
      </RouteMeta>
    );
  }

  if (!overview) {
    return (
      <RouteMeta title="Dashboard overview">
        <StatusBanner status="info" message="No platform data available yet." />
      </RouteMeta>
    );
  }

  const activeRate =
    overview.totals.schools > 0
      ? Math.round((overview.totals.activeSchools / overview.totals.schools) * 100)
      : 0;
  const verificationRate =
    overview.totals.users > 0
      ? Math.round(
          ((overview.totals.users - overview.totals.pendingUsers) / overview.totals.users) * 100
        )
      : 0;

  return (
    <RouteMeta title="Dashboard overview">
      <div className="space-y-8">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--brand-surface-contrast)]">
              Platform Overview
            </h1>
            <p className="text-sm text-[var(--brand-muted)]">
              Monitor platform-wide statistics and health metrics
            </p>
          </div>
          <Button onClick={handleRefresh}>Refresh</Button>
        </header>

        {/* Stats Cards */}
        <section
          className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
          aria-label="Platform statistics"
        >
          {statTiles.map((tile) => (
            <StatCard
              key={tile.title}
              title={tile.title}
              value={
                tile.title === 'Lifetime revenue'
                  ? formatCurrency(tile.value)
                  : formatNumber(tile.value)
              }
              description={tile.description}
              icon={tile.icon}
            />
          ))}
        </section>

        {/* Charts */}
        <section
          className="grid gap-6 lg:grid-cols-2"
          aria-label="Subscription and revenue insights"
        >
          {subscriptionBreakdown.length > 0 && (
            <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-[var(--brand-surface-contrast)]">
                Subscription Mix
              </h2>
              <PieChart data={subscriptionBreakdown} title="" size={250} />
            </div>
          )}
          <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-[var(--brand-surface-contrast)]">
              Revenue Snapshot
            </h2>
            <div className="mt-6 space-y-4">
              <div className="rounded-lg border border-[var(--brand-border)]/60 bg-slate-950/40 p-4 text-sm">
                <p className="text-xs uppercase tracking-wide text-[var(--brand-muted)]">
                  Total processed
                </p>
                <p className="mt-1 text-2xl font-semibold text-[var(--brand-surface-contrast)]">
                  {formatCurrency(overview.revenue.total)}
                </p>
              </div>
              {revenueByTenant.length > 0 && (
                <div>
                  <p className="mb-2 text-xs uppercase tracking-wide text-[var(--brand-muted)]">
                    Top performing tenants
                  </p>
                  <BarChart data={revenueByTenant} title="" height={150} />
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Role Distribution and Health Metrics */}
        <section className="grid gap-6 lg:grid-cols-2" aria-label="Platform activity and growth">
          {roleDistribution.length > 0 && (
            <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-[var(--brand-surface-contrast)]">
                Role Distribution
              </h2>
              <BarChart data={roleDistribution} title="" height={250} />
            </div>
          )}
          <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-[var(--brand-surface-contrast)]">
              Platform Health
            </h2>
            <div className="mt-6 space-y-4">
              <div className="rounded-lg border border-[var(--brand-border)]/60 bg-slate-950/40 p-4">
                <p className="text-xs uppercase tracking-wide text-[var(--brand-muted)]">
                  Active schools rate
                </p>
                <p className="mt-1 text-2xl font-semibold text-[var(--brand-surface-contrast)]">
                  {activeRate}%
                </p>
                <p className="mt-1 text-xs text-[var(--brand-muted)]">
                  {overview.totals.activeSchools} of {overview.totals.schools} schools active
                </p>
              </div>
              <div className="rounded-lg border border-[var(--brand-border)]/60 bg-slate-950/40 p-4">
                <p className="text-xs uppercase tracking-wide text-[var(--brand-muted)]">
                  User verification rate
                </p>
                <p className="mt-1 text-2xl font-semibold text-[var(--brand-surface-contrast)]">
                  {verificationRate}%
                </p>
                <p className="mt-1 text-xs text-[var(--brand-muted)]">
                  {overview.totals.pendingUsers} users pending approval
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Recent Schools */}
        <section aria-label="Recent schools">
          <h2 className="mb-4 text-lg font-semibold text-[var(--brand-surface-contrast)]">
            Recently provisioned schools
          </h2>
          <DataTable
            data={overview.recentSchools}
            columns={recentColumns}
            pagination={{ pageSize: 10, showSizeSelector: true }}
            emptyMessage="No schools have been provisioned yet."
          />
        </section>
      </div>
    </RouteMeta>
  );
}
