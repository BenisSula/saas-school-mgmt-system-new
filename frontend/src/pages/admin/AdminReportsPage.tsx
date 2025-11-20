import { useMemo, useState } from 'react';
import { useAttendance, useClasses } from '../../hooks/queries/useAdminQueries';
import { DataTable, type DataTableColumn } from '../../components/tables/DataTable';
import { BarChart, type BarChartData } from '../../components/charts/BarChart';
import { StatCard } from '../../components/charts/StatCard';
import { ChartContainer, PageHeader, FilterPanel } from '../../components/charts';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { DatePicker } from '../../components/ui/DatePicker';
import { Card } from '../../components/ui/Card';
import type { AttendanceAggregate } from '../../lib/api';
import RouteMeta from '../../components/layout/RouteMeta';
import { FileText, Download, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { exportToCSV, exportToPDF, exportToExcel } from '../../lib/utils/export';
import { defaultDate } from '../../lib/utils/date';

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

  const handleExport = async (type: 'attendance' | 'grades' | 'fees') => {
    try {
      if (type === 'attendance') {
        const exportData = attendance.map((item) => ({
          Class: item.class_id || 'N/A',
          Status: item.status,
          Count: item.count,
          Date: item.attendance_date || 'N/A'
        }));
        exportToCSV(exportData, `attendance-report-${defaultDate()}`);
        toast.success('Attendance report exported successfully');
      } else if (type === 'grades') {
        // Grades export would require exam data
        toast.info('Grades export requires selecting an exam');
      } else if (type === 'fees') {
        // Fees export would require fee data
        toast.info('Fees export requires fee data');
      }
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  return (
    <RouteMeta title="Reports Dashboard">
      <div className="space-y-6">
        <PageHeader
          title="Reports Dashboard"
          description="Generate and export comprehensive reports"
          action={
            <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleExport('attendance')}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const exportData = attendance.map((item) => ({
                  Class: item.class_id || 'N/A',
                  Status: item.status,
                  Count: item.count,
                  Date: item.attendance_date || 'N/A'
                }));
                exportToPDF(exportData, `attendance-report-${defaultDate()}`, 'Attendance Report');
              }}
            >
              <Download className="mr-2 h-4 w-4" />
              Export PDF
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const exportData = attendance.map((item) => ({
                  Class: item.class_id || 'N/A',
                  Status: item.status,
                  Count: item.count,
                  Date: item.attendance_date || 'N/A'
                }));
                exportToExcel(exportData, `attendance-report-${defaultDate()}.xls`);
              }}
            >
              <Download className="mr-2 h-4 w-4" />
              Export Excel
            </Button>
            </div>
          }
        />

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
        <FilterPanel title="Attendance Filters">
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
        </FilterPanel>

        {/* Attendance Chart */}
        {attendanceChartData.length > 0 && (
          <ChartContainer>
            <BarChart data={attendanceChartData} title="Attendance by Class" height={250} />
          </ChartContainer>
        )}

        {/* Attendance Table */}
        <Card padding="md">
          <DataTable<AttendanceAggregate>
            data={attendance}
            columns={attendanceColumns}
            pagination={{ pageSize: 10, showSizeSelector: true }}
            emptyMessage="No attendance data available"
            loading={attendanceLoading}
          />
        </Card>
      </div>
    </RouteMeta>
  );
}
