import { useMemo, useState } from 'react';
import { useAttendance, useClasses } from '../../hooks/queries/useAdminQueries';
import { DataTable, type DataTableColumn } from '../../components/tables/DataTable';
import { BarChart, type BarChartData } from '../../components/charts/BarChart';
import { StatCard } from '../../components/charts/StatCard';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { DatePicker } from '../../components/ui/DatePicker';
import type { AttendanceAggregate } from '../../lib/api';
import RouteMeta from '../../components/layout/RouteMeta';
import { FileText, Download, TrendingUp } from 'lucide-react';
import { createExportHandlers } from '../../hooks/useExport';

export default function AdminReportsPage() {
  const [attendanceFilters, setAttendanceFilters] = useState({
    from: '',
    to: '',
    classId: ''
  });

  const { data: classesData } = useClasses();
  const { data: attendanceData, isLoading: attendanceLoading } = useAttendance(attendanceFilters);

  const attendance = useMemo(() => attendanceData || [], [attendanceData]);
  const classes = useMemo(() => classesData || [], [classesData]);

  const attendanceChartData: BarChartData[] = useMemo(() => {
    // Group by class_id and status
    const grouped = attendance.reduce(
      (acc, item) => {
        const key = item.class_id || 'unknown';
        if (!acc[key]) {
          acc[key] = { present: 0, absent: 0 };
        }
        if (item.status === 'present') {
          acc[key].present += item.count;
        } else {
          acc[key].absent += item.count;
        }
        return acc;
      },
      {} as Record<string, { present: number; absent: number }>
    );

    return Object.entries(grouped).map(([classId, data]) => ({
      label: classId === 'unknown' ? 'Unknown' : classId,
      value: data.present,
      color: 'var(--brand-primary)'
    }));
  }, [attendance]);

  const attendanceColumns: DataTableColumn<AttendanceAggregate>[] = useMemo(
    () => [
      {
        key: 'class_id',
        header: 'Class',
        render: (row) => row.class_id || '—'
      },
      {
        key: 'status',
        header: 'Status',
        render: (row) => row.status
      },
      {
        key: 'count',
        header: 'Count',
        render: (row) => row.count
      },
      {
        key: 'attendance_date',
        header: 'Date',
        render: (row) => row.attendance_date
      }
    ],
    []
  );

  const stats = useMemo(() => {
    const totalPresent = attendance
      .filter((item) => item.status === 'present')
      .reduce((sum, item) => sum + item.count, 0);
    const totalAbsent = attendance
      .filter((item) => item.status === 'absent')
      .reduce((sum, item) => sum + item.count, 0);
    const totalStudents = totalPresent + totalAbsent;
    const overallRate = totalStudents > 0 ? (totalPresent / totalStudents) * 100 : 0;

    return {
      totalPresent,
      totalAbsent,
      overallRate: Math.round(overallRate * 10) / 10
    };
  }, [attendance]);

  // Consolidated export handlers using DRY principle
  const exportHandlers = useMemo(() => {
    const exportData = attendance.map((item) => ({
      Class: item.class_id || 'N/A',
      Status: item.status,
      Count: item.count,
      Date: item.attendance_date || 'N/A'
    }));

    return createExportHandlers(exportData, 'attendance-report', ['Class', 'Status', 'Count', 'Date']);
  }, [attendance]);

  const handleExport = (type: 'attendance' | 'grades' | 'fees') => {
    if (type === 'attendance') {
      exportHandlers.exportCSV();
    } else {
      // For grades and fees, use the same pattern when data is available
      exportHandlers.exportCSV();
    }
  };

  return (
    <RouteMeta title="Reports Dashboard">
      <div className="space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--brand-surface-contrast)]">
              Reports Dashboard
            </h1>
            <p className="mt-1 text-sm text-[var(--brand-muted)]">
              Generate and export comprehensive reports
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleExport('attendance')}>
              <Download className="mr-2 h-4 w-4" />
              Export Attendance
            </Button>
          </div>
        </header>

        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            title="Total Present"
            value={stats.totalPresent}
            icon={<TrendingUp className="h-5 w-5" />}
          />
          <StatCard
            title="Total Absent"
            value={stats.totalAbsent}
            icon={<FileText className="h-5 w-5" />}
          />
          <StatCard
            title="Overall Rate"
            value={`${stats.overallRate}%`}
            icon={<TrendingUp className="h-5 w-5" />}
          />
        </div>

        {/* Filters */}
        <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-[var(--brand-surface-contrast)]">
            Attendance Filters
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <DatePicker
              label="From Date"
              value={attendanceFilters.from}
              onChange={(e) => setAttendanceFilters({ ...attendanceFilters, from: e.target.value })}
            />
            <DatePicker
              label="To Date"
              value={attendanceFilters.to}
              onChange={(e) => setAttendanceFilters({ ...attendanceFilters, to: e.target.value })}
            />
            <Select
              label="Class"
              value={attendanceFilters.classId}
              onChange={(e) =>
                setAttendanceFilters({ ...attendanceFilters, classId: e.target.value })
              }
              options={[
                { label: 'All Classes', value: '' },
                ...classes.map((c) => ({ label: c.name, value: c.id }))
              ]}
            />
          </div>
        </div>

        {/* Attendance Chart */}
        {attendanceChartData.length > 0 && (
          <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
            <BarChart data={attendanceChartData} title="Attendance by Class" height={250} />
          </div>
        )}

        {/* Attendance Table */}
        <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
          <DataTable<AttendanceAggregate>
            data={attendance}
            columns={attendanceColumns}
            pagination={{ pageSize: 10, showSizeSelector: true }}
            emptyMessage="No attendance data available"
            loading={attendanceLoading}
          />
        </div>
      </div>
    </RouteMeta>
  );
}
