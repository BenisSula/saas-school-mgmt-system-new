import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import RouteMeta from '../../components/layout/RouteMeta';
import { StatusBanner } from '../../components/ui/StatusBanner';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { Table, type TableColumn } from '../../components/ui/Table';
import { useAuth } from '../../context/AuthContext';
import { api, type Invoice } from '../../lib/api';

type FeeFilter = 'all' | 'pending' | 'partial' | 'paid' | 'overdue' | 'refunded';

const statusStyles: Record<string, string> = {
  pending: 'bg-amber-500/20 text-amber-200',
  partial: 'bg-blue-500/20 text-blue-200',
  paid: 'bg-emerald-500/20 text-emerald-200',
  overdue: 'bg-rose-500/20 text-rose-200',
  refunded: 'bg-purple-500/20 text-purple-200',
};

export default function StudentFeesPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filter, setFilter] = useState<FeeFilter>('all');

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.getStudentInvoices(user.id);
        if (!cancelled) {
          setInvoices(data);
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
    void load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const filteredInvoices = useMemo(() => {
    if (filter === 'all') {
      return invoices;
    }
    return invoices.filter((invoice) => invoice.status === filter);
  }, [filter, invoices]);

  const outstanding = useMemo(
    () =>
      invoices
        .filter((invoice) => invoice.status !== 'paid')
        .reduce((sum, invoice) => sum + invoice.total_amount - invoice.amount_paid, 0),
    [invoices]
  );

  const paidCount = useMemo(
    () => invoices.filter((invoice) => invoice.status === 'paid').length,
    [invoices]
  );

  const nextDueDate = useMemo(() => {
    const upcoming = invoices
      .filter((invoice) => invoice.status !== 'paid')
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
    return upcoming[0]?.due_date ?? null;
  }, [invoices]);

  const tableColumns: TableColumn<Invoice>[] = useMemo(
    () => [
      { header: 'Invoice', key: 'id' },
      {
        header: 'Amount',
        render: (row) => `$${row.total_amount.toFixed(2)}`,
      },
      {
        header: 'Paid',
        render: (row) => `$${row.amount_paid.toFixed(2)}`,
      },
      {
        header: 'Due date',
        render: (row) =>
          row.due_date ? new Date(row.due_date).toLocaleDateString() : 'Not specified',
      },
      {
        header: 'Status',
        render: (row) => (
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              statusStyles[row.status] ?? 'bg-white/10 text-[var(--brand-surface-contrast)]'
            }`}
          >
            {row.status.toUpperCase()}
          </span>
        ),
      },
      {
        header: 'Actions',
        render: (row) => (
          <Button variant="ghost" size="sm" onClick={() => downloadInvoice(row)}>
            Download receipt
          </Button>
        ),
      },
    ],
    []
  );

  if (error) {
    return (
      <RouteMeta title="Fees">
        <StatusBanner status="error" message={error} />
      </RouteMeta>
    );
  }

  return (
    <RouteMeta title="Fees">
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold text-[var(--brand-surface-contrast)]">
            Fee overview
          </h1>
          <p className="text-sm text-[var(--brand-muted)]">
            Track outstanding invoices, monitor payment status, and download receipts for your
            records.
          </p>
        </header>

        <section className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              title="Outstanding balance"
              value={`$${outstanding.toFixed(2)}`}
              description="Total amount waiting to be cleared"
            />
            <SummaryCard
              title="Invoices paid"
              value={String(paidCount)}
              description="Payments successfully recorded"
            />
            <SummaryCard
              title="Upcoming due date"
              value={nextDueDate ? new Date(nextDueDate).toLocaleDateString() : '—'}
              description="Stay ahead of overdue status"
            />
            <SummaryCard
              title="Total invoices"
              value={String(invoices.length)}
              description="Across all academic terms"
            />
          </div>
        </section>

        <section className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
          <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[var(--brand-surface-contrast)]">
                Invoice history
              </h2>
              <p className="text-sm text-[var(--brand-muted)]">
                Apply status filters and export an annual statement at any time.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Select
                label="Status"
                value={filter}
                onChange={(event) => setFilter(event.target.value as FeeFilter)}
                options={[
                  { label: 'All', value: 'all' },
                  { label: 'Pending', value: 'pending' },
                  { label: 'Partial', value: 'partial' },
                  { label: 'Paid', value: 'paid' },
                  { label: 'Overdue', value: 'overdue' },
                  { label: 'Refunded', value: 'refunded' },
                ]}
              />
              <Button
                variant="outline"
                onClick={() => exportStatement(filteredInvoices)}
                loading={loading}
              >
                Export statement
              </Button>
            </div>
          </header>
          <Table
            columns={tableColumns}
            data={filteredInvoices}
            caption="Fee invoices"
            emptyMessage={loading ? 'Loading invoices…' : 'No invoices match the selected filter.'}
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
    <article className="rounded-lg border border-[var(--brand-border)] bg-black/20 p-4">
      <p className="text-xs uppercase tracking-wide text-[var(--brand-muted)]">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-[var(--brand-surface-contrast)]">{value}</p>
      <p className="text-xs text-[var(--brand-muted)]">{description}</p>
    </article>
  );
}

function downloadInvoice(invoice: Invoice) {
  const rows = [
    ['Invoice ID', invoice.id],
    ['Status', invoice.status],
    ['Amount', invoice.total_amount.toFixed(2)],
    ['Amount paid', invoice.amount_paid.toFixed(2)],
    ['Due date', invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : ''],
    ['Created at', invoice.created_at ? new Date(invoice.created_at).toLocaleString() : ''],
  ];
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `invoice-${invoice.id}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function exportStatement(invoices: Invoice[]) {
  if (invoices.length === 0) {
    toast.info('No invoices available for export.');
    return;
  }
  const headers = ['Invoice ID', 'Status', 'Amount', 'Amount paid', 'Due date', 'Created at'];
  const csv = [
    headers.join(','),
    ...invoices.map((invoice) =>
      [
        invoice.id,
        invoice.status,
        invoice.total_amount.toFixed(2),
        invoice.amount_paid.toFixed(2),
        invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : '',
        invoice.created_at ? new Date(invoice.created_at).toLocaleString() : '',
      ]
        .map((cell) => `"${cell.replace(/"/g, '""')}"`)
        .join(',')
    ),
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'fee-statement.csv';
  anchor.click();
  URL.revokeObjectURL(url);
}
