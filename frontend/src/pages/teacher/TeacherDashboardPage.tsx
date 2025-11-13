import { useEffect, useMemo, useState } from 'react';
import RouteMeta from '../../components/layout/RouteMeta';
import { DashboardSkeleton } from '../../components/ui/DashboardSkeleton';
import { StatusBanner } from '../../components/ui/StatusBanner';
import { Table, type TableColumn } from '../../components/ui/Table';
import { api, type TeacherAssignmentSummary, type TeacherOverview } from '../../lib/api';

interface StatCard {
  title: string;
  value: number;
  description: string;
}

function buildStatCards(summary: TeacherOverview['summary']): StatCard[] {
  return [
    {
      title: 'Classes',
      value: summary.totalClasses,
      description: 'Active teaching groups'
    },
    {
      title: 'Subjects',
      value: summary.totalSubjects,
      description: 'Current assignments'
    },
    {
      title: 'Class teacher roles',
      value: summary.classTeacherRoles,
      description: 'Homeroom responsibilities'
    },
    {
      title: 'Drop requests',
      value: summary.pendingDropRequests,
      description: 'Assignments awaiting admin review'
    }
  ];
}

function getAssignmentColumns(): TableColumn<TeacherAssignmentSummary>[] {
  return [
    {
      header: 'Subject',
      key: 'subjectName'
    },
    {
      header: 'Class',
      key: 'className'
    },
    {
      header: 'Role',
      render: (row) =>
        row.isClassTeacher ? (
          <span className="rounded bg-emerald-500/20 px-2 py-1 text-xs font-semibold text-emerald-200">
            Classroom teacher
          </span>
        ) : (
          <span className="text-xs uppercase tracking-wide text-[var(--brand-muted)]">
            Subject teacher
          </span>
        )
    },
    {
      header: 'Status',
      render: (row) =>
        row.metadata?.dropRequested ? (
          <span className="rounded bg-amber-500/20 px-2 py-1 text-xs font-semibold text-amber-200">
            Drop requested
          </span>
        ) : (
          <span className="text-xs text-[var(--brand-muted)]">Active</span>
        )
    }
  ];
}

export default function TeacherDashboardPage() {
  const [overview, setOverview] = useState<TeacherOverview | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await api.teacher.getOverview();
        if (!cancelled) {
          setOverview(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const statCards = useMemo(() => {
    if (!overview) return [];
    return buildStatCards(overview.summary);
  }, [overview]);

  if (loading) {
    return (
      <RouteMeta title="Teacher dashboard">
        <DashboardSkeleton />
      </RouteMeta>
    );
  }

  if (error) {
    return (
      <RouteMeta title="Teacher dashboard">
        <StatusBanner status="error" message={error} />
      </RouteMeta>
    );
  }

  if (!overview) {
    return (
      <RouteMeta title="Teacher dashboard">
        <StatusBanner status="info" message="No overview data available yet." />
      </RouteMeta>
    );
  }

  return (
    <RouteMeta title="Teacher dashboard">
      <div className="space-y-8">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold text-[var(--brand-surface-contrast)]">
            Welcome back, {overview.teacher.name.split(' ')[0]}
          </h1>
          <p className="text-sm text-[var(--brand-muted)]">
            Monitor your classes, track assessments, and stay on top of homeroom duties from one
            dashboard.
          </p>
        </header>

        <section
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          aria-label="Teaching overview statistics"
        >
          {statCards.map((card) => (
            <article
              key={card.title}
              className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-5 shadow-sm"
            >
              <p className="text-xs uppercase tracking-wide text-[var(--brand-muted)]">
                {card.title}
              </p>
              <p className="mt-3 text-3xl font-semibold text-[var(--brand-surface-contrast)]">
                {card.value}
              </p>
              <p className="mt-1 text-xs text-[var(--brand-muted)]">{card.description}</p>
            </article>
          ))}
        </section>

        <section className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
          <header className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[var(--brand-surface-contrast)]">
                Active assignments
              </h2>
              <p className="text-sm text-[var(--brand-muted)]">
                Classes and subjects currently assigned to you. Drop requests show as pending until
                approved by an administrator.
              </p>
            </div>
          </header>
          <Table
            columns={getAssignmentColumns()}
            data={overview.assignments}
            caption="Teaching assignments"
            emptyMessage="No class assignments yet. Administrators will provision your teaching load."
          />
        </section>
      </div>
    </RouteMeta>
  );
}
