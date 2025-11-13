import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { RouteMeta } from '../../components/layout/RouteMeta';
import { DashboardSkeleton } from '../../components/ui/DashboardSkeleton';
import { StatusBanner } from '../../components/ui/StatusBanner';
import { Table, type TableColumn } from '../../components/ui/Table';
import { api, type PlatformOverview, type SubscriptionTier } from '../../lib/api';

interface StatTile {
  title: string;
  value: number;
  description?: string;
}

const SUBSCRIPTION_LABELS: Record<SubscriptionTier, string> = {
  free: 'Free',
  trial: 'Trial',
  paid: 'Paid'
};

const numberFormatter = new Intl.NumberFormat();
const currencyFormatter = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0
});

export function SuperuserOverviewPage() {
  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.superuser.getOverview();
        setOverview(data);
      } catch (err) {
        const message = (err as Error).message;
        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const statTiles: StatTile[] = useMemo(() => {
    if (!overview) return [];
    return [
      {
        title: 'Total schools',
        value: overview.totals.schools,
        description: `${overview.totals.activeSchools} active, ${overview.totals.suspendedSchools} suspended`
      },
      {
        title: 'Total users',
        value: overview.totals.users,
        description: `${overview.roleDistribution.admins} admins • ${overview.roleDistribution.hods} HODs • ${overview.roleDistribution.teachers} teachers • ${overview.roleDistribution.students} students`
      },
      {
        title: 'Pending approvals',
        value: overview.totals.pendingUsers,
        description: 'Users awaiting activation'
      },
      {
        title: 'Lifetime revenue',
        value: overview.revenue.total,
        description: 'Sum of succeeded payments'
      }
    ];
  }, [overview]);

  const recentColumns: TableColumn<PlatformOverview['recentSchools'][number]>[] = [
    { header: 'School', key: 'name' },
    {
      header: 'Subscription',
      render: (row) => SUBSCRIPTION_LABELS[row.subscriptionType]
    },
    {
      header: 'Status',
      render: (row) => row.status.charAt(0).toUpperCase() + row.status.slice(1)
    },
    {
      header: 'Created',
      render: (row) => new Date(row.createdAt).toLocaleDateString()
    }
  ];

  if (loading) {
    return (
      <RouteMeta title="Dashboard overview">
        <DashboardSkeleton />
      </RouteMeta>
    );
  }

  if (error) {
    return (
      <RouteMeta title="Dashboard overview">
        <StatusBanner status="error" message={error} />
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

  return (
    <RouteMeta title="Dashboard overview">
      <div className="space-y-8">
        <section
          className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
          aria-label="Platform statistics"
        >
          {statTiles.map((tile) => (
            <article
              key={tile.title}
              className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-5 shadow-sm transition hover:border-[var(--brand-primary)]/40 hover:shadow-lg"
            >
              <h2 className="text-sm uppercase tracking-wide text-[var(--brand-muted)]">
                {tile.title}
              </h2>
              <p className="mt-3 text-3xl font-semibold text-[var(--brand-surface-contrast)]">
                {tile.title === 'Lifetime revenue'
                  ? currencyFormatter.format(tile.value)
                  : numberFormatter.format(tile.value)}
              </p>
              {tile.description ? (
                <p className="mt-2 text-xs text-[var(--brand-muted)]">{tile.description}</p>
              ) : null}
            </article>
          ))}
        </section>

        <section
          className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]"
          aria-label="Subscription and revenue insights"
        >
          <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
            <header className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--brand-surface-contrast)]">
                Subscription mix
              </h2>
            </header>
            <SubscriptionBreakdown breakdown={overview.subscriptionBreakdown} />
          </div>
          <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
            <header className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--brand-surface-contrast)]">
                Revenue snapshot
              </h2>
            </header>
            <RevenueSummary total={overview.revenue.total} byTenant={overview.revenue.byTenant} />
          </div>
        </section>

        <section aria-label="Recent schools">
          <h2 className="mb-4 text-lg font-semibold text-[var(--brand-surface-contrast)]">
            Recently provisioned schools
          </h2>
          <Table
            columns={recentColumns}
            data={overview.recentSchools}
            caption="Most recent schools"
            emptyMessage="No schools have been provisioned yet."
          />
        </section>
      </div>
    </RouteMeta>
  );
}

function SubscriptionBreakdown({ breakdown }: { breakdown: Record<SubscriptionTier, number> }) {
  const total = Object.values(breakdown).reduce((acc, value) => acc + value, 0);

  if (total === 0) {
    return (
      <p className="mt-6 rounded-md border border-dashed border-[var(--brand-border)]/70 bg-slate-950/40 p-4 text-sm text-[var(--brand-muted)]">
        No subscription data yet. Provision a school to begin tracking uptake.
      </p>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      {Object.entries(breakdown).map(([tier, value]) => {
        const label = SUBSCRIPTION_LABELS[tier as SubscriptionTier];
        const percentage = value === 0 ? 0 : Math.round((value / total) * 100);
        return (
          <div key={tier}>
            <div className="flex items-center justify-between text-sm font-medium text-[var(--brand-surface-contrast)]">
              <span>{label}</span>
              <span className="text-[var(--brand-muted)]">
                {value} • {percentage}%
              </span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-slate-900/60">
              <div
                className="h-2 rounded-full bg-[var(--brand-primary)] transition-all"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RevenueSummary({
  total,
  byTenant
}: {
  total: number;
  byTenant: Array<{ tenantId: string; amount: number }>;
}) {
  if (byTenant.length === 0) {
    return (
      <p className="mt-6 rounded-md border border-dashed border-[var(--brand-border)]/70 bg-slate-950/40 p-4 text-sm text-[var(--brand-muted)]">
        No payments recorded yet.
      </p>
    );
  }

  const topTenants = [...byTenant].sort((a, b) => b.amount - a.amount).slice(0, 5);

  return (
    <div className="mt-6 space-y-4">
      <div className="rounded-lg border border-[var(--brand-border)]/60 bg-slate-950/40 p-4 text-sm">
        <p className="text-xs uppercase tracking-wide text-[var(--brand-muted)]">Total processed</p>
        <p className="mt-1 text-2xl font-semibold text-[var(--brand-surface-contrast)]">
          {currencyFormatter.format(total)}
        </p>
      </div>
      <div>
        <p className="mb-2 text-xs uppercase tracking-wide text-[var(--brand-muted)]">
          Top performing tenants
        </p>
        <ul className="space-y-1 text-sm text-[var(--brand-surface-contrast)]">
          {topTenants.map((entry) => (
            <li
              key={entry.tenantId}
              className="flex items-center justify-between rounded-md border border-transparent bg-slate-900/60 px-3 py-2"
            >
              <span className="font-medium">{entry.tenantId.slice(0, 8)}…</span>
              <span>{currencyFormatter.format(entry.amount)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default SuperuserOverviewPage;
