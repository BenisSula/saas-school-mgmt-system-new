import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import RouteMeta from '../../components/layout/RouteMeta';
import { StatusBanner } from '../../components/ui/StatusBanner';
import { Table, type TableColumn } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { DashboardSkeleton } from '../../components/ui/DashboardSkeleton';
import {
  api,
  type TeacherClassRosterEntry,
  type TeacherClassSummary,
  type TeacherAssignmentSummary,
} from '../../lib/api';
import { extractPaginatedData } from '../../lib/api/pagination';
import { toast } from 'sonner';

interface SubjectRow {
  id: string;
  name: string;
  code: string | null;
  assignmentId: string;
  isClassTeacher: boolean;
  metadata: Record<string, unknown>;
}

const rosterColumns: TableColumn<TeacherClassRosterEntry>[] = [
  {
    header: 'Student',
    render: (row) => (
      <div>
        <p className="font-medium text-[var(--brand-surface-contrast)]">
          {row.first_name} {row.last_name}
        </p>
        {row.admission_number ? (
          <p className="text-xs text-[var(--brand-muted)]">Adm: {row.admission_number}</p>
        ) : null}
      </div>
    ),
  },
  {
    header: 'Contacts',
    render: (row) =>
      Array.isArray(row.parent_contacts) && row.parent_contacts.length > 0 ? (
        <div className="text-xs text-[var(--brand-muted)]">
          {(row.parent_contacts as string[]).join(', ')}
        </div>
      ) : (
        <span className="text-xs text-[var(--brand-muted)]">Not provided</span>
      ),
  },
];

