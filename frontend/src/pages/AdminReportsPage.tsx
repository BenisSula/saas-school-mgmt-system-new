import React, { useMemo, useState } from 'react';
import { api, type AttendanceAggregate, type FeeAggregate, type GradeAggregate } from '../lib/api';
import { Button } from '../components/ui/Button';
import { Table } from '../components/ui/Table';
import { Input } from '../components/ui/Input';
import { DatePicker } from '../components/ui/DatePicker';
import { Select } from '../components/ui/Select';

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function AdminReportsPage() {
  const [attendanceFilters, setAttendanceFilters] = useState({
    from: '',
    to: '',
    classId: ''
  });
  const [examId, setExamId] = useState('');
  const [feeStatus, setFeeStatus] = useState('');
  const [attendanceData, setAttendanceData] = useState<AttendanceAggregate[]>([]);
  const [gradeData, setGradeData] = useState<GradeAggregate[]>([]);
  const [feeData, setFeeData] = useState<FeeAggregate[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusType, setStatusType] = useState<'info' | 'error'>('info');

  const attendanceColumns = useMemo(
    () => [
      { header: 'Date', key: 'attendance_date' },
      { header: 'Class', key: 'class_id' },
      { header: 'Status', key: 'status' },
      { header: 'Count', key: 'count' }
    ],
    []
  );

  const gradeColumns = useMemo(
    () => [
      { header: 'Subject', key: 'subject' },
      { header: 'Grade', key: 'grade' },
      { header: 'Count', key: 'count' },
      { header: 'Average score', key: 'average_score' }
    ],
    []
  );

  const feeColumns = useMemo(
    () => [
      { header: 'Status', key: 'status' },
      { header: 'Invoices', key: 'invoice_count' },
      { header: 'Total amount', key: 'total_amount' },
      { header: 'Total paid', key: 'total_paid' }
    ],
    []
  );

  async function runAttendanceReport() {
    try {
      setLoading(true);
      setMessage(null);
      const data = await api.getAttendanceReport({
        from: attendanceFilters.from || undefined,
        to: attendanceFilters.to || undefined,
        classId: attendanceFilters.classId || undefined
      });
      setAttendanceData(data);
      setStatusType('info');
    } catch (error) {
      setMessage((error as Error).message);
      setStatusType('error');
    } finally {
      setLoading(false);
    }
  }

  async function runGradeReport() {
    if (!examId) {
      setMessage('Provide an exam ID to fetch grade distribution.');
      setStatusType('error');
      return;
    }
    try {
      setLoading(true);
      setMessage(null);
      const data = await api.getGradeReport(examId);
      setGradeData(data);
      setStatusType('info');
    } catch (error) {
      setMessage((error as Error).message);
      setStatusType('error');
    } finally {
      setLoading(false);
    }
  }

  async function runFeeReport() {
    try {
      setLoading(true);
      setMessage(null);
      const data = await api.getFeeReport(feeStatus || undefined);
      setFeeData(data);
      setStatusType('info');
    } catch (error) {
      setMessage((error as Error).message);
      setStatusType('error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Reports & Exports</h1>
        <p className="text-sm text-slate-300">
          Run cross-cutting reports across attendance, exams, and finance for the current tenant.
        </p>
      </header>

      {message ? (
        <div
          role="status"
          aria-live="polite"
          className={`rounded-md px-4 py-3 text-sm ${
            statusType === 'error'
              ? 'border border-red-500 bg-red-500/10 text-red-200'
              : 'border border-[var(--brand-border)] bg-slate-900/70 text-slate-100'
          }`}
        >
          {message}
        </div>
      ) : null}

      <section className="rounded-lg border border-[var(--brand-border)] bg-slate-900/60 p-6 shadow-lg">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Attendance summary</h2>
            <p className="text-sm text-slate-400">
              Aggregated attendance counts grouped by date, status, and class.
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={runAttendanceReport} loading={loading}>
              Run report
            </Button>
            <Button
              variant="outline"
              onClick={() => downloadJson('attendance-report.json', attendanceData)}
              disabled={attendanceData.length === 0}
            >
              Download JSON
            </Button>
          </div>
        </header>
        <div className="grid gap-4 sm:grid-cols-4">
          <DatePicker
            label="From"
            value={attendanceFilters.from}
            onChange={(event) =>
              setAttendanceFilters((state) => ({ ...state, from: event.target.value }))
            }
          />
          <DatePicker
            label="To"
            value={attendanceFilters.to}
            onChange={(event) =>
              setAttendanceFilters((state) => ({ ...state, to: event.target.value }))
            }
          />
          <Input
            label="Class ID"
            placeholder="e.g. grade-10"
            value={attendanceFilters.classId}
            onChange={(event) =>
              setAttendanceFilters((state) => ({ ...state, classId: event.target.value }))
            }
          />
        </div>
        <div className="mt-4">
          <Table columns={attendanceColumns} data={attendanceData} caption="Attendance summary" />
        </div>
      </section>

      <section className="rounded-lg border border-[var(--brand-border)] bg-slate-900/60 p-6 shadow-lg">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Exam grade distribution</h2>
            <p className="text-sm text-slate-400">
              Visualise grade distribution per subject for a selected exam.
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={runGradeReport} loading={loading}>
              Run report
            </Button>
            <Button
              variant="outline"
              onClick={() => downloadJson('grades-report.json', gradeData)}
              disabled={gradeData.length === 0}
            >
              Download JSON
            </Button>
          </div>
        </header>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Exam ID"
            placeholder="exam-123"
            value={examId}
            onChange={(event) => setExamId(event.target.value)}
          />
          <p className="text-xs text-slate-400">
            Use the exam ID from the examinations module. Future iterations will provide a picker.
          </p>
        </div>
        <div className="mt-4">
          <Table columns={gradeColumns} data={gradeData} caption="Grade distribution" />
        </div>
      </section>

      <section className="rounded-lg border border-[var(--brand-border)] bg-slate-900/60 p-6 shadow-lg">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Fee reconciliation</h2>
            <p className="text-sm text-slate-400">
              Track outstanding invoices and payments processed by the payment gateway.
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={runFeeReport} loading={loading}>
              Run report
            </Button>
            <Button
              variant="outline"
              onClick={() => downloadJson('fees-report.json', feeData)}
              disabled={feeData.length === 0}
            >
              Download JSON
            </Button>
          </div>
        </header>
        <div className="grid gap-4 sm:grid-cols-3">
          <Select
            label="Invoice status"
            value={feeStatus}
            onChange={(event) => setFeeStatus(event.target.value)}
            options={[
              { label: 'All statuses', value: '' },
              { label: 'Pending', value: 'pending' },
              { label: 'Partial', value: 'partial' },
              { label: 'Paid', value: 'paid' },
              { label: 'Overdue', value: 'overdue' },
              { label: 'Refunded', value: 'refunded' }
            ]}
          />
        </div>
        <div className="mt-4">
          <Table columns={feeColumns} data={feeData} caption="Fee summary" />
        </div>
      </section>
    </div>
  );
}

export default AdminReportsPage;

