import { useState } from 'react';
import Table from '../components/Table';
import type { TableColumn } from '../components/Table';
import { Button } from '../components/Button';

type DraftItem = {
  description: string;
  amount: number;
};

export function AdminInvoicePage() {
  const [studentId, setStudentId] = useState('');
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState<DraftItem[]>([{ description: '', amount: 0 }]);
  const [savedInvoices, setSavedInvoices] = useState<
    Array<{ studentId: string; total: number; dueDate: string }>
  >([]);

  const invoiceColumns: TableColumn<{ studentId: string; total: number; dueDate: string }>[] = [
    { header: 'Student ID', key: 'studentId' },
    {
      header: 'Total',
      render: (row) => `$${row.total.toFixed(2)}`
    },
    {
      header: 'Due Date',
      render: (row) => new Date(row.dueDate).toLocaleDateString()
    }
  ];

  const handleSubmit = () => {
    const total = items.reduce((sum, item) => sum + item.amount, 0);
    setSavedInvoices((current) => [
      { studentId, total, dueDate },
      ...current.slice(0, 4) // keep last few drafts
    ]);
    setStudentId('');
    setItems([{ description: '', amount: 0 }]);
  };

  return (
    <div className="space-y-6">
      <header className="rounded-lg border border-slate-800 bg-slate-900/80 p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-white">Invoice Generation</h1>
        <p className="mt-2 text-sm text-slate-400">
          Issue per-student invoices, attach line items, and sync status with payment providers.
        </p>
      </header>

      <section className="rounded-lg border border-slate-800 bg-slate-900/80 p-6 shadow-sm space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="flex flex-col text-sm text-slate-300">
            <span className="mb-1 text-xs uppercase text-slate-400">Student ID</span>
            <input
              className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              value={studentId}
              onChange={(event) => setStudentId(event.target.value)}
              placeholder="uuid..."
            />
          </label>
          <label className="flex flex-col text-sm text-slate-300">
            <span className="mb-1 text-xs uppercase text-slate-400">Due Date</span>
            <input
              type="date"
              className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />
          </label>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Invoice Items</h2>
            <Button
              variant="outline"
              onClick={() => setItems((current) => [...current, { description: '', amount: 0 }])}
            >
              Add Item
            </Button>
          </div>

          {items.map((item, index) => (
            <div key={index} className="grid gap-3 sm:grid-cols-2">
              <input
                className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                value={item.description}
                onChange={(event) => {
                  const value = event.target.value;
                  setItems((current) =>
                    current.map((entry, entryIndex) =>
                      entryIndex === index ? { ...entry, description: value } : entry
                    )
                  );
                }}
                placeholder="Description"
              />
              <input
                type="number"
                min={0}
                className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                value={item.amount}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setItems((current) =>
                    current.map((entry, entryIndex) =>
                      entryIndex === index ? { ...entry, amount: value } : entry
                    )
                  );
                }}
                placeholder="Amount"
              />
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" onClick={() => setItems([{ description: '', amount: 0 }])}>
            Clear
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!studentId || items.some((item) => !item.description)}
          >
            Generate Invoice
          </Button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-white">Recent Drafts</h2>
        <Table
          data={savedInvoices}
          columns={invoiceColumns}
          emptyMessage="No invoices generated yet."
        />
      </section>
    </div>
  );
}

export default AdminInvoicePage;
