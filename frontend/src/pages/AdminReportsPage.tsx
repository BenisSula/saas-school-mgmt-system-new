import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  api,
  type AcademicTerm,
  type AttendanceAggregate,
  type FeeAggregate,
  type GradeAggregate,
  type StudentRecord
} from '../lib/api';
import { Button } from '../components/ui/Button';
import { Table } from '../components/ui/Table';
import { Input } from '../components/ui/Input';
import { DatePicker } from '../components/ui/DatePicker';
import { Select } from '../components/ui/Select';
import { StatusBanner } from '../components/ui/StatusBanner';
import { useAsyncFeedback } from '../hooks/useAsyncFeedback';
import { sanitizeIdentifier } from '../lib/sanitize';
import { exportToJSON } from '../lib/utils/export';

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
  const [loading, setLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [terms, setTerms] = useState<AcademicTerm[]>([]);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [selectedReportStudentId, setSelectedReportStudentId] = useState('');
  const [selectedReportTermId, setSelectedReportTermId] = useState('');
  const { status, message, setInfo, setSuccess, setError, clear } = useAsyncFeedback();

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

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [termsList, studentsList] = await Promise.all([api.listTerms(), api.listStudents()]);
        if (cancelled) return;
        setTerms(termsList);
        setStudents(studentsList);
        if (termsList.length > 0) {
          setSelectedReportTermId((current) => current || termsList[0].id);
        }
        if (studentsList.length > 0) {
          setSelectedReportStudentId((current) => current || studentsList[0].id);
        }
      } catch (error) {
        if (!cancelled) {
          const message = (error as Error).message;
          setError(message);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setError]);

  async function runAttendanceReport() {
    try {
      setLoading(true);
      clear();
      const data = await api.getAttendanceReport({
        from: attendanceFilters.from || undefined,
        to: attendanceFilters.to || undefined,
        classId: attendanceFilters.classId || undefined
      });
      setAttendanceData(data);
      if (data.length === 0) {
        setInfo('No attendance records match the selected filters.');
      } else {
        setSuccess('Attendance report updated.');
      }
      toast.success('Attendance report refreshed.');
    } catch (error) {
      const message = (error as Error).message;
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function exportTermReport() {
    if (!selectedReportStudentId || !selectedReportTermId) {
      setInfo('Select both a student and term to generate a printable report.');
      return;
    }
    try {
      setReportLoading(true);
      clear();
      const blob = await api.admin.exportTermReport({
        studentId: selectedReportStudentId,
        termId: selectedReportTermId
      });
      const student = students.find((item) => item.id === selectedReportStudentId);
      const studentName = student
        ? `${student.first_name} ${student.last_name}`.replace(/\s+/g, '_')
        : 'student';
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `term-report-${studentName}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
      setSuccess('Printable term report generated.');
      toast.success('Term report downloaded.');
    } catch (error) {
      const message = (error as Error).message;
      setError(message);
      toast.error(message);
    } finally {
      setReportLoading(false);
    }
  }

  async function runGradeReport() {
    if (!examId) {
      setInfo('Provide an exam ID to fetch grade distribution.');
      return;
    }
    try {
      setLoading(true);
      clear();
      const data = await api.getGradeReport(examId);
      setGradeData(data);
      if (data.length === 0) {
        setInfo('No grade data available for this exam.');
      } else {
        setSuccess('Grade report updated.');
      }
      toast.success('Grade report refreshed.');
    } catch (error) {
      const message = (error as Error).message;
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function runFeeReport() {
    try {
      setLoading(true);
      clear();
      const data = await api.getFeeReport(feeStatus || undefined);
      setFeeData(data);
      if (data.length === 0) {
        setInfo('No invoices matched the selected status.');
      } else {
        setSuccess('Fee report updated.');
      }
      toast.success('Fee report refreshed.');
    } catch (error) {
      const message = (error as Error).message;
      setError(message);
      toast.error(message);
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

      {message ? <StatusBanner status={status} message={message} onDismiss={clear} /> : null}

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
              onClick={() => exportToJSON(attendanceData, 'attendance-report')}
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
              setAttendanceFilters((state) => ({
                ...state,
                classId: sanitizeIdentifier(event.target.value)
              }))
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
              onClick={() => exportToJSON(gradeData, 'grades-report')}
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
            onChange={(event) => setExamId(sanitizeIdentifier(event.target.value))}
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
              onClick={() => exportToJSON(feeData, 'fees-report')}
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

      <section className="rounded-lg border border-[var(--brand-border)] bg-slate-900/60 p-6 shadow-lg">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Printable term reports</h2>
            <p className="text-sm text-slate-400">
              Generate a PDF-ready performance summary for a learner within a chosen academic term.
            </p>
          </div>
        </header>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Select
            label="Student"
            value={selectedReportStudentId}
            onChange={(event) => setSelectedReportStudentId(event.target.value)}
            options={students.map((student) => ({
              value: student.id,
              label: `${student.first_name} ${student.last_name}`
            }))}
          />
          <Select
            label="Term"
            value={selectedReportTermId}
            onChange={(event) => setSelectedReportTermId(event.target.value)}
            options={terms.map((term) => ({
              value: term.id,
              label: term.name
            }))}
          />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button
            onClick={exportTermReport}
            loading={reportLoading}
            disabled={!students.length || !terms.length}
          >
            Download term report PDF
          </Button>
        </div>
      </section>
    </div>
  );
}

export default AdminReportsPage;
