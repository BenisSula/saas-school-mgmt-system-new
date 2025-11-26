/**
 * Admin Dashboard Page
 * Displays KPIs, charts, and activity summaries for school admin
 */

import RouteMeta from '../../../components/layout/RouteMeta';
import { DashboardSkeleton } from '../../../components/ui/DashboardSkeleton';
import { StatusBanner } from '../../../components/ui/StatusBanner';
import { StatCard } from '../../../components/charts/StatCard';
import { BarChart, type BarChartData } from '../../../components/charts/BarChart';
import { LineChart, type LineChartDataPoint } from '../../../components/charts/LineChart';
import { Button } from '../../../components/ui/Button';
import {
  Users,
  GraduationCap,
  Building2,
  BookOpen,
  Activity,
  LogIn,
  RefreshCw,
} from 'lucide-react';
import {
  useAdminDashboard,
  useRefreshDashboard,
} from '../../../hooks/queries/admin/useAdminDashboard';

export default function AdminDashboardPage() {
  const { data, isLoading, error } = useAdminDashboard();
  const refreshDashboard = useRefreshDashboard();

  if (isLoading) {
    return (
      <RouteMeta title="Admin Dashboard">
        <DashboardSkeleton />
      </RouteMeta>
    );
  }

  if (error) {
    return (
      <RouteMeta title="Admin Dashboard">
        <StatusBanner status="error" message={(error as Error).message} />
      </RouteMeta>
    );
  }

  // Handle both wrapped and unwrapped responses
  const stats = data || {
    users: { teachers: 0, students: 0, hods: 0, activeTeachers: 0, activeStudents: 0 },
    departments: 0,
    classes: 0,
    students: 0,
    activity: { last7Days: 0, loginsLast7Days: 0 },
  };

  // Prepare chart data
  const loginActivityData: BarChartData[] = [
    { label: 'Last 7 Days', value: stats.activity.loginsLast7Days, color: 'var(--brand-primary)' },
  ];

  const activityTrendData: LineChartDataPoint[] = [
    { label: 'Today', value: stats.activity.last7Days },
  ];

  return (
    <RouteMeta title="Admin Dashboard">
      <div className="space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--brand-surface-contrast)]">
              School Admin Dashboard
            </h1>
            <p className="text-sm text-[var(--brand-muted)]">
              Overview of school operations, users, and activity
            </p>
          </div>
          <Button onClick={refreshDashboard} leftIcon={<RefreshCw className="h-4 w-4" />}>
            Refresh
          </Button>
        </header>

        {/* Key Statistics */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Teachers"
            value={stats.users.teachers}
            icon={<GraduationCap className="h-5 w-5" />}
            description={`${stats.users.activeTeachers} active`}
          />
          <StatCard
            title="Students"
            value={stats.users.students}
            icon={<Users className="h-5 w-5" />}
            description={`${stats.users.activeStudents} active`}
          />
          <StatCard
            title="Departments"
            value={stats.departments}
            icon={<Building2 className="h-5 w-5" />}
            description={`${stats.users.hods} HODs`}
          />
          <StatCard
            title="Classes"
            value={stats.classes}
            icon={<BookOpen className="h-5 w-5" />}
            description="Total classes"
          />
        </section>

        {/* Activity Statistics */}
        <section className="grid gap-4 sm:grid-cols-2">
          <StatCard
            title="Activity (7 Days)"
            value={stats.activity.last7Days}
            icon={<Activity className="h-5 w-5" />}
            description="Total actions"
          />
          <StatCard
            title="Logins (7 Days)"
            value={stats.activity.loginsLast7Days}
            icon={<LogIn className="h-5 w-5" />}
            description="Total logins"
          />
        </section>

        {/* Charts Section */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
            <BarChart data={loginActivityData} title="Login Activity" height={250} />
          </div>
          <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
            <LineChart
              data={activityTrendData}
              title="Activity Trend"
              height={250}
              color="var(--brand-primary)"
            />
          </div>
        </div>
      </div>
    </RouteMeta>
  );
}
