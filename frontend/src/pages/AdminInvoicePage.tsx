import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { FormEvent } from 'react';
import { api, type Invoice, type StudentRecord } from '../lib/api';
import { Table } from '../components/ui/Table';
import { Button } from '../components/ui/Button';
import { DatePicker } from '../components/ui/DatePicker';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { StatusBanner } from '../components/ui/StatusBanner';
import { useAsyncFeedback } from '../hooks/useAsyncFeedback';
import { Modal } from '../components/ui/Modal';

type DraftItem = {
  description: string;
  amount: number;
};

export function AdminInvoicePage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [studentId, setStudentId] = useState('');
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState<DraftItem[]>([{ description: '', amount: 0 }]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const { status, message, setSuccess, setError, clear } = useAsyncFeedback();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      clear();
      const [invoicesData, studentsData] = await Promise.all([
        api.listInvoices({ status: statusFilter || undefined }),
        api.listStudents()
      ]);
      setInvoices(invoicesData);
      setStudents(studentsData);
      if (studentsData.length > 0 && !studentId) {
        setStudentId(studentsData[0].id);
      }
      setSuccess('Invoice data loaded successfully.');
    } catch (error) {
      const errorMessage = (error as Error).message;
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [clear, setError, setSuccess, statusFilter, studentId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!studentId) {
      setError('Please select a student.');
      toast.error('Please select a student.');
      return;
    }

    const validItems = items.filter((item) => item.description.trim() && item.amount > 0);
    if (validItems.length === 0) {
      setError('At least one invoice item with description and amount is required.');
      toast.error('At least one invoice item with description and amount is required.');
      return;
    }

    try {
      clear();
      const payload = {
        studentId,
        dueDate,
        items: validItems.map((item) => ({
          description: item.description.trim(),
          amount: item.amount
        }))
      };

      const created = await api.createInvoice(payload);
      setInvoices((current) => [created, ...current]);
      setStudentId('');
      setItems([{ description: '', amount: 0 }]);
      setShowCreateModal(false);
      setSuccess('Invoice created successfully.');
      toast.success('Invoice created successfully.');
    } catch (error) {
      const errorMessage = (error as Error).message;
      setError(errorMessage);
      toast.error(errorMessage);
    }
  };

  const invoiceColumns = useMemo(
    () => [
      {
        header: 'Student',
        key: 'student_name' as const,
        render: (row: Invoice) => row.student_name || row.student_id || 'Unknown'
      },
      {
        header: 'Admission Number',
        key: 'admission_number' as const,
        render: (row: Invoice) => row.admission_number || 'N/A'
      },
      {
        header: 'Total',
        key: 'total_amount' as const,
        render: (row: Invoice) => `$${Number(row.total_amount).toFixed(2)}`
      },
      {
        header: 'Paid',
        key: 'amount_paid' as const,
        render: (row: Invoice) => `$${Number(row.amount_paid || 0).toFixed(2)}`
      },
      {
        header: 'Status',
        key: 'status' as const,
        render: (row: Invoice) => (
          <span
            className={`rounded-full px-2 py-1 text-xs font-semibold ${
              row.status === 'paid'
                ? 'bg-emerald-500/20 text-emerald-200'
                : row.status === 'partial'
                  ? 'bg-amber-500/20 text-amber-200'
                  : 'bg-rose-500/20 text-rose-200'
            }`}
          >
            {row.status.toUpperCase()}
          </span>
        )
      },
      {
        header: 'Due Date',
        key: 'due_date' as const,
        render: (row: Invoice) =>
          row.due_date ? new Date(row.due_date).toLocaleDateString() : 'N/A'
      }
    ],
    []
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--brand-surface-contrast)]">
            Invoice Generation
          </h1>
          <p className="text-sm text-slate-300">
            Issue per-student invoices, attach line items, and sync status with payment providers.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={loadData} loading={loading}>
            Refresh
          </Button>
          <Button onClick={() => setShowCreateModal(true)}>Create Invoice</Button>
        </div>
      </header>

      {message ? <StatusBanner status={status} message={message} onDismiss={clear} /> : null}

      <section className="rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
        <header className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-[var(--brand-surface-contrast)]">
              All Invoices
            </h2>
            <p className="text-sm text-[var(--brand-muted)]">
              View and manage all invoices for your school.
            </p>
          </div>
          <Select
            label="Filter by Status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            options={[
              { label: 'All Statuses', value: '' },
              { label: 'Pending', value: 'pending' },
              { label: 'Partial', value: 'partial' },
              { label: 'Paid', value: 'paid' },
              { label: 'Overdue', value: 'overdue' },
              { label: 'Refunded', value: 'refunded' }
            ]}
          />
        </header>
        <Table
          columns={invoiceColumns}
          data={invoices}
          emptyMessage="No invoices found. Create your first invoice to get started."
        />
      </section>

      <Modal
        title="Create New Invoice"
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button type="submit" form="invoice-form">
              Generate Invoice
            </Button>
          </>
        }
      >
        <form id="invoice-form" className="space-y-4" onSubmit={handleSubmit}>
          <Select
            label="Student"
            required
            value={studentId}
            onChange={(event) => setStudentId(event.target.value)}
            options={students.map((student) => ({
              value: student.id,
              label: `${student.first_name} ${student.last_name}${student.admission_number ? ` (${student.admission_number})` : ''}`
            }))}
          />
          <DatePicker
            label="Due Date"
            required
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
          />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--brand-surface-contrast)]">
                Invoice Items
              </h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setItems((current) => [...current, { description: '', amount: 0 }])}
              >
                Add Item
              </Button>
            </div>

            {items.map((item, index) => (
              <div key={index} className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
                <Input
                  label={`Item ${index + 1} Description`}
                  placeholder="e.g. Tuition Fee"
                  value={item.description}
                  onChange={(event) => {
                    const value = event.target.value;
                    setItems((current) =>
                      current.map((entry, entryIndex) =>
                        entryIndex === index ? { ...entry, description: value } : entry
                      )
                    );
                  }}
                />
                <Input
                  label="Amount"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  value={item.amount || ''}
                  onChange={(event) => {
                    const value = Number(event.target.value) || 0;
                    setItems((current) =>
                      current.map((entry, entryIndex) =>
                        entryIndex === index ? { ...entry, amount: value } : entry
                      )
                    );
                  }}
                />
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setItems((current) => current.filter((_, i) => i !== index))}
                    disabled={items.length === 1}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-[var(--brand-border)] bg-black/20 p-3">
            <p className="text-sm font-semibold text-[var(--brand-surface-contrast)]">
              Total Amount: $
              {items
                .filter((item) => item.description.trim() && item.amount > 0)
                .reduce((sum, item) => sum + item.amount, 0)
                .toFixed(2)}
            </p>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default AdminInvoicePage;
