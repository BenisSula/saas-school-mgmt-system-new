import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import RouteMeta from '../../components/layout/RouteMeta';
import { StatusBanner } from '../../components/ui/StatusBanner';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { Table, type TableColumn } from '../../components/ui/Table';
import { useAuth } from '../../context/AuthContext';
import {
  api,
  type StudentExamSummary,
  type StudentResult,
  type StudentSubjectSummary,
} from '../../lib/api';

interface DropFeedback {
  subjectId: string;
  status: 'pending' | 'approved' | 'rejected' | 'none';
}

export default function StudentResultsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loadingExam, setLoadingExam] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [examSummaries, setExamSummaries] = useState<StudentExamSummary[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [result, setResult] = useState<StudentResult | null>(null);
  const [subjects, setSubjects] = useState<StudentSubjectSummary[]>([]);
  const [dropStatuses, setDropStatuses] = useState<Record<string, DropFeedback>>({});

  const refreshSubjects = useCallback(async () => {
    const data = await api.student.listSubjects();
    setSubjects(data);
    const mapped: Record<string, DropFeedback> = {};
    data.forEach((entry) => {
      mapped[entry.subjectId] = { subjectId: entry.subjectId, status: entry.dropStatus };
    });
    setDropStatuses(mapped);
  }, []);

  const loadExamResult = useCallback(
    async (examId: string, { signal }: { signal?: AbortSignal } = {}) => {
      if (!user || !examId) {
        setResult(null);
        return;
      }
      setLoadingExam(true);
      setError(null);
      try {
        const fetched = await api.getStudentResult(user.id, examId);
        if (signal?.aborted) return;
        setResult(fetched);
      } catch (err) {
        if (!signal?.aborted) {
          setError((err as Error).message);
          setResult(null);
        }
      } finally {
        if (!signal?.aborted) {
          setLoadingExam(false);
        }
      }
    },
    [user]
  );

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [examList] = await Promise.all([api.student.listExamSummaries(), refreshSubjects()]);
        if (cancelled) return;
        setExamSummaries(examList);
        if (examList.length > 0) {
          const defaultExamId = examList[0].examId;
          setSelectedExamId(defaultExamId);
          await loadExamResult(defaultExamId, { signal: controller.signal });
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
      controller.abort();
    };
  }, [loadExamResult, refreshSubjects, user]);

  const overallPercentage = useMemo(() => {
    if (!result || result.breakdown.length === 0) return null;
    const maxScore = result.breakdown.length * 100;
    return Math.round((result.overall_score / maxScore) * 100);
  }, [result]);

  const selectedExamSummary = useMemo(
    () => examSummaries.find((exam) => exam.examId === selectedExamId) ?? null,
    [examSummaries, selectedExamId]
  );

  const submitDrop = useCallback(
    async (subjectId: string, name: string) => {
      try {
        await api.student.requestSubjectDrop(subjectId);
        toast.success(`Drop request for ${name} submitted.`);
        await refreshSubjects();
      } catch (err) {
        toast.error((err as Error).message);
      }
    },
    [refreshSubjects]
  );

  const renderDropButton = useCallback(
    (subjectName: string) => {
      const subject = findMatchingSubject(subjects, subjectName);
      if (!subject) {
        return (
          <span className="text-xs text-[var(--brand-muted)]">
            Subject not linked to your enrollment.
          </span>
        );
      }
      const status = dropStatuses[subject.subjectId]?.status ?? subject.dropStatus;
      if (status === 'pending') {
        return <span className="text-xs text-amber-300">Drop request pending</span>;
      }
      if (status === 'approved') {
        return <span className="text-xs text-emerald-300">Drop approved</span>;
      }
      if (status === 'rejected') {
        return <span className="text-xs text-rose-300">Drop denied</span>;
      }
      return (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void submitDrop(subject.subjectId, subject.name)}
        >
          Request drop
        </Button>
      );
    },
    [dropStatuses, submitDrop, subjects]
  );

  const breakdownColumns: TableColumn<StudentResult['breakdown'][number]>[] = useMemo(
    () => [
      {
        header: 'Subject',
        key: 'subject',
      },
      {
        header: 'Score',
        render: (row) => (
          <div className="flex items-center gap-3">
            <div className="h-2 w-32 overflow-hidden rounded-full bg-black/30">
              <div
                className="h-full rounded-full bg-[var(--brand-primary)]"
                style={{ width: `${Math.min(100, row.score)}%` }}
              />
            </div>
            <span>{row.score.toFixed(1)}</span>
          </div>
        ),
      },
      {
        header: 'Grade',
        key: 'grade',
      },
      {
        header: 'Actions',
        render: (row) => renderDropButton(row.subject),
      },
    ],
    [renderDropButton]
  );

  if (loading) {
    return (
      <RouteMeta title="Exams & results">
        <div className="space-y-6">
          <div className="h-24 animate-pulse rounded-xl bg-[var(--brand-skeleton)]/50" />
          <div className="h-64 animate-pulse rounded-xl bg-[var(--brand-skeleton)]/30" />
        </div>
      </RouteMeta>
    );
  }

  if (error) {
    return (
      <RouteMeta title="Exams & results">
        <StatusBanner status="error" message={error} />
      </RouteMeta>
    );
  }

  if (examSummaries.length === 0) {
    return (
      <RouteMeta title="Exams & results">
        <StatusBanner
          status="info"
          message="No exam records found yet. Once your teachers publish exam results they will appear here."
        />
      </RouteMeta>
    );
  }

  return (
    <RouteMeta title="Exams & results">
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold text-[var(--brand-surface-contrast)]">
            Exam performance
          </h1>
          <p className="text-sm text-[var(--brand-muted)]">
            Review your exam breakdowns, track subject progress, and submit subject drop requests
            when necessary.
          </p>
        </header>

        <section className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-4">
            <Select
              label="Exam"
              value={selectedExamId}
              onChange={(event) => {
                const nextId = event.target.value;
                setSelectedExamId(nextId);
                void loadExamResult(nextId);
              }}
              options={examSummaries.map((exam) => ({
                value: exam.examId,
                label: exam.name,
              }))}
            />
            <Button
              variant="outline"
              onClick={() => void loadExamResult(selectedExamId)}
              loading={loadingExam}
            >
              Refresh result
            </Button>
          </div>

          {selectedExamSummary ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryTile
                title="Exam date"
                value={
                  selectedExamSummary.examDate
                    ? new Date(selectedExamSummary.examDate).toLocaleDateString()
                    : 'Not available'
                }
              />
              <SummaryTile title="Subject count" value={String(selectedExamSummary.subjectCount)} />
              <SummaryTile
                title="Average score"
                value={
                  selectedExamSummary.averageScore !== null
                    ? `${selectedExamSummary.averageScore.toFixed(1)}%`
                    : '—'
                }
              />
              <SummaryTile
                title="Overall grade"
                value={
                  result ? `${result.grade} (${result.overall_score.toFixed(1)})` : 'Load exam'
                }
              />
            </div>
          ) : null}
        </section>

        {result ? (
          <section className="space-y-4 rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
            <header className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[var(--brand-surface-contrast)]">
                  Subject breakdown
                </h2>
                <p className="text-sm text-[var(--brand-muted)]">
                  Compare subject scores and request drops for subjects you no longer wish to take.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {overallPercentage !== null ? (
                  <span className="rounded-full border border-[var(--brand-border)] bg-black/20 px-3 py-1 text-sm text-[var(--brand-surface-contrast)]">
                    Overall percentage: {overallPercentage}%
                  </span>
                ) : null}
              </div>
            </header>
            <Table
              columns={breakdownColumns}
              data={result.breakdown}
              caption="Exam subject performance"
              emptyMessage="No subjects recorded for this exam."
            />
          </section>
        ) : (
          <StatusBanner
            status="info"
            message="Select an exam from the dropdown above to load detailed results."
          />
        )}
      </div>
    </RouteMeta>
  );
}

function findMatchingSubject(subjects: StudentSubjectSummary[], subjectName: string) {
  const lower = subjectName.trim().toLowerCase();
  return subjects.find((subject) => subject.name.trim().toLowerCase() === lower);
}

interface SummaryTileProps {
  title: string;
  value: string;
}

function SummaryTile({ title, value }: SummaryTileProps) {
  return (
    <article className="rounded-lg border border-[var(--brand-border)] bg-black/15 p-4">
      <p className="text-xs uppercase tracking-wide text-[var(--brand-muted)]">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-[var(--brand-surface-contrast)]">{value}</p>
    </article>
  );
}
