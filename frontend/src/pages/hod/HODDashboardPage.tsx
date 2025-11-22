import { useMemo } from 'react';
import RouteMeta from '../../components/layout/RouteMeta';
import { DashboardSkeleton } from '../../components/ui/DashboardSkeleton';
import { StatusBanner } from '../../components/ui/StatusBanner';
import { BarChart, type BarChartData } from '../../components/charts/BarChart';
import { PieChart, type PieChartData } from '../../components/charts/PieChart';
import { StatCard } from '../../components/charts/StatCard';
import { DataTable, type DataTableColumn } from '../../components/tables/DataTable';
import { useHodDashboard, useHodTeachers } from '../../hooks/queries/hod';
import { Users, GraduationCap, BookOpen, TrendingUp, Activity, RefreshCw } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useQueryClient } from '@tanstack/react-query';
import type { HODTeacher } from '../../hooks/queries/hod';

export default function HODDashboardPage() {
  const { data: dashboardData, isLoading, error } = useHodDashboard();
  const { data: teachersData } = useHodTeachers();
  const queryClient = useQueryClient();

  const refreshDashboard = () => {
    queryClient.invalidateQueries({ queryKey: ['hod', 'dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['hod', 'teachers'] });
  };

  // Teacher distribution by subject chart
  const teacherBySubjectChart: BarChartData[] = useMemo(() => {
    if (!dashboardData?.teachers.bySubject) return [];
    return dashboardData.teachers.bySubject.map((item) => ({
      label: item.subject,
      value: item.count,
      color: 'var(--brand-primary)'
    }));
  }, [dashboardData]);

  // Classes by level chart
  const classesByLevelChart: PieChartData[] = useMemo(() => {
    if (!dashboardData?.classes.byLevel) return [];
    return dashboardData.classes.byLevel.map((item) => ({
      label: item.level,
      value: item.count
    }));
  }, [dashboardData]);

  const teacherColumns: DataTableColumn<HODTeacher>[] = useMemo(() => [
    {
      key: 'name',
      header: 'Teacher Name',
      render: (row) => row.name,
      sortable: true
    },
    {
      key: 'email',
      header: 'Email',
      render: (row) => row.email || 'N/A',
      sortable: true
    },
    {
      key: 'subjects',
      header: 'Subjects',
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.subjects.slice(0, 3).map((subject) => (
            <span
              key={subject}
              className="rounded-full border border-[var(--brand-border)] bg-black/15 px-2 py-1 text-xs text-[var(--brand-surface-contrast)]"
            >
              {subject}
            </span>
          ))}
          {row.subjects.length > 3 && (
            <span className="text-xs text-[var(--brand-muted)]">
              +{row.subjects.length - 3} more
            </span>
          )}
        </div>
      )
    },
    {
      key: 'classes',
      header: 'Classes',
      render: (row) => `${row.classes.length} classes`
    },
    {
      key: 'lastActive',
      header: 'Last Active',
      render: (row) => row.lastActive ? new Date(row.lastActive).toLocaleDateString() : 'Never',
      sortable: true
    }
  ], []);

  // Early returns after all hooks
  if (isLoading) {
    return (
      <RouteMeta title="HOD Dashboard">
        <DashboardSkeleton />
      </RouteMeta>
    );
  }

  if (error) {
    return (
      <RouteMeta title="HOD Dashboard">
        <StatusBanner status="error" message={(error as Error).message} />
      </RouteMeta>
    );
  }

  if (!dashboardData) {
    return (
      <RouteMeta title="HOD Dashboard">
        <StatusBanner status="info" message="No department data available yet." />
      </RouteMeta>
    );
  }

  const { department, teachers, classes, performance } = dashboardData;
  const teachersList = teachersData || [];

  return (
    <RouteMeta title="HOD Dashboard">
      <div className="space-y-8">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--brand-surface-contrast)]">
              {department.name} Dashboard
            </h1>
            <p className="text-sm text-[var(--brand-muted)]">
              Overview of department performance and resources
            </p>
          </div>
          <Button onClick={refreshDashboard} leftIcon={<RefreshCw className="h-4 w-4" />}>
            Refresh
          </Button>
        </header>

        {/* Stats Cards */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Teachers"
            value={teachers.total}
            icon={<Users className="h-5 w-5" />}
            description={`${teachers.active} active`}
          />
          <StatCard
            title="Total Classes"
            value={classes.total}
            icon={<BookOpen className="h-5 w-5" />}
            description="Active classes"
          />
          <StatCard
            title="Avg Performance"
            value={performance.avgScore.toFixed(1)}
            icon={<TrendingUp className="h-5 w-5" />}
            description={`${performance.totalExams} exams`}
          />
          <StatCard
            title="Recent Activity"
            value={performance.recentActivity}
            icon={<Activity className="h-5 w-5" />}
            description="Last 7 days"
          />
        </section>

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          {teacherBySubjectChart.length > 0 && (
            <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
              <BarChart data={teacherBySubjectChart} title="Teachers by Subject" height={250} />
            </div>
          )}
          {classesByLevelChart.length > 0 && (
            <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
              <PieChart data={classesByLevelChart} title="Classes by Level" size={250} />
            </div>
          )}
        </div>

        {/* Department Teachers */}
        <section className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
          <header className="mb-4">
            <h2 className="text-lg font-semibold text-[var(--brand-surface-contrast)]">
              Department Teachers
            </h2>
            <p className="text-sm text-[var(--brand-muted)]">
              Teachers under your oversight in the {department.name} department.
            </p>
          </header>
          <DataTable<HODTeacher>
            data={teachersList}
            columns={teacherColumns}
            pagination={{ pageSize: 10, showSizeSelector: true }}
            emptyMessage="No teachers found in this department."
          />
        </section>
      </div>
    </RouteMeta>
  );
}