function SubjectBadge({ subject }: { subject: SubjectRow }) {
  const status = subject.metadata?.dropRequested ? 'Pending drop' : 'Active';
  const statusClass = subject.metadata?.dropRequested
    ? 'bg-amber-500/20 text-amber-200'
    : 'bg-[var(--brand-primary)]/20 text-[var(--brand-primary-contrast)]';
  return (
    <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${statusClass}`}>
      {status}
    </span>
  );
}

export default function TeacherClassesPage() {
  const navigate = useNavigate();
  const [classes, setClasses] = useState<TeacherClassSummary[]>([]);
  const [assignments, setAssignments] = useState<Record<string, TeacherAssignmentSummary>>({});
  const [viewMode, setViewMode] = useState<'all' | 'homeroom'>('all');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [roster, setRoster] = useState<TeacherClassRosterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [rostering, setRostering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const homeroomClasses = useMemo(() => classes.filter((clazz) => clazz.isClassTeacher), [classes]);

  const filteredClasses = useMemo(
    () => (viewMode === 'all' ? classes : homeroomClasses),
    [classes, homeroomClasses, viewMode]
  );

  const selectedClass = useMemo(
    () => classes.find((clazz) => clazz.id === selectedClassId) ?? null,
    [classes, selectedClassId]
  );

  const subjects: SubjectRow[] = useMemo(() => {
    if (!selectedClass) return [];
    return selectedClass.subjects.map((subject) => ({
      ...subject,
      isClassTeacher: selectedClass.isClassTeacher,
      metadata: assignments[subject.assignmentId]?.metadata ?? {},
    }));
  }, [assignments, selectedClass]);

  const loadClasses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Use new API endpoints
      const [classInfos, overview] = await Promise.all([
        api.teachers.getMyClasses(),
        api.teacher.getOverview(),
      ]);

      // Build assignment map for metadata lookup
      const assignmentMap: Record<string, TeacherAssignmentSummary> = {};
      overview.assignments.forEach((assignment) => {
        assignmentMap[assignment.assignmentId] = assignment;
      });
      setAssignments(assignmentMap);

      // Group assignments by classId to build TeacherClassSummary structure
      const assignmentsByClass = new Map<string, TeacherAssignmentSummary[]>();
      overview.assignments.forEach((assignment) => {
        const existing = assignmentsByClass.get(assignment.classId) || [];
        existing.push(assignment);
        assignmentsByClass.set(assignment.classId, existing);
      });

      // Build TeacherClassSummary[] by combining classInfos with assignments
      const classSummaries: TeacherClassSummary[] = classInfos.map((classInfo) => {
        const classAssignments = assignmentsByClass.get(classInfo.id) || [];

        // Determine if teacher is class teacher (any assignment with isClassTeacher=true)
        const isClassTeacher = classAssignments.some((a) => a.isClassTeacher);

        // Build subjects array from assignments
        const subjects = classAssignments.map((assignment) => ({
          id: assignment.subjectId,
          name: assignment.subjectName,
          code: assignment.subjectCode,
          assignmentId: assignment.assignmentId,
        }));

        return {
          id: classInfo.id,
          name: classInfo.name,
          isClassTeacher,
          subjects,
        };
      });

      setClasses(classSummaries);

      if (classSummaries.length > 0) {
        setSelectedClassId((current) => current || classSummaries[0].id);
        const firstSubject = classSummaries[0].subjects[0];
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
    if (filteredClasses.length === 0) {
      setSelectedClassId('');
      setRoster([]);
      return;
    }
    if (!filteredClasses.some((clazz) => clazz.id === selectedClassId)) {
      setSelectedClassId(filteredClasses[0].id);
    }
  }, [filteredClasses, selectedClassId]);

  useEffect(() => {
    if (!selectedClass) {
      setSelectedSubjectId('');
      return;
    }
    const subject =
      selectedClass.subjects.find((entry) => entry.id === selectedSubjectId) ??
      selectedClass.subjects[0];
    setSelectedSubjectId(subject ? subject.id : '');
  }, [selectedClass, selectedSubjectId]);

  const loadRoster = async () => {
    if (!selectedClassId) {
      toast.error('Select a class to view the roster.');
      return;
    }
    setRostering(true);
    try {
      // Use new API endpoint
      const studentsData = await api.teachers.getMyStudents({ classId: selectedClassId });
      const students = extractPaginatedData(studentsData);

      // Convert TeacherStudent[] to TeacherClassRosterEntry[] format
      const rosterEntries: TeacherClassRosterEntry[] = students.map((student) => ({
        id: student.id,
        first_name: student.first_name,
        last_name: student.last_name,
        admission_number: student.admission_number || null,
        parent_contacts: [], // Parent contacts not available in new API
        class_id: student.class_id || null,
      }));

      setRoster(rosterEntries);
      if (rosterEntries.length === 0) {
        toast.info('No students found for this class.');
      } else {
        toast.success('Loaded class roster.');
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setRostering(false);
    }
  };

  const requestDrop = async (assignmentId: string) => {
    try {
      const updated = await api.teacher.dropSubject(assignmentId);
      setAssignments((current) => ({
        ...current,
        [assignmentId]: updated,
      }));
      toast.success('Drop request submitted.');
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  if (loading) {
    return (
      <RouteMeta title="My classes">
        <DashboardSkeleton />
      </RouteMeta>
    );
  }

  if (error) {
    return (
      <RouteMeta title="My classes">
        <StatusBanner status="error" message={error} />
      </RouteMeta>
    );
  }

  if (classes.length === 0) {
    return (
      <RouteMeta title="My classes">
        <StatusBanner
          status="info"
          message="No classes assigned yet. Check back after an administrator provisions your timetable."
        />
      </RouteMeta>
    );
  }

  return (
    <RouteMeta title="My classes">
      <div className="space-y-6">
        <header className="space-y-2">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-[var(--brand-surface-contrast)]">
                Manage your classes
              </h1>
              <p className="text-sm text-[var(--brand-muted)]">
                Review subject allocations, request reassignments, and keep track of classroom
                rosters.
              </p>
            </div>
            <Link to="/dashboard/teacher/students">
              <Button variant="outline">View Students</Button>
            </Link>
          </div>
        </header>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={viewMode === 'all' ? 'solid' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('all')}
          >
            All classes ({classes.length})
          </Button>
          <Button
            variant={viewMode === 'homeroom' ? 'solid' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('homeroom')}
            disabled={homeroomClasses.length === 0}
            className={homeroomClasses.length === 0 ? 'opacity-60' : ''}
          >
            Classroom teacher ({homeroomClasses.length})
          </Button>
        </div>

        {viewMode === 'homeroom' && homeroomClasses.length === 0 ? (
          <StatusBanner
            status="info"
            message="You are not assigned as a classroom teacher for any classes yet."
          />
        ) : null}

        <section className="grid gap-4 md:grid-cols-3">
          <Select
            label="Class"
            value={selectedClassId}
            onChange={(event) => setSelectedClassId(event.target.value)}
            disabled={filteredClasses.length === 0}
            options={filteredClasses.map((clazz) => ({
              value: clazz.id,
              label: `${clazz.name}${clazz.isClassTeacher ? ' · Homeroom' : ''}`,
            }))}
          />
          <Select
            label="Subject"
            value={selectedSubjectId}
            onChange={(event) => setSelectedSubjectId(event.target.value)}
            disabled={subjects.length === 0}
            options={subjects.map((subject) => ({
              value: subject.id,
              label: subject.code ? `${subject.name} (${subject.code})` : subject.name,
            }))}
          />
          <div className="flex items-end justify-start gap-2">
            <Button
              onClick={() => void loadRoster()}
              loading={rostering}
              disabled={!selectedClassId}
            >
              Load roster
            </Button>
            <Button
              variant="outline"
              disabled={
                !selectedSubjectId ||
                !subjects.find((subject) => subject.id === selectedSubjectId)?.assignmentId
              }
              onClick={() => {
                const subject = subjects.find((entry) => entry.id === selectedSubjectId);
                if (!subject) return;
                if (subject.metadata?.dropRequested) {
                  toast.info('Drop request already submitted.');
                  return;
                }
                void requestDrop(subject.assignmentId);
              }}
            >
              Request drop
            </Button>
          </div>
        </section>

        <section className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
          <header className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[var(--brand-surface-contrast)]">
                Subject allocations
              </h2>
              <p className="text-sm text-[var(--brand-muted)]">
                Each subject under this class reflects an active teaching assignment. Drop requests
                notify administrators for reassignment.
              </p>
            </div>
          </header>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {subjects.map((subject) => (
              <article
                key={subject.id}
                className="space-y-2 rounded-lg border border-[var(--brand-border)] bg-black/15 p-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[var(--brand-surface-contrast)]">
                      {subject.name}
                    </p>
                    <p className="text-xs uppercase tracking-wide text-[var(--brand-muted)]">
                      {subject.code ?? 'No code'}
                    </p>
                  </div>
                  <SubjectBadge subject={subject} />
                </div>
                {subject.isClassTeacher ? (
                  <p className="text-xs font-medium text-emerald-200">Homeroom responsibilities</p>
                ) : null}
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
          <header className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[var(--brand-surface-contrast)]">
                Class roster
              </h2>
              <p className="text-sm text-[var(--brand-muted)]">
                View the current students enrolled in this class. Load the roster to begin marking
                attendance or reviewing student records.
              </p>
            </div>
          </header>
          <Table
            columns={rosterColumns}
            data={roster}
            caption="Enrolled students"
            emptyMessage="Load the roster for the selected class to view students."
          />
        </section>

        {selectedClass?.isClassTeacher ? (
          <section className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-6 shadow-sm">
            <header className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-emerald-100">Homeroom spotlight</h2>
                <p className="text-sm text-emerald-200/80">
                  You are the classroom teacher for {selectedClass.name}. Quickly jump to your core
                  homeroom workflows using the shortcuts below.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => navigate('/dashboard/teacher/attendance')}
                >
                  Mark attendance
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => navigate('/dashboard/teacher/reports')}
                >
                  View class report
                </Button>
              </div>
            </header>
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              <article className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-50">
                <p className="text-xs uppercase tracking-wide text-emerald-200/80">Roster size</p>
                <p className="mt-1 text-2xl font-semibold">
                  {roster.length > 0 ? roster.length : '—'}
                </p>
                <p className="text-xs text-emerald-200/80">Load the roster to refresh the count.</p>
              </article>
              <article className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-50">
                <p className="text-xs uppercase tracking-wide text-emerald-200/80">Subjects</p>
                <p className="mt-1 text-2xl font-semibold">{subjects.length}</p>
                <p className="text-xs text-emerald-200/80">Aligned to this class.</p>
              </article>
              <article className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-50">
                <p className="text-xs uppercase tracking-wide text-emerald-200/80">Drop requests</p>
                <p className="mt-1 text-2xl font-semibold">
                  {subjects.filter((subject) => subject.metadata?.dropRequested).length || 'None'}
                </p>
                <p className="text-xs text-emerald-200/80">Pending administrative approval.</p>
              </article>
            </div>
          </section>
        ) : null}
      </div>
    </RouteMeta>
  );
}
