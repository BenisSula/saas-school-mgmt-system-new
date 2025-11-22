import { useEffect, useMemo, useState } from 'react';
import RouteMeta from '../../components/layout/RouteMeta';
import { StatusBanner } from '../../components/ui/StatusBanner';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { DashboardSkeleton } from '../../components/ui/DashboardSkeleton';
import { api, type TeacherClassReport, type TeacherClassInfo } from '../../lib/api';
import { toast } from 'sonner';

interface StatPair {
  label: string;
  value: string;
}

function buildAttendanceStats(report: TeacherClassReport): StatPair[] {
  return [
    { label: 'Present', value: String(report.attendance.present) },
    { label: 'Absent', value: String(report.attendance.absent) },
    { label: 'Late', value: String(report.attendance.late) },
    { label: 'Attendance rate', value: `${report.attendance.percentage}%` }
  ];
}

function buildFeeStats(report: TeacherClassReport): StatPair[] {
  return [
    { label: 'Billed', value: `$${report.fees.billed.toFixed(2)}` },
    { label: 'Paid', value: `$${report.fees.paid.toFixed(2)}` },
    { label: 'Outstanding', value: `$${report.fees.outstanding.toFixed(2)}` }
  ];
}

export default function TeacherReportsPage() {
  const [classes, setClasses] = useState<TeacherClassInfo[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [report, setReport] = useState<TeacherClassReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchingReport, setFetchingReport] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedClassName = useMemo(() => {
    const clazz = classes.find((entry) => entry.id === selectedClassId);
    return clazz?.name ?? '';
  }, [classes, selectedClassId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await api.teachers.getMyClasses();
        if (cancelled) return;
        setClasses(data);
        if (data.length > 0) {
          setSelectedClassId((current) => current || data[0].id);
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

  const loadReport = async () => {
    if (!selectedClassId) {
      toast.error('Select a class to load its report.');
      return;
    }
    setFetchingReport(true);
    setError(null);
    try {
      const data = await api.teacher.getClassReport(selectedClassId);
      setReport(data);
      toast.success('Class report ready.');
    } catch (err) {
      setReport(null);
      setError((err as Error).message);
    } finally {
      setFetchingReport(false);
    }
  };

  const downloadPdf = async () => {
    if (!selectedClassId) {
      toast.error('Select a class to export its report.');
      return;
    }
    try {
      const blob = await api.teacher.downloadClassReportPdf(selectedClassId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `class-report-${selectedClassName.replace(/\s+/g, '-').toLowerCase()}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success('Class report downloaded.');
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  if (loading) {
    return (
      <RouteMeta title="Class reports">
        <DashboardSkeleton />
      </RouteMeta>
    );
  }

  if (error && !report) {
    return (
      <RouteMeta title="Class reports">
        <StatusBanner status="error" message={error} />
      </RouteMeta>
    );
  }

  if (classes.length === 0) {
    return (
      <RouteMeta title="Class reports">
        <StatusBanner
          status="info"
          message="No classes assigned yet. Reports will be available once your teaching load is provisioned."
        />
      </RouteMeta>
    );
  }

  return (
    <RouteMeta title="Class reports">
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold text-[var(--brand-surface-contrast)]">
            Generate printable class reports
          </h1>
          <p className="text-sm text-[var(--brand-muted)]">
            Review attendance, academic performance, and financial progress for each class. Export
            the summary as a PDF to share with school leadership or guardians.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-[minmax(220px,260px)_auto]">
          <Select
            label="Class"
            value={selectedClassId}
            onChange={(event) => setSelectedClassId(event.target.value)}
            options={classes.map((clazz) => ({
              value: clazz.id,
              label: clazz.name
            }))}
          />
          <div className="flex items-end gap-2">
            <Button onClick={() => void loadReport()} loading={fetchingReport}>
              Load report
            </Button>
            <Button variant="outline" onClick={() => void downloadPdf()} disabled={!report}>
              Export PDF
            </Button>
          </div>
        </section>

        {error ? <StatusBanner status="error" message={error} /> : null}

        {report ? (
          <section className="space-y-6 rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
            <header>
              <h2 className="text-lg font-semibold text-[var(--brand-surface-contrast)]">
                {report.class.name} · Snapshot
              </h2>
              <p className="text-xs text-[var(--brand-muted)]">
                Generated {new Date(report.generatedAt).toLocaleString()}
              </p>
            </header>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <article className="rounded-lg border border-[var(--brand-border)] bg-black/15 p-4">
                <p className="text-xs uppercase tracking-wide text-[var(--brand-muted)]">
                  Students
                </p>
                <p className="mt-2 text-2xl font-semibold text-[var(--brand-surface-contrast)]">
                  {report.studentCount}
                </p>
              </article>
              {buildAttendanceStats(report).map((stat) => (
                <article
                  key={stat.label}
                  className="rounded-lg border border-[var(--brand-border)] bg-black/15 p-4"
                >
                  <p className="text-xs uppercase tracking-wide text-[var(--brand-muted)]">
                    {stat.label}
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-[var(--brand-surface-contrast)]">
                    {stat.value}
                  </p>
                </article>
              ))}
            </div>

            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--brand-muted)]">
                Academic performance
              </h3>
              {report.grades.length === 0 ? (
                <p className="mt-2 text-sm text-[var(--brand-muted)]">
                  No grades recorded yet for this class.
                </p>
              ) : (
                <ul className="mt-3 space-y-2 text-sm">
                  {report.grades.map((grade) => (
                    <li
                      key={grade.subject}
                      className="flex items-center justify-between rounded-lg border border-[var(--brand-border)] bg-black/10 px-3 py-2"
                    >
                      <span className="font-medium text-[var(--brand-surface-contrast)]">
                        {grade.subject}
                      </span>
                      <span className="text-xs text-[var(--brand-muted)]">
                        {grade.entries} entries · avg {grade.average.toFixed(1)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--brand-muted)]">
                Financial overview
              </h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {buildFeeStats(report).map((stat) => (
                  <article
                    key={stat.label}
                    className="rounded-lg border border-[var(--brand-border)] bg-black/10 p-4 text-sm"
                  >
                    <p className="text-xs uppercase tracking-wide text-[var(--brand-muted)]">
                      {stat.label}
                    </p>
                    <p className="mt-2 text-lg font-semibold text-[var(--brand-surface-contrast)]">
                      {stat.value}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          </section>
        ) : (
          <StatusBanner
            status="info"
            message="Select a class and load the latest data to view a printable summary."
          />
        )}
      </div>
    </RouteMeta>
  );
}

