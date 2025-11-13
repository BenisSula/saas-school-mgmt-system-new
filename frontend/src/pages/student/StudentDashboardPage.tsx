import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import RouteMeta from '../../components/layout/RouteMeta';
import { StatusBanner } from '../../components/ui/StatusBanner';
import { Button } from '../../components/ui/Button';
import { Table, type TableColumn } from '../../components/ui/Table';
import { useAuth } from '../../context/AuthContext';
import {
  api,
  type AttendanceHistoryItem,
  type AttendanceHistoryResponse,
  type Invoice,
  type StudentProfileDetail,
  type StudentResult
} from '../../lib/api';

interface FeeSummary {
  outstanding: number;
  paidCount: number;
  nextDueDate: string | null;
}

interface AttendanceSummary {
  present: number;
  total: number;
  percentage: number;
  recent: AttendanceHistoryItem[];
}

const RECENT_ATTENDANCE_LIMIT = 7;

export default function StudentDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attendance, setAttendance] = useState<AttendanceSummary>({
    present: 0,
    total: 0,
    percentage: 0,
    recent: []
  });
  const [feeSummary, setFeeSummary] = useState<FeeSummary>({
    outstanding: 0,
    paidCount: 0,
    nextDueDate: null
  });
  const [latestResult, setLatestResult] = useState<StudentResult | null>(null);
  const [profile, setProfile] = useState<StudentProfileDetail | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [attendanceResponse, invoices, profileDetail] = await Promise.all([
          api.getStudentAttendance(user.id),
          api.getStudentInvoices(user.id),
          api.student.getProfile()
        ]);

        if (cancelled) return;

        setAttendance(deriveAttendance(attendanceResponse));
        setFeeSummary(deriveFeeSummary(invoices));
        setProfile(profileDetail);

        try {
          const latestExam = await api.student.getLatestExamId();
          if (!cancelled && latestExam.examId) {
            const result = await api.getStudentResult(user.id, latestExam.examId);
            if (!cancelled) {
              setLatestResult(result);
            }
          } else if (!cancelled) {
            setLatestResult(null);
          }
        } catch (resultError) {
          if (!cancelled) {
            setLatestResult(null);
            if ((resultError as Error).message && import.meta.env.DEV) {
              console.debug('[student-dashboard] Unable to load latest result', resultError);
            }
          }
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
    };

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const outstandingFormatted = useMemo(
    () => `$${feeSummary.outstanding.toFixed(2)}`,
    [feeSummary.outstanding]
  );

  const recentAttendanceColumns: TableColumn<AttendanceHistoryItem>[] = useMemo(
    () => [
      {
        header: 'Date',
        render: (row) => new Date(row.attendance_date).toLocaleDateString()
      },
      {
        header: 'Class',
        render: (row) => row.class_id ?? '—'
      },
      {
        header: 'Status',
        render: (row) => (
          <span
            className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
              row.status === 'present'
                ? 'bg-emerald-500/20 text-emerald-200'
                : row.status === 'late'
                  ? 'bg-amber-500/20 text-amber-200'
                  : 'bg-rose-500/20 text-rose-200'
            }`}
          >
            {row.status.toUpperCase()}
          </span>
        )
      }
    ],
    []
  );

  const gradePercentage = useMemo(() => {
    if (!latestResult || latestResult.breakdown.length === 0) return null;
    const maxScore = latestResult.breakdown.length * 100;
    return Math.round((latestResult.overall_score / maxScore) * 100);
  }, [latestResult]);

  const quickActions = useMemo(
    () => [
      {
        label: 'Profile',
        description: 'Update contact information or request a class change.',
        action: () => navigate('/dashboard/student/profile')
      },
      {
        label: 'Attendance',
        description: 'Review your attendance history and export records.',
        action: () => navigate('/dashboard/student/attendance')
      },
      {
        label: 'Exams & results',
        description: 'Load exam breakdowns, request subject drops, and monitor grades.',
        action: () => navigate('/dashboard/student/results')
      },
      {
        label: 'Fees',
        description: 'Track invoices, payments, and print receipts.',
        action: () => navigate('/dashboard/student/fees')
      },
      {
        label: 'Messages',
        description: 'Stay in touch with teachers and school leadership.',
        action: () => navigate('/dashboard/student/messages')
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
        <StatusBanner status="error" message={error} />
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

        {profile ? (
          <section className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
            <header className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[var(--brand-surface-contrast)]">
                  Profile snapshot
                </h2>
                <p className="text-sm text-[var(--brand-muted)]">
                  Here’s a quick overview of your class placement and enrolled subjects.
                </p>
              </div>
              <Button variant="outline" onClick={() => navigate('/dashboard/student/profile')}>
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
                        title={
                          subject.dropStatus !== 'none'
                            ? `Drop status: ${subject.dropStatus}`
                            : undefined
                        }
                      >
                        {subject.name}
                        {subject.dropStatus === 'pending' ? ' · drop requested' : ''}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <DashboardCard
            title="Attendance rate"
            value={`${attendance.percentage}%`}
            description={`${attendance.present} of ${attendance.total} sessions marked present`}
            accent="bg-emerald-500/15 text-emerald-200"
          />
          <DashboardCard
            title="Outstanding fees"
            value={outstandingFormatted}
            description={
              feeSummary.outstanding === 0
                ? 'All invoices settled'
                : feeSummary.nextDueDate
                  ? `Next due ${new Date(feeSummary.nextDueDate).toLocaleDateString()}`
                  : 'Pending invoices require attention'
            }
            accent="bg-amber-500/15 text-amber-200"
          />
          <DashboardCard
            title="Invoices paid"
            value={String(feeSummary.paidCount)}
            description="Payments successfully recorded"
            accent="bg-sky-500/15 text-sky-200"
          />
          <DashboardCard
            title="Latest grade"
            value={
              latestResult
                ? `${latestResult.grade} (${latestResult.overall_score.toFixed(1)})`
                : 'Check results'
            }
            description={
              latestResult && gradePercentage !== null
                ? `${gradePercentage}% overall · ${latestResult.breakdown.length} subjects`
                : 'Load an exam in the results tab to see your grade.'
            }
            accent="bg-violet-500/15 text-violet-200"
          />
        </section>

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
            <Button variant="outline" onClick={() => navigate('/dashboard/student/attendance')}>
              View full history
            </Button>
          </header>
          <Table
            columns={recentAttendanceColumns}
            data={attendance.recent}
            caption="Most recent attendance entries"
            emptyMessage="No attendance captured yet."
          />
        </section>

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
                <p className="text-xs text-[var(--brand-muted)] mt-1">{action.description}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
          <header className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[var(--brand-surface-contrast)]">
                Request subject changes
              </h2>
              <p className="text-sm text-[var(--brand-muted)]">
                Need to drop or change a subject? Submit a request for administrator review.
              </p>
            </div>
            <Button
              onClick={() => {
                toast.info(
                  'Subject drop requests will notify your guardian and school administrators.'
                );
                navigate('/dashboard/student/results');
              }}
            >
              Start drop request
            </Button>
          </header>
          <p className="text-xs text-[var(--brand-muted)]">
            Subject changes require approval from school administrators to ensure timetable
            alignment.
          </p>
        </section>
      </div>
    </RouteMeta>
  );
}

function deriveAttendance(response: AttendanceHistoryResponse): AttendanceSummary {
  const recent = response.history.slice(-RECENT_ATTENDANCE_LIMIT).reverse();
  return {
    present: response.summary.present,
    total: response.summary.total,
    percentage: Math.round(response.summary.percentage),
    recent
  };
}

function deriveFeeSummary(invoices: Invoice[]): FeeSummary {
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

  return {
    outstanding,
    paidCount,
    nextDueDate: nextDue
  };
}

interface DashboardCardProps {
  title: string;
  value: string;
  description: string;
  accent: string;
}

function DashboardCard({ title, value, description, accent }: DashboardCardProps) {
  return (
    <article
      className={`rounded-xl border border-[var(--brand-border)] bg-black/15 p-5 shadow-sm ${accent}`}
    >
      <p className="text-xs uppercase tracking-wide text-[var(--brand-muted)]">{title}</p>
      <p className="mt-3 text-3xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-[var(--brand-muted)]">{description}</p>
    </article>
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
