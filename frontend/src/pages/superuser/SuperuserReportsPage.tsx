import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { RouteMeta } from '../../components/layout/RouteMeta';
import { Button } from '../../components/ui/Button';
import { StatusBanner } from '../../components/ui/StatusBanner';
import { DashboardSkeleton } from '../../components/ui/DashboardSkeleton';
import { api, type PlatformSchool } from '../../lib/api';

type PlatformReportType = 'audit' | 'users' | 'revenue' | 'activity';

export function SuperuserReportsPage() {
  const [schools, setSchools] = useState<PlatformSchool[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await api.superuser.listSchools();
        setSchools(result);
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

  const handleGenerateReport = async (type: PlatformReportType) => {
    setGenerating(type);
    try {
      const result = await api.superuser.generateReport(type);
      toast.success(`${type} report generated successfully`);
      // If report has download URL, could trigger download here
      if (result.downloadUrl) {
        window.open(result.downloadUrl, '_blank');
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setGenerating(null);
    }
  };

  const reportTypes: Array<{
    id: string;
    type: PlatformReportType;
    title: string;
    description: string;
    icon: string;
  }> = [
    {
      id: 'audit',
      type: 'audit',
      title: 'Audit log export',
      description: 'Complete platform audit trail with all user actions and system events',
      icon: '📋'
    },
    {
      id: 'users',
      type: 'users',
      title: 'User directory',
      description: 'Comprehensive list of all platform users with roles and status',
      icon: '👥'
    },
    {
      id: 'revenue',
      type: 'revenue',
      title: 'Revenue summary',
      description: 'Financial report with payment history and subscription analytics',
      icon: '💰'
    },
    {
      id: 'activity',
      type: 'activity',
      title: 'Platform activity',
      description: 'User activity metrics, login patterns, and engagement statistics',
      icon: '📊'
    }
  ];

  if (loading) {
    return (
      <RouteMeta title="Platform reports">
        <DashboardSkeleton />
      </RouteMeta>
    );
  }

  return (
    <RouteMeta title="Platform reports">
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-semibold text-[var(--brand-surface-contrast)]">
            Platform reports
          </h1>
          <p className="text-sm text-[var(--brand-muted)]">
            Surface platform-wide analytics, audit events, and exportable summaries for finance or
            compliance.
          </p>
        </header>

        {error ? <StatusBanner status="error" message={error} /> : null}

        <section className="grid gap-4 md:grid-cols-2" aria-label="Available reports">
          {reportTypes.map((report) => (
            <div
              key={report.id}
              className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm transition hover:border-[var(--brand-primary)]/40 hover:shadow-lg"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl" aria-hidden="true">
                      {report.icon}
                    </span>
                    <h2 className="text-lg font-semibold text-[var(--brand-surface-contrast)]">
                      {report.title}
                    </h2>
                  </div>
                  <p className="mt-2 text-sm text-[var(--brand-muted)]">{report.description}</p>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Button
                  size="sm"
                  onClick={() => handleGenerateReport(report.type)}
                  disabled={generating === report.type}
                >
                  {generating === report.type ? 'Generating...' : 'Generate report'}
                </Button>
                <Button size="sm" variant="outline" disabled>
                  Export CSV
                </Button>
              </div>
            </div>
          ))}
        </section>

        <section aria-label="Platform summary">
          <h2 className="mb-4 text-lg font-semibold text-[var(--brand-surface-contrast)]">
            Platform summary
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-[var(--brand-muted)]">
                Total schools
              </p>
              <p className="mt-2 text-2xl font-semibold text-[var(--brand-surface-contrast)]">
                {schools.length}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-[var(--brand-muted)]">
                Active schools
              </p>
              <p className="mt-2 text-2xl font-semibold text-[var(--brand-surface-contrast)]">
                {schools.filter((s) => s.status === 'active').length}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-[var(--brand-muted)]">
                Total users
              </p>
              <p className="mt-2 text-2xl font-semibold text-[var(--brand-surface-contrast)]">
                {schools.reduce((sum, s) => sum + (s.userCount || 0), 0)}
              </p>
            </div>
          </div>
        </section>
      </div>
    </RouteMeta>
  );
}

export default SuperuserReportsPage;
