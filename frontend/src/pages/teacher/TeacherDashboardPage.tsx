import { useMemo } from 'react';
import RouteMeta from '../../components/layout/RouteMeta';
import { DashboardSkeleton } from '../../components/ui/DashboardSkeleton';
import { StatusBanner } from '../../components/ui/StatusBanner';
import { DataTable, type DataTableColumn } from '../../components/tables/DataTable';
import { BarChart, type BarChartData } from '../../components/charts/BarChart';
import { PieChart, type PieChartData } from '../../components/charts/PieChart';
import { StatCard, ChartContainer } from '../../components/charts';
import { Card } from '../../components/ui/Card';
import { useTeacherDashboard } from '../../hooks/queries/useDashboardQueries';
import { Users, BookOpen, GraduationCap, AlertCircle } from 'lucide-react';
import type { TeacherAssignmentSummary } from '../../lib/api';

export default function TeacherDashboardPage() {
  const { overview, loading, error } = useTeacherDashboard();

  const statCards = useMemo(() => {
    if (!overview) return [];
    return [
      {
        title: 'Classes',
        value: overview.summary.totalClasses,
        description: 'Active teaching groups',
        icon: <BookOpen className="h-5 w-5" />
      },
      {
        title: 'Subjects',
        value: overview.summary.totalSubjects,
        description: 'Current assignments',
        icon: <GraduationCap className="h-5 w-5" />
      },
      {
        title: 'Class teacher roles',
        value: overview.summary.classTeacherRoles,
        description: 'Homeroom responsibilities',
        icon: <Users className="h-5 w-5" />
      },
      {
        title: 'Drop requests',
        value: overview.summary.pendingDropRequests,
        description: 'Assignments awaiting admin review',
        icon: <AlertCircle className="h-5 w-5" />
      }
    ];
  }, [overview]);

  // Class distribution chart
  const classDistribution: BarChartData[] = useMemo(() => {
    if (!overview?.assignments) return [];
    const classCounts = new Map<string, number>();
    overview.assignments.forEach((assignment) => {
      const className = assignment.className;
      classCounts.set(className, (classCounts.get(className) || 0) + 1);
    });
    return Array.from(classCounts.entries()).map(([label, value]) => ({
      label,
      value,
      color: 'var(--brand-primary)'
    }));
  }, [overview]);

  // Subject distribution chart
  const subjectDistribution: PieChartData[] = useMemo(() => {
    if (!overview?.assignments) return [];
    const subjectCounts = new Map<string, number>();
    overview.assignments.forEach((assignment) => {
      const subjectName = assignment.subjectName;
      subjectCounts.set(subjectName, (subjectCounts.get(subjectName) || 0) + 1);
    });
    return Array.from(subjectCounts.entries()).map(([label, value]) => ({
      label,
      value
    }));
  }, [overview]);

  // Role distribution (Class Teacher vs Subject Teacher)
  const roleDistribution: PieChartData[] = useMemo(() => {
    if (!overview?.assignments) return [];
    const classTeacherCount = overview.assignments.filter((a) => a.isClassTeacher).length;
    const subjectTeacherCount = overview.assignments.length - classTeacherCount;
    return [
      { label: 'Class Teacher', value: classTeacherCount },
      { label: 'Subject Teacher', value: subjectTeacherCount }
    ];
  }, [overview]);

  const assignmentColumns: DataTableColumn<TeacherAssignmentSummary>[] = useMemo(
    () => [
      {
        key: 'subjectName',
        header: 'Subject',
        render: (row) => row.subjectName,
        sortable: true
      },
      {
        key: 'className',
        header: 'Class',
        render: (row) => row.className,
        sortable: true
      },
      {
        key: 'role',
        header: 'Role',
        render: (row) =>
          row.isClassTeacher ? (
            <span className="rounded bg-emerald-500/20 px-2 py-1 text-xs font-semibold text-emerald-200">
              Classroom teacher
            </span>
          ) : (
            <span className="text-xs uppercase tracking-wide text-[var(--brand-muted)]">
              Subject teacher
            </span>
          )
      },
      {
        key: 'status',
        header: 'Status',
        render: (row) =>
          row.metadata?.dropRequested ? (
            <span className="rounded bg-amber-500/20 px-2 py-1 text-xs font-semibold text-amber-200">
              Drop requested
            </span>
          ) : (
            <span className="text-xs text-[var(--brand-muted)]">Active</span>
          )
      }
    ],
    []
  );

  if (loading) {
    return (
      <RouteMeta title="Teacher dashboard">
        <DashboardSkeleton />
      </RouteMeta>
    );
  }

  if (error) {
    return (
      <RouteMeta title="Teacher dashboard">
        <StatusBanner status="error" message={(error as Error).message} />
      </RouteMeta>
    );
  }

  if (!overview) {
    return (
      <RouteMeta title="Teacher dashboard">
        <StatusBanner status="info" message="No overview data available yet." />
      </RouteMeta>
    );
  }

  const greetingName = overview.teacher.name.split(' ')[0];

  return (
    <RouteMeta title="Teacher dashboard">
      <div className="space-y-8">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold text-[var(--brand-surface-contrast)]">
            Welcome back, {greetingName}
          </h1>
          <p className="text-sm text-[var(--brand-muted)]">
            Monitor your classes, track assessments, and stay on top of homeroom duties from one
            dashboard.
          </p>
        </header>

        {/* Stats Cards */}
        <section
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          aria-label="Teaching overview statistics"
        >
          {statCards.map((card) => (
            <StatCard
              key={card.title}
              title={card.title}
              value={String(card.value)}
              description={card.description}
              icon={card.icon}
            />
          ))}
        </section>

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          {classDistribution.length > 0 && (
            <ChartContainer>
              <BarChart data={classDistribution} title="Assignments by Class" height={250} />
            </ChartContainer>
          )}
          {subjectDistribution.length > 0 && (
            <ChartContainer>
              <PieChart data={subjectDistribution} title="Subject Distribution" size={250} />
            </ChartContainer>
          )}
          {roleDistribution.length > 0 && (
            <ChartContainer className="lg:col-span-2">
              <PieChart data={roleDistribution} title="Role Distribution" size={200} />
            </ChartContainer>
          )}
        </div>

        {/* Active Assignments */}
        <Card padding="md">
          <header className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[var(--brand-surface-contrast)]">
                Active assignments
              </h2>
              <p className="text-sm text-[var(--brand-muted)]">
                Classes and subjects currently assigned to you. Drop requests show as pending until
                approved by an administrator.
              </p>
            </div>
          </header>
          <DataTable<TeacherAssignmentSummary>
            data={overview.assignments}
            columns={assignmentColumns}
            pagination={{ pageSize: 10, showSizeSelector: true }}
            emptyMessage="No class assignments yet. Administrators will provision your teaching load."
          />
        </Card>
      </div>
    </RouteMeta>
  );
}
