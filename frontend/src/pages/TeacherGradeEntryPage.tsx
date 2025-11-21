import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import Table from '../components/Table';
import type { TableColumn } from '../components/Table';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useAuth } from '../context/AuthContext';
import {
  api,
  type GradeEntryInput,
  type GradeAggregate,
  type TeacherClassRosterEntry,
  type TeacherClassSummary
} from '../lib/api';
import { sanitizeIdentifier, sanitizeText } from '../lib/sanitize';
import { Select } from '../components/ui/Select';
import { StatusBanner } from '../components/ui/StatusBanner';

interface GradeRow extends GradeEntryInput {
  id: string;
  name?: string;
}

export function TeacherGradeEntryPage() {
  const { user } = useAuth();
  const [examId, setExamId] = useState('');
  const [rows, setRows] = useState<GradeRow[]>([
    { id: 'row-0', studentId: '', subject: '', score: 0 }
  ]);
  const [isSaving, setIsSaving] = useState(false);
  const [distributionLoading, setDistributionLoading] = useState(false);
  const [distribution, setDistribution] = useState<GradeAggregate[]>([]);
  const [classes, setClasses] = useState<TeacherClassSummary[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [roster, setRoster] = useState<TeacherClassRosterEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const columns: TableColumn<GradeRow>[] = useMemo(
    () => [
      {
        header: 'Student ID',
        render: (row, index) => (
          <Input
            value={row.studentId}
            onChange={(event) =>
              setRows((current) =>
                current.map((entry, entryIndex) =>
                  entryIndex === index
                    ? { ...entry, studentId: sanitizeIdentifier(event.target.value) }
                    : entry
                )
              )
            }
            placeholder="uuid-1234..."
          />
        )
      },
      {
        header: 'Subject',
        render: (row, index) => (
          <Input
            value={row.subject}
            onChange={(event) =>
              setRows((current) =>
                current.map((entry, entryIndex) =>
                  entryIndex === index
                    ? { ...entry, subject: sanitizeText(event.target.value) }
                    : entry
                )
              )
            }
            placeholder="Mathematics"
          />
        )
      },
      {
        header: 'Score',
        render: (row, index) => (
          <input
            type="number"
            min={0}
            max={100}
            className="w-24 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-right text-sm text-slate-100 focus:border-[var(--brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/40"
            value={row.score}
            onChange={(event) => {
              const value = Number(event.target.value);
              setRows((current) =>
                current.map((entry, entryIndex) =>
                  entryIndex === index
                    ? { ...entry, score: Number.isNaN(value) ? 0 : value }
                    : entry
                )
              );
            }}
          />
        )
      },
      {
        header: 'Remarks',
        render: (row, index) => (
          <Input
            value={row.remarks ?? ''}
            onChange={(event) =>
              setRows((current) =>
                current.map((entry, entryIndex) =>
                  entryIndex === index
                    ? { ...entry, remarks: sanitizeText(event.target.value) }
                    : entry
                )
              )
            }
            placeholder="Optional notes"
          />
        )
      },
      {
        header: '',
        align: 'right',
        render: (_row, index) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setRows((current) => current.filter((_entry, entryIndex) => entryIndex !== index))
            }
            disabled={rows.length === 1}
          >
            Remove
          </Button>
        )
      }
    ],
    [rows.length]
  );

  const loadClasses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Use deprecated API for now as it provides subjects data needed for grade entry
      const data = await api.teacher.listClasses();
      setClasses(data);
      if (data.length > 0) {
        setSelectedClassId((current) => current || data[0].id);
        const firstSubject = data[0].subjects?.[0];
        if (firstSubject) {
          setSelectedSubjectId(firstSubject.id);
        }
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadClasses();
  }, [loadClasses]);

  useEffect(() => {
    const current = classes.find((clazz) => clazz.id === selectedClassId);
    if (!current) {
      setSelectedSubjectId('');
      return;
    }
    const subject =
      current.subjects.find((entry) => entry.id === selectedSubjectId) ?? current.subjects[0];
    setSelectedSubjectId(subject ? subject.id : '');
  }, [classes, selectedClassId, selectedSubjectId]);

  const loadRoster = useCallback(async () => {
    if (!selectedClassId) {
      toast.error('Select a class first.');
      return;
    }
    try {
      const rosterEntries = await api.teacher.getClassRoster(selectedClassId);
      setRoster(rosterEntries);
      if (rosterEntries.length > 0) {
        const subjectName =
          classes
            .find((clazz) => clazz.id === selectedClassId)
            ?.subjects.find((subject) => subject.id === selectedSubjectId)?.name ?? '';
        setRows(
          rosterEntries.map((student, index) => ({
            id: `row-${index}`,
            studentId: student.id,
            subject: subjectName,
            score: 0,
            name: `${student.first_name} ${student.last_name}`
          }))
        );
        toast.success('Roster loaded for grade entry.');
      } else {
        toast.info('No students found for this class.');
      }
    } catch (err) {
      toast.error((err as Error).message);
    }
  }, [classes, selectedClassId, selectedSubjectId]);

  const handleSave = async () => {
    if (!user) {
      toast.error('Sign in to submit grades.');
      return;
    }
    if (!selectedClassId) {
      toast.error('Select a class before saving grades.');
      return;
    }
    if (!examId) {
      toast.error('Provide an exam identifier.');
      return;
    }
    const payload: GradeEntryInput[] = rows
      .filter((row) => row.studentId && row.subject)
      .map(({ studentId, subject, score, remarks }) => ({
        studentId: sanitizeIdentifier(studentId),
        subject: sanitizeText(subject),
        score,
        remarks: remarks ? sanitizeText(remarks) : undefined,
        classId: sanitizeIdentifier(selectedClassId)
      }));

    if (payload.length === 0) {
      toast.error('Add at least one grade entry with a student ID and subject.');
      return;
    }

    setIsSaving(true);
    try {
      const response = await api.bulkUpsertGrades(examId, payload);
      toast.success(`Saved ${response.saved} grade entries.`);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const fetchDistribution = async () => {
    if (!examId) {
      toast.error('Provide an exam identifier first.');
      return;
    }
    setDistributionLoading(true);
    try {
      const report = await api.getGradeReport(sanitizeIdentifier(examId));
      setDistribution(report);
      toast.success('Loaded grade distribution.');
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setDistributionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {error ? <StatusBanner status="error" message={error} /> : null}

      <header className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)]/70 p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-white">Grade Entry</h1>
            <p className="text-sm text-slate-300">
              Enter an exam identifier, capture per-student marks, and sync with the grade service.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Select
              label="Class"
              value={selectedClassId}
              onChange={(event) => setSelectedClassId(event.target.value)}
              options={classes.map((clazz) => ({
                value: clazz.id,
                label: clazz.name
              }))}
            />
            <Select
              label="Subject"
              value={selectedSubjectId}
              onChange={(event) => setSelectedSubjectId(event.target.value)}
              options={
                classes
                  .find((clazz) => clazz.id === selectedClassId)
                  ?.subjects.map((subject) => ({
                    value: subject.id,
                    label: subject.name
                  })) ?? []
              }
            />
            <Input
              label="Exam ID"
              value={examId}
              onChange={(event) => setExamId(sanitizeIdentifier(event.target.value))}
              placeholder="uuid-exam-id"
            />
            <Button variant="outline" onClick={loadRoster} disabled={loading}>
              Load roster
            </Button>
            <Button variant="outline" onClick={fetchDistribution} loading={distributionLoading}>
              Load distribution
            </Button>
            <Button onClick={handleSave} loading={isSaving}>
              Save grades
            </Button>
          </div>
        </div>
      </header>

      <Table columns={columns} data={rows} emptyMessage="Add student entries to record grades." />

      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          onClick={() =>
            setRows((current) => [
              ...current,
              {
                id: `row-${current.length}`,
                studentId: '',
                subject:
                  classes
                    .find((clazz) => clazz.id === selectedClassId)
                    ?.subjects.find((subject) => subject.id === selectedSubjectId)?.name ?? '',
                score: 0
              }
            ])
          }
        >
          Add row
        </Button>
        <Button
          variant="ghost"
          onClick={() => setRows([{ id: 'row-0', studentId: '', subject: '', score: 0 }])}
        >
          Clear
        </Button>
      </div>

      {roster.length > 0 ? (
        <section className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
          <h2 className="text-base font-semibold text-white">
            Loaded roster ({roster.length} students)
          </h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {roster.map((student) => (
              <li key={student.id} className="rounded-md border border-white/10 bg-black/30 p-3">
                <p className="font-medium text-white">
                  {student.first_name} {student.last_name}
                </p>
                <p className="text-xs text-slate-300">
                  {student.admission_number ?? 'No admission number'}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {distribution.length > 0 ? (
        <section className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)]/70 p-6">
          <h2 className="text-lg font-semibold text-white">Grade distribution</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {distribution.map((entry) => (
              <div
                key={`${entry.subject}-${entry.grade}`}
                className="space-y-2 rounded-lg border border-white/10 bg-white/5 p-4"
              >
                <p className="text-sm font-semibold text-white">{entry.subject}</p>
                <p className="text-xs uppercase tracking-wide text-slate-400">Grade</p>
                <p className="text-2xl font-bold text-white">{entry.grade}</p>
                <p className="text-sm text-slate-300">
                  {entry.count} entries · avg {entry.average_score.toFixed(1)}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

export default TeacherGradeEntryPage;
