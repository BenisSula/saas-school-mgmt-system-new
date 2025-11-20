import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import RouteMeta from '../../components/layout/RouteMeta';
import { StatusBanner } from '../../components/ui/StatusBanner';
import { Button } from '../../components/ui/Button';
import { DataTable, type DataTableColumn } from '../../components/tables/DataTable';
import { BarChart, type BarChartData } from '../../components/charts/BarChart';
import { LineChart, type LineChartDataPoint } from '../../components/charts/LineChart';
import { StatCard, ChartContainer } from '../../components/charts';
import { Card } from '../../components/ui/Card';
import { useStudentDashboard } from '../../hooks/queries/useDashboardQueries';
import { useAuth } from '../../context/AuthContext';
import { TrendingUp, Calendar, DollarSign, GraduationCap } from 'lucide-react';
import type { AttendanceHistoryItem } from '../../lib/api';
import { formatDate, formatDateShort } from '../../lib/utils/date';
import { StatusBadge } from '../../components/ui/StatusBadge';

const RECENT_ATTENDANCE_LIMIT = 7;

export default function StudentDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { attendance, invoices, profile, result, loading, error } = useStudentDashboard();

  const attendanceSummary = useMemo(() => {
    if (!attendance) return { present: 0, total: 0, percentage: 0, recent: [] };
    const recent = attendance.history.slice(-RECENT_ATTENDANCE_LIMIT).reverse();
    return {
      present: attendance.summary.present,
      total: attendance.summary.total,
      percentage: Math.round(attendance.summary.percentage),
      recent
    };
  }, [attendance]);

  const feeSummary = useMemo(() => {
    if (!invoices) return { outstanding: 0, paidCount: 0, nextDueDate: null };
    const outstanding = invoices.reduce((sum, invoice) => {
      if (invoice.status === 'paid') return sum;
      return sum + (invoice.total_amount - invoice.amount_paid);
    }, 0);

    const paidCount = invoices.filter((invoice) => invoice.status === 'paid').length;
    const nextDue =
      invoices
        .filter((invoice) => invoice.status !== 'paid')
        .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0]
        ?.due_date ?? null;

    return { outstanding, paidCount, nextDueDate: nextDue };
  }, [invoices]);

  const gradePercentage = useMemo(() => {
    if (!result || result.breakdown.length === 0) return null;
    const maxScore = result.breakdown.length * 100;
    return Math.round((result.overall_score / maxScore) * 100);
  }, [result]);

  // Attendance trend chart data
  const attendanceTrend: LineChartDataPoint[] = useMemo(() => {
    if (!attendance?.history) return [];
    return attendance.history.slice(-30).map((item) => ({
      label: formatDateShort(item.attendance_date),
      value: item.status === 'present' ? 1 : item.status === 'late' ? 0.5 : 0
    }));
  }, [attendance]);

  // Subject performance chart (if result available)
  const subjectPerformance: BarChartData[] = useMemo(() => {
    if (!result?.breakdown) return [];
    return result.breakdown.map((subject) => ({
      label: subject.subject,
      value: subject.score,
      color:
        subject.score >= 70 ? 'var(--brand-primary)' : subject.score >= 50 ? '#f59e0b' : '#ef4444'
    }));
  }, [result]);

  // Fee status breakdown
  const feeBreakdown: BarChartData[] = useMemo(() => {
    if (!invoices) return [];
    const paid = invoices.filter((i) => i.status === 'paid').length;
    const pending = invoices.filter((i) => i.status === 'pending').length;
    const overdue = invoices.filter((i) => i.status === 'overdue').length;
    return [
      { label: 'Paid', value: paid, color: '#10b981' },
      { label: 'Pending', value: pending, color: '#f59e0b' },
      { label: 'Overdue', value: overdue, color: '#ef4444' }
    ];
  }, [invoices]);

  const attendanceColumns: DataTableColumn<AttendanceHistoryItem>[] = useMemo(
    () => [
      {
        key: 'attendance_date',
        header: 'Date',
        render: (row) => formatDate(row.attendance_date),
        sortable: true
      },
      {
        key: 'class_id',
        header: 'Class',
        render: (row) => row.class_id ?? '—'
      },
      {
        key: 'status',
        header: 'Status',
        render: (row) => <StatusBadge status={row.status} />
      }
    ],
    []
  );

  const quickActions = useMemo(
    () => [
      {
        label: 'Profile',
        description: 'Update contact information or request a class change.',
        action: () => navigate('/student/profile')
      },
      {
        label: 'Attendance',
        description: 'Review your attendance history and export records.',
        action: () => navigate('/student/attendance')
      },
      {
        label: 'Exams & results',
        description: 'Load exam breakdowns, request subject drops, and monitor grades.',
        action: () => navigate('/student/results')
      },
      {
        label: 'Fees',
        description: 'Track invoices, payments, and print receipts.',
        action: () => navigate('/student/fees')
      },
      {
        label: 'Messages',
        description: 'Stay in touch with teachers and school leadership.',
        action: () => navigate('/student/messages')
      }
    ],
    [navigate]
  );

  const greetingName = useMemo(() => {
    if (profile?.firstName) {
      return profile.firstName;
    }
    if (user?.email) {
      return user.email.split('@')[0];
    }
    return '';
  }, [profile, user]);

  if (loading) {
    return (
      <RouteMeta title="Student dashboard">
        <div className="space-y-6">
          <div className="h-32 animate-pulse rounded-xl bg-[var(--brand-skeleton)]/60" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-32 animate-pulse rounded-xl bg-[var(--brand-skeleton)]/40"
              />
            ))}
          </div>
          <div className="h-64 animate-pulse rounded-xl bg-[var(--brand-skeleton)]/30" />
        </div>
      </RouteMeta>
    );
  }

  if (error) {
    return (
      <RouteMeta title="Student dashboard">
        <StatusBanner status="error" message={(error as Error).message} />
      </RouteMeta>
    );
  }

  return (
    <RouteMeta title="Student dashboard">
      <div className="space-y-8">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold text-[var(--brand-surface-contrast)]">
            Welcome back{greetingName ? `, ${greetingName}` : ''}!
          </h1>
          <p className="text-sm text-[var(--brand-muted)]">
            Keep an eye on your academic progress, attendance consistency, and outstanding tasks.
          </p>
        </header>

        {/* Profile Snapshot */}
        {profile && (
          <Card padding="md">
            <header className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[var(--brand-surface-contrast)]">
                  Profile snapshot
                </h2>
                <p className="text-sm text-[var(--brand-muted)]">
                  Here&apos;s a quick overview of your class placement and enrolled subjects.
                </p>
              </div>
              <Button variant="outline" onClick={() => navigate('/student/profile')}>
                Manage profile
              </Button>
            </header>
            <div className="grid gap-6 lg:grid-cols-[1.5fr_2fr]">
              <dl className="grid gap-4 sm:grid-cols-2">
                <ProfileStat
                  label="Full name"
                  value={`${profile.firstName} ${profile.lastName}`.trim()}
                />
                <ProfileStat label="Class" value={profile.className ?? 'Not assigned'} />
                <ProfileStat
                  label="Admission number"
                  value={profile.admissionNumber ?? 'Not provided'}
                />
                <ProfileStat label="Active subjects" value={`${profile.subjects.length}`} />
              </dl>
              <div>
                <h3 className="text-sm font-semibold text-[var(--brand-surface-contrast)]">
                  Subjects
                </h3>
                {profile.subjects.length === 0 ? (
                  <p className="mt-2 text-sm text-[var(--brand-muted)]">
                    Your subjects will appear here once enrolments are assigned.
                  </p>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {profile.subjects.map((subject) => (
                      <span
                        key={subject.subjectId}
                        className="rounded-full border border-[var(--brand-border)] bg-black/15 px-3 py-1 text-xs text-[var(--brand-surface-contrast)]"
                      >
                        {subject.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Stats Cards */}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Attendance rate"
            value={`${attendanceSummary.percentage}%`}
            change={{
              value: attendanceSummary.percentage,
              label: `${attendanceSummary.present} of ${attendanceSummary.total} sessions`
            }}
            icon={<Calendar className="h-5 w-5" />}
            trend={
              attendanceSummary.percentage >= 80
                ? 'up'
                : attendanceSummary.percentage >= 60
                  ? 'neutral'
                  : 'down'
            }
          />
          <StatCard
            title="Outstanding fees"
            value={`$${feeSummary.outstanding.toFixed(2)}`}
            description={
              feeSummary.outstanding === 0
                ? 'All invoices settled'
                : feeSummary.nextDueDate
                  ? `Next due ${formatDate(feeSummary.nextDueDate)}`
                  : 'Pending invoices require attention'
            }
            icon={<DollarSign className="h-5 w-5" />}
          />
          <StatCard
            title="Invoices paid"
            value={String(feeSummary.paidCount)}
            description="Payments successfully recorded"
            icon={<TrendingUp className="h-5 w-5" />}
          />
          <StatCard
            title="Latest grade"
            value={
              result ? `${result.grade} (${result.overall_score.toFixed(1)})` : 'Check results'
            }
            description={
              result && gradePercentage !== null
                ? `${gradePercentage}% overall · ${result.breakdown.length} subjects`
                : 'Load an exam in the results tab to see your grade.'
            }
            icon={<GraduationCap className="h-5 w-5" />}
          />
        </section>

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          {attendanceTrend.length > 0 && (
            <ChartContainer>
              <LineChart
                data={attendanceTrend}
                title="Attendance Trend (Last 30 Days)"
                height={200}
              />
            </ChartContainer>
          )}
          {subjectPerformance.length > 0 && (
            <ChartContainer>
              <BarChart data={subjectPerformance} title="Subject Performance" height={200} />
            </ChartContainer>
          )}
          {feeBreakdown.length > 0 && (
            <ChartContainer className="lg:col-span-2">
              <BarChart data={feeBreakdown} title="Fee Status Breakdown" height={200} />
            </ChartContainer>
          )}
        </div>

        {/* Attendance Snapshot */}
        <section className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
          <header className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[var(--brand-surface-contrast)]">
                Attendance snapshot
              </h2>
              <p className="text-sm text-[var(--brand-muted)]">
                Recent records help you visualise consistency and spot trends.
              </p>
            </div>
            <Button variant="outline" onClick={() => navigate('/student/attendance')}>
              View full history
            </Button>
          </header>
          <DataTable<AttendanceHistoryItem>
            data={attendanceSummary.recent}
            columns={attendanceColumns}
            pagination={{ pageSize: 10 }}
            emptyMessage="No attendance captured yet."
          />
        </section>

        {/* Quick Actions */}
        <section className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
          <header className="mb-3">
            <h2 className="text-lg font-semibold text-[var(--brand-surface-contrast)]">
              Quick actions
            </h2>
            <p className="text-sm text-[var(--brand-muted)]">
              Jump straight into the tools you use most often.
            </p>
          </header>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {quickActions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={action.action}
                className="rounded-lg border border-[var(--brand-border)] bg-black/20 p-4 text-left transition hover:border-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/10"
              >
                <p className="text-sm font-semibold text-[var(--brand-surface-contrast)]">
                  {action.label}
                </p>
                <p className="mt-1 text-xs text-[var(--brand-muted)]">{action.description}</p>
              </button>
            ))}
          </div>
        </section>
      </div>
    </RouteMeta>
  );
}

interface ProfileStatProps {
  label: string;
  value: string;
}

function ProfileStat({ label, value }: ProfileStatProps) {
  return (
    <div className="rounded-lg border border-[var(--brand-border)] bg-black/10 p-4">
      <p className="text-xs uppercase tracking-wide text-[var(--brand-muted)]">{label}</p>
      <p className="mt-2 text-sm font-semibold text-[var(--brand-surface-contrast)]">{value}</p>
    </div>
  );
}
