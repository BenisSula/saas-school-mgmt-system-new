import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import RouteMeta from '../../components/layout/RouteMeta';
import { useAuth } from '../../context/AuthContext';
import { api, type TeacherClassRosterEntry } from '../../lib/api';
import { defaultDate } from '../../lib/utils/date';
import { DatePicker } from '../../components/ui/DatePicker';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { StatusBanner } from '../../components/ui/StatusBanner';
import { useTeacherClasses } from '../../hooks/queries/useTeachers';
import { useMarkAttendance } from '../../hooks/queries/useTeacherPhase7';

type AttendanceStatus = 'present' | 'absent' | 'late';

interface AttendanceRow {
  studentId: string;
  name: string;
  status: AttendanceStatus;
}

// Using shared defaultDate from utils

export function TeacherAttendancePage() {
  const { user } = useAuth();
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [date, setDate] = useState<string>(defaultDate);
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: classes = [], isLoading: loadingClasses } = useTeacherClasses();
  const markAttendanceMutation = useMarkAttendance();

  const selectedClass = useMemo(
    () => classes.find((clazz) => clazz.id === selectedClassId) ?? null,
    [classes, selectedClassId]
  );

  useEffect(() => {
    if (classes.length > 0 && !selectedClassId) {
      setSelectedClassId(classes[0].id);
    }
  }, [classes, selectedClassId]);

  const loadRoster = async () => {
    if (!selectedClassId) {
      toast.error('Select a class before loading the roster.');
      return;
    }
    setLoadingRoster(true);
    setError(null);
    try {
      const rosterEntries: TeacherClassRosterEntry[] =
        await api.teacher.getClassRoster(selectedClassId);
      const mapped: AttendanceRow[] = rosterEntries.map((student) => ({
        studentId: student.id,
        name: `${student.first_name} ${student.last_name}`,
        status: 'present',
      }));
      setRows(mapped);
      if (mapped.length === 0) {
        toast.info('No students found for this class.');
      } else {
        toast.success('Roster loaded. Update statuses and save attendance.');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingRoster(false);
    }
  };

  const markAll = (status: AttendanceStatus) => {
    setRows((current) => current.map((entry) => ({ ...entry, status })));
  };

  const updateRowStatus = (studentId: string, status: AttendanceStatus) => {
    setRows((current) =>
      current.map((entry) => (entry.studentId === studentId ? { ...entry, status } : entry))
    );
  };

  const handleSave = async () => {
    if (!user) {
      toast.error('Sign in before saving attendance.');
      return;
    }
    if (!selectedClassId) {
      toast.error('Select a class before saving.');
      return;
    }
    if (rows.length === 0) {
      toast.error('Load the roster before attempting to save attendance.');
      return;
    }

    const payload = rows.map((row) => ({
      studentId: row.studentId,
      status: row.status,
      date,
      classId: selectedClassId,
    }));

    try {
      await markAttendanceMutation.mutateAsync(payload);
      toast.success('Attendance recorded successfully.');
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <RouteMeta title="Attendance">
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold text-[var(--brand-surface-contrast)]">
            Mark attendance
          </h1>
          <p className="text-sm text-[var(--brand-muted)]">
            Load your class roster, update statuses, and submit attendance in a few clicks.
          </p>
        </header>

        {error ? <StatusBanner status="error" message={error} /> : null}

        <section className="grid gap-4 md:grid-cols-[minmax(220px,280px)_minmax(220px,280px)_auto]">
          <Select
            label="Class"
            value={selectedClassId}
            disabled={loadingClasses}
            onChange={(event) => setSelectedClassId(event.target.value)}
            options={classes.map((clazz) => ({
              value: clazz.id,
              label: clazz.name,
            }))}
          />
          <DatePicker
            label="Attendance date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
          <div className="flex items-end gap-2">
            <Button
              onClick={() => void loadRoster()}
              loading={loadingRoster}
              disabled={!selectedClassId}
            >
              Load roster
            </Button>
            <Button
              variant="outline"
              onClick={() => markAll('present')}
              disabled={rows.length === 0}
            >
              Mark all present
            </Button>
          </div>
        </section>

        {rows.length === 0 ? (
          <StatusBanner status="info" message="Load a class roster to begin marking attendance." />
        ) : (
          <section className="space-y-4 rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
            <header className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[var(--brand-surface-contrast)]">
                  {selectedClass?.name ?? 'Class roster'}
                </h2>
                <p className="text-xs text-[var(--brand-muted)]">
                  Select the attendance status for each student. Use quick actions to update the
                  whole class.
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

            <div className="overflow-hidden rounded-lg border border-[var(--brand-border)]">
              <table className="min-w-full divide-y divide-[var(--brand-border)] text-sm">
                <thead className="bg-black/20 text-xs uppercase tracking-wide text-[var(--brand-muted)]">
                  <tr>
                    <th className="px-4 py-2 text-left">Student</th>
                    <th className="px-4 py-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--brand-border)] bg-black/10">
                  {rows.map((row) => (
                    <tr key={row.studentId}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-[var(--brand-surface-contrast)]">
                          {row.name}
                        </p>
                        <p className="text-xs text-[var(--brand-muted)]">{row.studentId}</p>
                      </td>
                      <td className="px-4 py-3">
                        <select
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end">
              <Button onClick={() => void handleSave()} loading={markAttendanceMutation.isPending}>
                Save attendance
              </Button>
            </div>
          </section>
        )}
      </div>
    </RouteMeta>
  );
}

export default TeacherAttendancePage;
