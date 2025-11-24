import { useMemo, useState, useEffect } from 'react';
import { useMutationWithInvalidation, queryKeys } from '../../hooks/useQuery';
import { useSchools } from '../../hooks/queries/useSuperuserQueries';
import { DataTable, type DataTableColumn } from '../../components/tables/DataTable';
import { BarChart, type BarChartData } from '../../components/charts/BarChart';
import { PieChart, type PieChartData } from '../../components/charts/PieChart';
import { StatCard } from '../../components/charts/StatCard';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import RouteMeta from '../../components/layout/RouteMeta';
import { CreditCard, DollarSign, TrendingUp, Users } from 'lucide-react';
import { api, type SubscriptionTier, type PlatformSchool } from '../../lib/api';
import { formatNumber } from '../../lib/utils/data';
import { toast } from 'sonner';

type TierConfig = {
  tier: SubscriptionTier;
  name: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  maxUsers: number | null;
  maxStudents: number | null;
  maxTeachers: number | null;
  maxStorageGb: number | null;
};

export default function SuperuserSubscriptionsPage() {
  const [showTierModal, setShowTierModal] = useState(false);

  const { data: schoolsData, isLoading: schoolsLoading } = useSchools();

  const schools = useMemo(() => schoolsData || [], [schoolsData]);

  const updateSubscriptionMutation = useMutationWithInvalidation(
    async (payload: { schoolId: string; subscriptionType: SubscriptionTier }) => {
      await api.superuser.updateSchool(payload.schoolId, {
        subscriptionType: payload.subscriptionType,
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
      color: 'var(--brand-primary)',
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
        value: revenue,
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
      totalSubscriptions: schools.length,
    };
  }, [revenueData, schools]);

  const subscriptionColumns: DataTableColumn<PlatformSchool>[] = useMemo(
    () => [
      {
        key: 'name',
        header: 'School',
        render: (row) => row.name,
        sortable: true,
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
                subscriptionType: e.target.value as SubscriptionTier,
              })
            }
            options={[
              { label: 'Trial', value: 'trial' },
              { label: 'Paid', value: 'paid' },
              { label: 'Premium', value: 'premium' },
            ]}
          />
        ),
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
        ),
      },
      {
        key: 'userCount',
        header: 'Users',
        render: (row) => row.userCount || 0,
      },
      {
        key: 'billingEmail',
        header: 'Billing Email',
        render: (row) => row.billingEmail || '—',
      },
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
            <BarChart data={subscriptionBreakdown} title="Subscription Distribution" height={250} />
          </div>
          <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
            <PieChart data={revenueData} title="Revenue by Tier" size={250} />
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
          <TierConfigurationModal isOpen={showTierModal} onClose={() => setShowTierModal(false)} />
        )}
      </div>
    </RouteMeta>
  );
}

function TierConfigurationModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [configs, setConfigs] = useState<TierConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadConfigs();
    }
  }, [isOpen]);

  const loadConfigs = async () => {
    setLoading(true);
    try {
      const data = await api.superuser.getSubscriptionTierConfigs();
      setConfigs(
        data.map(
          (c: {
            id: string;
            tier: SubscriptionTier;
            name: string;
            description: string | null;
            monthlyPrice: number;
            yearlyPrice: number;
            maxUsers: number | null;
            maxStudents: number | null;
            maxTeachers: number | null;
            maxStorageGb: number | null;
            features: Record<string, unknown>;
            limits: Record<string, unknown>;
            isActive: boolean;
            createdAt: string;
            updatedAt: string;
          }) => ({
            tier: c.tier,
            name: c.name,
            description: c.description || '',
            monthlyPrice: c.monthlyPrice,
            yearlyPrice: c.yearlyPrice,
            maxUsers: c.maxUsers,
            maxStudents: c.maxStudents,
            maxTeachers: c.maxTeachers,
            maxStorageGb: c.maxStorageGb,
          })
        )
      );
    } catch (err) {
      toast.error((err as Error).message || 'Failed to load tier configurations');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.superuser.updateSubscriptionTierConfigs(
        configs.map((c) => ({
          tier: c.tier,
          config: {
            name: c.name,
            description: c.description || undefined,
            monthlyPrice: c.monthlyPrice,
            yearlyPrice: c.yearlyPrice,
            maxUsers: c.maxUsers,
            maxStudents: c.maxStudents,
            maxTeachers: c.maxTeachers,
            maxStorageGb: c.maxStorageGb,
          },
        }))
      );
      toast.success('Tier configurations updated successfully');
      onClose();
    } catch (err) {
      toast.error((err as Error).message || 'Failed to update tier configurations');
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = (
    tier: SubscriptionTier,
    field: keyof TierConfig,
    value: string | number | null
  ) => {
    setConfigs((prev) => prev.map((c) => (c.tier === tier ? { ...c, [field]: value } : c)));
  };

  if (loading) {
    return (
      <Modal title="Configure Subscription Tiers" isOpen={isOpen} onClose={onClose}>
        <div className="p-4">Loading...</div>
      </Modal>
    );
  }

  return (
    <Modal title="Configure Subscription Tiers" isOpen={isOpen} onClose={onClose}>
      <div className="space-y-6 max-h-[70vh] overflow-y-auto">
        {configs.map((config) => (
          <div key={config.tier} className="rounded-lg border border-[var(--brand-border)] p-4">
            <h3 className="mb-4 text-lg font-semibold capitalize">{config.tier} Tier</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Name"
                value={config.name}
                onChange={(e) => updateConfig(config.tier, 'name', e.target.value)}
              />
              <Input
                label="Description"
                value={config.description}
                onChange={(e) => updateConfig(config.tier, 'description', e.target.value)}
              />
              <Input
                label="Monthly Price ($)"
                type="number"
                value={config.monthlyPrice}
                onChange={(e) =>
                  updateConfig(config.tier, 'monthlyPrice', parseFloat(e.target.value) || 0)
                }
              />
              <Input
                label="Yearly Price ($)"
                type="number"
                value={config.yearlyPrice}
                onChange={(e) =>
                  updateConfig(config.tier, 'yearlyPrice', parseFloat(e.target.value) || 0)
                }
              />
              <Input
                label="Max Users"
                type="number"
                value={config.maxUsers || ''}
                onChange={(e) =>
                  updateConfig(
                    config.tier,
                    'maxUsers',
                    e.target.value ? parseInt(e.target.value, 10) : null
                  )
                }
                placeholder="Unlimited"
              />
              <Input
                label="Max Students"
                type="number"
                value={config.maxStudents || ''}
                onChange={(e) =>
                  updateConfig(
                    config.tier,
                    'maxStudents',
                    e.target.value ? parseInt(e.target.value, 10) : null
                  )
                }
                placeholder="Unlimited"
              />
              <Input
                label="Max Teachers"
                type="number"
                value={config.maxTeachers || ''}
                onChange={(e) =>
                  updateConfig(
                    config.tier,
                    'maxTeachers',
                    e.target.value ? parseInt(e.target.value, 10) : null
                  )
                }
                placeholder="Unlimited"
              />
              <Input
                label="Max Storage (GB)"
                type="number"
                value={config.maxStorageGb || ''}
                onChange={(e) =>
                  updateConfig(
                    config.tier,
                    'maxStorageGb',
                    e.target.value ? parseInt(e.target.value, 10) : null
                  )
                }
                placeholder="Unlimited"
              />
            </div>
          </div>
        ))}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={saving}>
            Save Changes
          </Button>
        </div>
      </div>
    </Modal>
  );
}
