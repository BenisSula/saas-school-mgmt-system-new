import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutationWithInvalidation, queryKeys } from '../../hooks/useQuery';
import { useClasses } from '../../hooks/queries/useAdminQueries';
import { useQuery } from '../../hooks/useQuery';
import { DataTable, type DataTableColumn } from '../../components/tables/DataTable';
import { Button } from '../../components/ui/Button';
import { DatePicker } from '../../components/ui/DatePicker';
import { Select } from '../../components/ui/Select';
import { useAuth } from '../../context/AuthContext';
import { api, type AttendanceMark } from '../../lib/api';
import RouteMeta from '../../components/layout/RouteMeta';
import { defaultDate } from '../../lib/utils/date';

type AttendanceStatus = 'present' | 'absent' | 'late';

interface AttendanceRow extends Record<string, unknown> {
  studentId: string;
  name: string;
  status: AttendanceStatus;
}

// Using shared defaultDate from utils

export default function AdminAttendancePage() {
  const { user } = useAuth();
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [date, setDate] = useState<string>(defaultDate);
  const [rows, setRows] = useState<AttendanceRow[]>([]);

  const { data: classesData, isLoading: classesLoading } = useClasses();
  const classes = classesData || [];

  // Load class roster
  const { data: studentsData, isLoading: studentsLoading } = useQuery(
    ['class-roster', selectedClassId],
    async () => {
      if (!selectedClassId) return [];
      const students = await api.listStudents();
      return students.filter(
        (s) => s.class_uuid === selectedClassId || s.class_id === selectedClassId
      );
    },
    { enabled: !!selectedClassId }
  );

  const students = useMemo(() => studentsData || [], [studentsData]);

  // Initialize rows when students load
  useEffect(() => {
    if (students.length > 0 && rows.length === 0) {
      const attendanceRows: AttendanceRow[] = students.map((student) => ({
        studentId: student.id,
        name: `${student.first_name} ${student.last_name}`,
        status: 'present' as AttendanceStatus
      }));
      setRows(attendanceRows);
    }
  }, [students, rows.length]);

  const markAttendanceMutation = useMutationWithInvalidation(
    async (records: AttendanceMark[]) => {
      await api.markAttendance(records);
    },
    [queryKeys.admin.attendance()] as unknown as unknown[][],
    { successMessage: 'Attendance saved successfully' }
  );

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

    markAttendanceMutation.mutate(records);
  }, [selectedClassId, user, date, rows, markAttendanceMutation]);

  const attendanceColumns: DataTableColumn<AttendanceRow>[] = useMemo(
    () => [
      {
        key: 'name',
        header: 'Student',
        render: (row) => (
          <div>
            <p className="font-medium text-[var(--brand-surface-contrast)]">{row.name}</p>
            <p className="text-xs text-[var(--brand-muted)]">{row.studentId}</p>
          </div>
        )
      },
      {
        key: 'status',
        header: 'Status',
        render: (row) => (
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
    <RouteMeta title="Attendance Management">
      <div className="space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--brand-surface-contrast)]">
              Attendance Management
            </h1>
            <p className="mt-1 text-sm text-[var(--brand-muted)]">
              Track and manage attendance for all classes
            </p>
          </div>
        </header>

        {/* Filters */}
        <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Class"
              value={selectedClassId}
              onChange={(e) => {
                setSelectedClassId(e.target.value);
                setRows([]); // Reset rows when class changes
              }}
              options={classes.map((c) => ({ label: c.name, value: c.id }))}
              disabled={classesLoading || classes.length === 0}
            />
            <DatePicker
              label="Date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>

        {/* Quick Actions */}
        {rows.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => markAll('present')}>
              Mark All Present
            </Button>
            <Button size="sm" variant="outline" onClick={() => markAll('absent')}>
              Mark All Absent
            </Button>
            <Button size="sm" variant="outline" onClick={() => markAll('late')}>
              Mark All Late
            </Button>
          </div>
        )}

        {/* Attendance Table */}
        {selectedClassId && (
          <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--brand-surface-contrast)]">
                Attendance for {classes.find((c) => c.id === selectedClassId)?.name}
              </h2>
              <Button
                onClick={handleSave}
                loading={markAttendanceMutation.isPending}
                disabled={rows.length === 0}
              >
                Save Attendance
              </Button>
            </div>
            <DataTable<AttendanceRow>
              data={rows}
              columns={attendanceColumns}
              pagination={{ pageSize: 20, showSizeSelector: true }}
              emptyMessage="No students in this class"
              loading={studentsLoading}
            />
          </div>
        )}
      </div>
    </RouteMeta>
  );
}
