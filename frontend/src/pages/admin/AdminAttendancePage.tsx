import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import RouteMeta from '../../components/layout/RouteMeta';
import { useAuth } from '../../context/AuthContext';
import { api, type AttendanceMark, type SchoolClass } from '../../lib/api';
import { DatePicker } from '../../components/ui/DatePicker';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { StatusBanner } from '../../components/ui/StatusBanner';
import { Table } from '../../components/ui/Table';
import { useAsyncFeedback } from '../../hooks/useAsyncFeedback';

type AttendanceStatus = 'present' | 'absent' | 'late';

interface AttendanceRow {
  studentId: string;
  name: string;
  status: AttendanceStatus;
}

function defaultDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function AdminAttendancePage() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [date, setDate] = useState<string>(defaultDate);
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [saving, setSaving] = useState(false);
  const { status, message, setSuccess, setError, clear } = useAsyncFeedback();

  const selectedClass = useMemo(
    () => classes.find((clazz) => clazz.id === selectedClassId) ?? null,
    [classes, selectedClassId]
  );

  const loadClasses = useCallback(async () => {
    setLoadingClasses(true);
    clear();
    try {
      const classList = await api.listClasses();
      setClasses(classList);
      if (classList.length > 0 && !selectedClassId) {
        setSelectedClassId(classList[0].id);
      }
    } catch (err) {
      const errorMessage = (err as Error).message;
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoadingClasses(false);
    }
  }, [clear, setError, selectedClassId]);

  const loadClassRoster = useCallback(
    async (classId: string, attendanceDate: string) => {
      if (!classId || !attendanceDate) return;

      setLoadingRoster(true);
      clear();
      try {
        // Get all students in the class - classId is a UUID, so filter by class_uuid
        const students = await api.listStudents();
        const classStudents = students.filter(
          (s) => s.class_uuid === classId || s.class_id === classId
        );

        // For now, default all to 'present' and let admin update
        // TODO: Fetch individual attendance records for the date if needed
        const attendanceRows: AttendanceRow[] = classStudents.map((student) => ({
          studentId: student.id,
          name: `${student.first_name} ${student.last_name}`,
          status: 'present' as AttendanceStatus
        }));

        setRows(attendanceRows);
      } catch (err) {
        const errorMessage = (err as Error).message;
        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setLoadingRoster(false);
      }
    },
    [clear, setError]
  );

  useEffect(() => {
    void loadClasses();
  }, [loadClasses]);

  useEffect(() => {
    if (selectedClassId && date) {
      void loadClassRoster(selectedClassId, date);
    }
  }, [selectedClassId, date, loadClassRoster]);

  const updateRowStatus = useCallback((studentId: string, newStatus: AttendanceStatus) => {
    setRows((current) =>
      current.map((row) => (row.studentId === studentId ? { ...row, status: newStatus } : row))
    );
  }, []);

  const markAll = useCallback((status: AttendanceStatus) => {
    setRows((current) => current.map((row) => ({ ...row, status })));
  }, []);

  const handleSave = useCallback(async () => {
    if (!selectedClassId || !user) return;

    const records: AttendanceMark[] = rows.map((row) => ({
      studentId: row.studentId,
      classId: selectedClassId,
      status: row.status,
      markedBy: user.id,
      date
    }));

    try {
      setSaving(true);
      clear();
      await api.markAttendance(records);
      setSuccess('Attendance saved successfully.');
      toast.success('Attendance saved successfully.');
      void loadClassRoster(selectedClassId, date);
    } catch (err) {
      const errorMessage = (err as Error).message;
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  }, [selectedClassId, user, date, rows, clear, setError, setSuccess, loadClassRoster]);

  const attendanceColumns = useMemo(
    () => [
      {
        header: 'Student',
        key: 'name' as const,
        render: (row: AttendanceRow) => (
          <div>
            <p className="font-medium text-[var(--brand-surface-contrast)]">{row.name}</p>
            <p className="text-xs text-[var(--brand-muted)]">{row.studentId}</p>
          </div>
        )
      },
      {
        header: 'Status',
        key: 'status' as const,
        render: (row: AttendanceRow) => (
          <select
            aria-label={`Attendance status for ${row.name}`}
            className="rounded-md border border-[var(--brand-border)] bg-black/20 px-3 py-2 text-sm text-[var(--brand-surface-contrast)] focus:border-[var(--brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/40"
            value={row.status}
            onChange={(event) =>
              updateRowStatus(row.studentId, event.target.value as AttendanceStatus)
            }
          >
            <option value="present">Present</option>
            <option value="absent">Absent</option>
            <option value="late">Late</option>
          </select>
        )
      }
    ],
    [updateRowStatus]
  );

  return (
    <RouteMeta title="Attendance tracking">
      <div className="space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--brand-surface-contrast)]">
              Attendance Management
            </h1>
            <p className="text-sm text-slate-300">
              Track and manage attendance for all classes in your school.
            </p>
          </div>
          <Button variant="outline" onClick={loadClasses} loading={loadingClasses}>
            Refresh
          </Button>
        </header>

        {message ? <StatusBanner status={status} message={message} onDismiss={clear} /> : null}

        <section className="rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Class"
              value={selectedClassId}
              onChange={(event) => setSelectedClassId(event.target.value)}
              options={classes.map((clazz) => ({
                value: clazz.id,
                label: clazz.name
              }))}
              disabled={loadingClasses || classes.length === 0}
            />
            <DatePicker
              label="Date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>
        </section>

        {selectedClass && rows.length > 0 && (
          <section className="rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
            <header className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-[var(--brand-surface-contrast)]">
                  {selectedClass.name} - {new Date(date).toLocaleDateString()}
                </h2>
                <p className="text-sm text-[var(--brand-muted)]">
                  Mark attendance for all students in this class.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" size="sm" onClick={() => markAll('present')}>
                  All present
                </Button>
                <Button variant="ghost" size="sm" onClick={() => markAll('absent')}>
                  All absent
                </Button>
                <Button variant="ghost" size="sm" onClick={() => markAll('late')}>
                  All late
                </Button>
              </div>
            </header>

            <Table columns={attendanceColumns} data={rows} caption="Class attendance roster" />

            <div className="mt-4 flex justify-end">
              <Button onClick={() => void handleSave()} loading={saving}>
                Save attendance
              </Button>
            </div>
          </section>
        )}

        {selectedClass && rows.length === 0 && !loadingRoster && (
          <section className="rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
            <p className="text-sm text-[var(--brand-muted)]">
              No students found in this class. Add students to the class first.
            </p>
          </section>
        )}

        {loadingRoster && (
          <section className="rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
            <div className="h-64 animate-pulse rounded-lg bg-[var(--brand-skeleton)]/40" />
          </section>
        )}
      </div>
    </RouteMeta>
  );
}
