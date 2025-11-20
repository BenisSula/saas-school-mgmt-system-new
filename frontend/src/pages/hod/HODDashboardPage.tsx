import { useMemo } from 'react';
import RouteMeta from '../../components/layout/RouteMeta';
import { DashboardSkeleton } from '../../components/ui/DashboardSkeleton';
import { StatusBanner } from '../../components/ui/StatusBanner';
import { BarChart, type BarChartData } from '../../components/charts/BarChart';
import { PieChart, type PieChartData } from '../../components/charts/PieChart';
import { StatCard, ChartContainer } from '../../components/charts';
import { Card } from '../../components/ui/Card';
import { DataTable, type DataTableColumn } from '../../components/tables/DataTable';
import { useHODDashboard } from '../../hooks/queries/useDashboardQueries';
import { Users, GraduationCap, BookOpen, TrendingUp } from 'lucide-react';
import type { TeacherProfile } from '../../lib/api';

export default function HODDashboardPage() {
  const { department, loading, error } = useHODDashboard();

  // Teacher distribution chart - must be before early returns
  const teacherDistribution: BarChartData[] = useMemo(() => {
    if (!department) return [];
    return department.teachers.map((teacher) => ({
      label: teacher.name,
      value: teacher.subjects.length,
      color: 'var(--brand-primary)'
    }));
  }, [department]);

  // Subject coverage chart - must be before early returns
  const subjectCoverage: PieChartData[] = useMemo(() => {
    if (!department) return [];
    const subjectCounts = new Map<string, number>();
    department.teachers.forEach((teacher) => {
      teacher.subjects.forEach((subject) => {
        subjectCounts.set(subject, (subjectCounts.get(subject) || 0) + 1);
      });
    });
    return Array.from(subjectCounts.entries()).map(([label, value]) => ({
      label,
      value
    }));
  }, [department]);

  const teacherColumns: DataTableColumn<TeacherProfile>[] = useMemo(() => {
    if (!department) return [];
    return [
      {
        key: 'name',
        header: 'Teacher Name',
        render: (row) => row.name,
        sortable: true
      },
      {
        key: 'email',
        header: 'Email',
        render: (row) => row.email,
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
        render: (row) => `${row.assigned_classes.length} classes`
      }
    ];
  }, [department]);

  // Early returns after all hooks
  if (loading) {
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

  if (!department) {
    return (
      <RouteMeta title="HOD Dashboard">
        <StatusBanner status="info" message="No department data available yet." />
      </RouteMeta>
    );
  }

  return (
    <RouteMeta title="HOD Dashboard">
      <div className="space-y-8">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold text-[var(--brand-surface-contrast)]">
            Department Dashboard
          </h1>
          <p className="text-sm text-[var(--brand-muted)]">
            Overview of {department.department} department performance and resources.
          </p>
        </header>

        {/* Stats Cards */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Teachers"
            value={department.totalTeachers}
            icon={<Users className="h-5 w-5" />}
            description="In department"
          />
          <StatCard
            title="Total Students"
            value={department.totalStudents}
            icon={<GraduationCap className="h-5 w-5" />}
            description="Approximate count"
          />
          <StatCard
            title="Total Classes"
            value={department.classes}
            icon={<BookOpen className="h-5 w-5" />}
            description="Active classes"
          />
          <StatCard
            title="Avg Subjects/Teacher"
            value={
              department.totalTeachers > 0
                ? Math.round(
                    (department.teachers.reduce((sum, t) => sum + t.subjects.length, 0) /
                      department.totalTeachers) *
                      10
                  ) / 10
                : 0
            }
            icon={<TrendingUp className="h-5 w-5" />}
            description="Average load"
          />
        </section>

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          {teacherDistribution.length > 0 && (
            <ChartContainer>
              <BarChart data={teacherDistribution} title="Teachers by Subject Count" height={250} />
            </ChartContainer>
          )}
          {subjectCoverage.length > 0 && (
            <ChartContainer>
              <PieChart data={subjectCoverage} title="Subject Coverage" size={250} />
            </ChartContainer>
          )}
        </div>

        {/* Department Teachers */}
        <Card padding="md">
          <header className="mb-4">
            <h2 className="text-lg font-semibold text-[var(--brand-surface-contrast)]">
              Department Teachers
            </h2>
            <p className="text-sm text-[var(--brand-muted)]">
              Teachers under your oversight in the {department.department} department.
            </p>
          </header>
          <DataTable<TeacherProfile>
            data={department.teachers}
            columns={teacherColumns}
            pagination={{ pageSize: 10, showSizeSelector: true }}
            emptyMessage="No teachers found in this department."
          />
        </Card>
      </div>
    </RouteMeta>
  );
}
