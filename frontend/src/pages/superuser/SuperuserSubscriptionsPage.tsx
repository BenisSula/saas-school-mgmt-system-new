import { useMemo, useState } from 'react';
import { useMutationWithInvalidation, queryKeys } from '../../hooks/useQuery';
import { useSchools } from '../../hooks/queries/useSuperuserQueries';
import { DataTable, type DataTableColumn } from '../../components/tables/DataTable';
import { BarChart, type BarChartData } from '../../components/charts/BarChart';
import { PieChart, type PieChartData } from '../../components/charts/PieChart';
import { StatCard } from '../../components/charts/StatCard';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import RouteMeta from '../../components/layout/RouteMeta';
import { CreditCard, DollarSign, TrendingUp, Users } from 'lucide-react';
import { api, type SubscriptionTier, type PlatformSchool } from '../../lib/api';
import { formatNumber } from '../../lib/utils/data';

export default function SuperuserSubscriptionsPage() {
  const [showTierModal, setShowTierModal] = useState(false);

  const { data: schoolsData, isLoading: schoolsLoading } = useSchools();

  const schools = useMemo(() => schoolsData || [], [schoolsData]);

  const updateSubscriptionMutation = useMutationWithInvalidation(
    async (payload: { schoolId: string; subscriptionType: SubscriptionTier }) => {
      await api.superuser.updateSchool(payload.schoolId, {
        subscriptionType: payload.subscriptionType
      });
    },
    [queryKeys.superuser.schools(), queryKeys.superuser.subscriptions()] as unknown as unknown[][],
    { successMessage: 'Subscription updated successfully' }
  );

  // Subscription breakdown
  const subscriptionBreakdown: BarChartData[] = useMemo(() => {
    const counts = new Map<SubscriptionTier, number>();
    schools.forEach((school) => {
      const tier = school.subscriptionType || 'trial';
      counts.set(tier, (counts.get(tier) || 0) + 1);
    });
    return Array.from(counts.entries()).map(([tier, count]) => ({
      label: tier.charAt(0).toUpperCase() + tier.slice(1),
      value: count,
      color: 'var(--brand-primary)'
    }));
  }, [schools]);

  // Revenue estimation
  const revenueData: PieChartData[] = useMemo(() => {
    const revenueByTier = new Map<SubscriptionTier, number>();
    schools.forEach((school) => {
      const tier = school.subscriptionType || 'trial';
      const monthlyPrice = tier === 'paid' ? 99 : 0;
      revenueByTier.set(tier, (revenueByTier.get(tier) || 0) + monthlyPrice);
    });
    return Array.from(revenueByTier.entries())
      .filter(([, revenue]) => revenue > 0)
      .map(([tier, revenue]) => ({
        label: tier.charAt(0).toUpperCase() + tier.slice(1),
        value: revenue
      }));
  }, [schools]);

  const stats = useMemo(() => {
    const totalRevenue = revenueData.reduce((sum, item) => sum + item.value, 0);
    const paidSubscriptions = schools.filter((s) => s.subscriptionType === 'paid').length;
    const trialSubscriptions = schools.filter((s) => s.subscriptionType === 'trial').length;

    return {
      totalRevenue,
      paidSubscriptions,
      trialSubscriptions,
      totalSubscriptions: schools.length
    };
  }, [revenueData, schools]);

  const subscriptionColumns: DataTableColumn<PlatformSchool>[] = useMemo(
    () => [
      {
        key: 'name',
        header: 'School',
        render: (row) => row.name,
        sortable: true
      },
      {
        key: 'subscriptionType',
        header: 'Tier',
        render: (row) => (
          <Select
            value={row.subscriptionType || 'trial'}
            onChange={(e) =>
              updateSubscriptionMutation.mutate({
                schoolId: row.id,
                subscriptionType: e.target.value as SubscriptionTier
              })
            }
            options={[
              { label: 'Trial', value: 'trial' },
              { label: 'Paid', value: 'paid' },
              { label: 'Premium', value: 'premium' }
            ]}
          />
        )
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
        key: 'billingEmail',
        header: 'Billing Email',
        render: (row) => row.billingEmail || '—'
      }
    ],
    [updateSubscriptionMutation]
  );

  return (
    <RouteMeta title="Subscription Management">
      <div className="space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--brand-surface-contrast)]">
              Subscription Management
            </h1>
            <p className="mt-1 text-sm text-[var(--brand-muted)]">
              Manage subscription tiers and billing
            </p>
          </div>
          <Button variant="outline" onClick={() => setShowTierModal(true)}>
            Configure Tiers
          </Button>
        </header>

        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Subscriptions"
            value={stats.totalSubscriptions}
            icon={<Users className="h-5 w-5" />}
          />
          <StatCard
            title="Paid Subscriptions"
            value={stats.paidSubscriptions}
            icon={<CreditCard className="h-5 w-5" />}
          />
          <StatCard
            title="Trial Subscriptions"
            value={stats.trialSubscriptions}
            icon={<TrendingUp className="h-5 w-5" />}
          />
          <StatCard
            title="Monthly Revenue"
            value={`$${formatNumber(stats.totalRevenue)}`}
            icon={<DollarSign className="h-5 w-5" />}
          />
        </div>

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
            <BarChart
              data={subscriptionBreakdown}
              title="Subscription Distribution"
              height={250}
            />
          </div>
          <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
            <PieChart
              data={revenueData}
              title="Revenue by Tier"
              size={250}
            />
          </div>
        </div>

        {/* Subscriptions Table */}
        <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
          <DataTable<PlatformSchool>
            data={schools}
            columns={subscriptionColumns}
            pagination={{ pageSize: 10, showSizeSelector: true }}
            emptyMessage="No subscriptions found"
            loading={schoolsLoading}
          />
        </div>

        {/* Tier Configuration Modal */}
        {showTierModal && (
          <Modal
            title="Configure Subscription Tier"
            isOpen={showTierModal}
            onClose={() => setShowTierModal(false)}
          >
            <div className="space-y-4">
              <p className="text-sm text-[var(--brand-muted)]">
                Tier configuration will be implemented here
              </p>
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setShowTierModal(false)}>
                  Close
                </Button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </RouteMeta>
  );
}
