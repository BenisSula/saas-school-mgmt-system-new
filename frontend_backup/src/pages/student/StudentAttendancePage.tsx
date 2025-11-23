import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import RouteMeta from '../../components/layout/RouteMeta';
import { StatusBanner } from '../../components/ui/StatusBanner';
import { Table, type TableColumn } from '../../components/ui/Table';
import { DatePicker } from '../../components/ui/DatePicker';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';
import { api, type AttendanceHistoryItem, type AttendanceHistoryResponse } from '../../lib/api';
import { deriveDateRange, formatDate, formatDateShort } from '../../lib/utils/date';

interface Filters {
  from: string;
  to: string;
}

const ATTENDANCE_RANGES: Array<{ label: string; value: '7' | '30' | '90' | 'all' }> = [
  { label: 'Last 7 days', value: '7' },
  { label: 'Last 30 days', value: '30' },
  { label: 'Last 90 days', value: '90' },
  { label: 'All time', value: 'all' }
];

export default function StudentAttendancePage() {
  const { user } = useAuth();
  const [filters, setFilters] = useState<Filters>(() => deriveDateRange('30'));
  const [timing, setTiming] = useState<'7' | '30' | '90' | 'all'>('30');
  const [response, setResponse] = useState<AttendanceHistoryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAttendance = useCallback(
    async (nextFilters: Filters = filters) => {
      if (!user) return;
      setLoading(true);
      setError(null);
      try {
        const result = await api.getStudentAttendance(user.id, {
          from: nextFilters.from || undefined,
          to: nextFilters.to || undefined
        });
        setResponse(result);
        if (result.history.length === 0) {
          toast.info('No attendance recorded for the selected range.');
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [filters, user]
  );

  const handleQuickRange = (value: '7' | '30' | '90' | 'all') => {
    setTiming(value);
    if (value === 'all') {
      const next = { from: '', to: '' };
      setFilters(next);
      void loadAttendance(next);
      return;
    }
    const next = deriveDateRange(value);
    setFilters(next);
    void loadAttendance(next);
  };

  const applyManualRange = () => {
    setTiming('all');
    void loadAttendance(filters);
  };

  const summary = useMemo(() => {
    if (!response) {
      return {
        present: 0,
        total: 0,
        percentage: 0
      };
    }
    const { present, total, percentage } = response.summary;
    return {
      present,
      total,
      percentage: Math.round(percentage)
    };
  }, [response]);

  const columns: TableColumn<AttendanceHistoryItem>[] = useMemo(
    () => [
      {
        header: 'Date',
        render: (row) => formatDate(row.attendance_date)
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

  return (
    <RouteMeta title="Attendance">
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold text-[var(--brand-surface-contrast)]">
            Attendance history
          </h1>
          <p className="text-sm text-[var(--brand-muted)]">
            Track your attendance percentage, explore recent sessions, and export records for your
            guardians.
          </p>
        </header>

        {error ? <StatusBanner status="error" message={error} /> : null}

        <section className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              title="Sessions attended"
              value={String(summary.present)}
              description="Marked present"
            />
            <SummaryCard
              title="Total sessions"
              value={String(summary.total)}
              description="Recorded in the system"
            />
            <SummaryCard
              title="Attendance rate"
              value={`${summary.percentage}%`}
              description="Across selected range"
            />
            <SummaryCard
              title="Range"
              value={
                timing === 'all'
                  ? 'All time'
                  : `${timing === '7' ? '7' : timing === '30' ? '30' : '90'} days`
              }
              description="Quick filters adjust the time span"
            />
          </div>
        </section>

        <section className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
          <header className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[var(--brand-surface-contrast)]">
                Filter attendance
              </h2>
              <p className="text-xs text-[var(--brand-muted)]">
                Choose a preset range or pick specific start & end dates to refine the table below.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {ATTENDANCE_RANGES.map((range) => (
                <Button
                  key={range.value}
                  variant={timing === range.value ? 'solid' : 'ghost'}
                  size="sm"
                  onClick={() => handleQuickRange(range.value)}
                >
                  {range.label}
                </Button>
              ))}
            </div>
          </header>

          <div className="flex flex-wrap items-end gap-3">
            <DatePicker
              label="From"
              value={filters.from}
              onChange={(event) => setFilters((prev) => ({ ...prev, from: event.target.value }))}
            />
            <DatePicker
              label="To"
              value={filters.to}
              onChange={(event) => setFilters((prev) => ({ ...prev, to: event.target.value }))}
            />
            <Button onClick={applyManualRange} loading={loading}>
              Apply range
            </Button>
          </div>
        </section>

        <section className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
          <header className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[var(--brand-surface-contrast)]">
                Attendance records
              </h2>
              <p className="text-sm text-[var(--brand-muted)]">
                These entries include only confirmed sessions captured by your teachers.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                if (!response || response.history.length === 0) {
                  toast.error('Load attendance before exporting.');
                  return;
                }
                exportHistory(response.history);
              }}
            >
              Export CSV
            </Button>
          </header>
          <Table
            columns={columns}
            data={response?.history ?? []}
            caption="Attendance entries"
            emptyMessage="No entries to display for the selected range."
          />
        </section>
      </div>
    </RouteMeta>
  );
}

interface SummaryCardProps {
  title: string;
  value: string;
  description: string;
}

function SummaryCard({ title, value, description }: SummaryCardProps) {
  return (
    <article className="rounded-lg border border-[var(--brand-border)] bg-black/15 p-4">
      <p className="text-xs uppercase tracking-wide text-[var(--brand-muted)]">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-[var(--brand-surface-contrast)]">{value}</p>
      <p className="text-xs text-[var(--brand-muted)]">{description}</p>
    </article>
  );
}

function exportHistory(history: AttendanceHistoryItem[]) {
  const rows = [['Date', 'Class', 'Status']];
  history.forEach((item) => {
    rows.push([formatDateShort(item.attendance_date), item.class_id ?? '', item.status]);
  });

  const csv = rows
    .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'attendance-history.csv';
  anchor.click();
  URL.revokeObjectURL(url);
}
