import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { api, type ExamSummary, type GradeScale } from '../lib/api';
import { Table } from '../components/ui/Table';
import { Button } from '../components/ui/Button';
import { DatePicker } from '../components/ui/DatePicker';
import { Input } from '../components/ui/Input';
import { StatusBanner } from '../components/ui/StatusBanner';
import { useAsyncFeedback } from '../hooks/useAsyncFeedback';
import { Modal } from '../components/ui/Modal';
import type { FormEvent } from 'react';

type ExamRow = {
  id: string;
  name: string;
  examDate: string | null;
  classes: number;
};

type ScaleRow = {
  grade: string;
  min: number;
  max: number;
  remark: string;
};

export function AdminExamConfigPage() {
  const [exams, setExams] = useState<ExamSummary[]>([]);
  const [scales, setScales] = useState<GradeScale[]>([]);
  const [loading, setLoading] = useState(true);
  const [examForm, setExamForm] = useState({ name: '', description: '', examDate: '' });
  const [showExamModal, setShowExamModal] = useState(false);
  const { status, message, setSuccess, setError, clear } = useAsyncFeedback();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      clear();
      const [examsData, scalesData] = await Promise.all([api.listExams(), api.getGradeScales()]);
      setExams(examsData);
      setScales(scalesData);
      setSuccess('Exam data loaded successfully.');
    } catch (error) {
      const errorMessage = (error as Error).message;
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [clear, setError, setSuccess]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleCreateExam = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      clear();
      const payload = {
        name: examForm.name.trim(),
        description: examForm.description.trim() || undefined,
        examDate: examForm.examDate || undefined
      };

      if (!payload.name) {
        setError('Exam name is required.');
        toast.error('Exam name is required.');
        return;
      }

      const created = await api.createExam(payload);
      setExams((current) => [created, ...current]);
      setExamForm({ name: '', description: '', examDate: '' });
      setShowExamModal(false);
      setSuccess('Exam created successfully.');
      toast.success('Exam created successfully.');
    } catch (error) {
      const errorMessage = (error as Error).message;
      setError(errorMessage);
      toast.error(errorMessage);
    }
  };

  const examColumns = useMemo(
    () => [
      { header: 'Exam', key: 'name' as const },
      {
        header: 'Exam Date',
        key: 'examDate' as const,
        render: (row: ExamRow) =>
          row.examDate ? new Date(row.examDate).toLocaleDateString() : 'Not scheduled'
      },
      {
        header: 'Classes',
        key: 'classes' as const,
        render: (row: ExamRow) => row.classes.toString()
      }
    ],
    []
  );

  const scaleColumns = useMemo(
    () => [
      { header: 'Grade', key: 'grade' as const },
      {
        header: 'Min',
        key: 'min' as const,
        render: (row: ScaleRow) => row.min.toFixed(2)
      },
      {
        header: 'Max',
        key: 'max' as const,
        render: (row: ScaleRow) => row.max.toFixed(2)
      },
      { header: 'Remarks', key: 'remark' as const }
    ],
    []
  );

  const examRows: ExamRow[] = useMemo(
    () =>
      exams.map((exam) => ({
        id: exam.id,
        name: exam.name,
        examDate: exam.examDate ?? null,
        classes: exam.classes
      })),
    [exams]
  );

  const scaleRows: ScaleRow[] = useMemo(
    () =>
      scales.map((scale) => ({
        grade: scale.grade,
        min: scale.min_score,
        max: scale.max_score,
        remark: scale.remark ?? ''
      })),
    [scales]
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-32 animate-pulse rounded-xl bg-[var(--brand-skeleton)]/60" />
        <div className="h-64 animate-pulse rounded-xl bg-[var(--brand-skeleton)]/40" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--brand-surface-contrast)]">
            Examination Configuration
          </h1>
          <p className="text-sm text-slate-300">
            Schedule exams, manage sessions, and maintain grade boundaries for your school.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={loadData} loading={loading}>
            Refresh
          </Button>
          <Button onClick={() => setShowExamModal(true)}>Create Exam</Button>
        </div>
      </header>

      {message ? <StatusBanner status={status} message={message} onDismiss={clear} /> : null}

      <section className="space-y-4 rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-[var(--brand-surface-contrast)]">
              Upcoming Exams
            </h2>
            <p className="text-sm text-[var(--brand-muted)]">
              All scheduled examinations for your school.
            </p>
          </div>
        </div>
        <Table
          columns={examColumns}
          data={examRows}
          emptyMessage="No exams scheduled yet. Create your first exam to get started."
        />
      </section>

      <section className="space-y-4 rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-[var(--brand-surface-contrast)]">
              Grade Scale
            </h2>
            <p className="text-sm text-[var(--brand-muted)]">
              Grade boundaries used for automatic grade assignment.
            </p>
          </div>
        </div>
        <Table
          columns={scaleColumns}
          data={scaleRows}
          emptyMessage="No grade scales configured. Grade scales are managed at the database level."
        />
      </section>

      <Modal
        title="Create New Exam"
        isOpen={showExamModal}
        onClose={() => setShowExamModal(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowExamModal(false)}>
              Cancel
            </Button>
            <Button type="submit" form="exam-form">
              Create Exam
            </Button>
          </>
        }
      >
        <form id="exam-form" className="space-y-4" onSubmit={handleCreateExam}>
          <Input
            label="Exam Name"
            placeholder="e.g. Term 1 Assessment"
            required
            value={examForm.name}
            onChange={(event) => setExamForm((state) => ({ ...state, name: event.target.value }))}
          />
          <Input
            label="Description"
            placeholder="Optional description"
            value={examForm.description}
            onChange={(event) =>
              setExamForm((state) => ({ ...state, description: event.target.value }))
            }
          />
          <DatePicker
            label="Exam Date"
            value={examForm.examDate}
            onChange={(event) =>
              setExamForm((state) => ({ ...state, examDate: event.target.value }))
            }
          />
        </form>
      </Modal>
    </div>
  );
}

export default AdminExamConfigPage;
