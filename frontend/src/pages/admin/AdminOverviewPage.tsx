import { useMemo } from 'react';
import { useAdminOverview } from '../../hooks/queries/useAdminQueries';
import {
  useTeacherStats,
  useStudentStats,
  useClassStats,
  useSubjectStats,
  useTodayAttendance,
  useLoginAttempts,
  useActiveSessions
} from '../../hooks/queries/useDashboardStats';
import { StatCard } from '../../components/charts/StatCard';
import { BarChart, type BarChartData } from '../../components/charts/BarChart';
import { PieChart, type PieChartData } from '../../components/charts/PieChart';
import { LineChart, type LineChartDataPoint } from '../../components/charts/LineChart';
import { Button } from '../../components/ui/Button';
import RouteMeta from '../../components/layout/RouteMeta';
import { DashboardSkeleton } from '../../components/ui/DashboardSkeleton';
import { StatusBanner } from '../../components/ui/StatusBanner';
import {
  Users,
  GraduationCap,
  BookOpen,
  FileText,
  Calendar,
  LogIn,
  UserCheck,
  AlertCircle,
  RefreshCw,
  TrendingUp
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../hooks/useQuery';
import { ActivityLog } from '../../components/admin/ActivityLog';
import { QuickActionPanel } from '../../components/admin/QuickActionPanel';
import { SystemAlerts } from '../../components/admin/SystemAlerts';
import { useAttendance } from '../../hooks/queries/useAdminQueries';
import { useClasses } from '../../hooks/queries/useAdminQueries';

export default function AdminOverviewPage() {
  const queryClient = useQueryClient();

  // Main overview data
  const { data, isLoading: overviewLoading, error: overviewError } = useAdminOverview();
  const { school, users = [], teachers = [], students = [], classes: overviewClasses = [] } = data || {};

  // Dashboard statistics hooks
  const { data: teacherStats, isLoading: teacherStatsLoading } = useTeacherStats();
  const { data: studentStats, isLoading: studentStatsLoading } = useStudentStats();
  const { data: classStats, isLoading: classStatsLoading } = useClassStats();
  const { data: subjectStats, isLoading: subjectStatsLoading } = useSubjectStats();
  const { data: todayAttendance, isLoading: attendanceLoading } = useTodayAttendance();
  const { data: loginAttempts, isLoading: loginAttemptsLoading } = useLoginAttempts(1);
  const { data: activeSessions, isLoading: sessionsLoading } = useActiveSessions();
  const { data: classes } = useClasses();

  // Attendance trend data (last 14 days)
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  const { data: attendanceData, isLoading: attendanceTrendLoading } = useAttendance({
    from: fourteenDaysAgo.toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0]
  });

  const isLoading =
    overviewLoading ||
    teacherStatsLoading ||
    studentStatsLoading ||
    classStatsLoading ||
    subjectStatsLoading ||
    attendanceLoading ||
    loginAttemptsLoading ||
    sessionsLoading;

  const error = overviewError;

  // Calculate pending approvals
  const pendingApprovals = useMemo(() => {
    return users.filter((u) => u.status === 'pending').length;
  }, [users]);

  // Student Growth Chart (monthly - last 6 months)
  const studentGrowthData: LineChartDataPoint[] = useMemo(() => {
    // Group students by creation month
    const monthlyCounts: Record<string, number> = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      monthlyCounts[key] = 0;
    }

    students.forEach((student) => {
      const created = new Date((student as { created_at?: string }).created_at || Date.now());
      const key = created.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      if (monthlyCounts[key] !== undefined) {
        monthlyCounts[key]++;
      }
    });

    // Convert to cumulative
    let cumulative = 0;
    return Object.entries(monthlyCounts).map(([label, count]) => {
      cumulative += count;
      return { label, value: cumulative };
    });
  }, [students]);

  // Teacher Activity Chart (weekly - last 4 weeks)
  const teacherActivityData: BarChartData[] = useMemo(() => {
    // Group teachers by creation week
    const weeklyCounts: Record<string, number> = {};
    const now = new Date();
    for (let i = 3; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i * 7);
      const weekStart = new Date(date);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const key = `Week ${i + 1}`;
      weeklyCounts[key] = 0;
    }

    teachers.forEach((teacher) => {
      const created = new Date((teacher as { created_at?: string }).created_at || Date.now());
      const weekAgo = Math.floor((now.getTime() - created.getTime()) / (7 * 24 * 60 * 60 * 1000));
      if (weekAgo >= 0 && weekAgo < 4) {
        const key = `Week ${4 - weekAgo}`;
        if (weeklyCounts[key] !== undefined) {
          weeklyCounts[key]++;
        }
      }
    });

    return Object.entries(weeklyCounts).map(([label, value]) => ({
      label,
      value,
      color: 'var(--brand-primary)'
    }));
  }, [teachers]);

  // Attendance Trend (last 14 days)
  const attendanceTrendData: LineChartDataPoint[] = useMemo(() => {
    if (!attendanceData || attendanceData.length === 0) {
      // Generate empty data for last 14 days
      const data: LineChartDataPoint[] = [];
      for (let i = 13; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        data.push({
          label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          value: 0
        });
      }
      return data;
    }

    // Group by date and calculate attendance percentage
    const dailyData: Record<string, { present: number; total: number }> = {};
    attendanceData.forEach((record) => {
      const date = record.attendance_date || '';
      if (!dailyData[date]) {
        dailyData[date] = { present: 0, total: 0 };
      }
      dailyData[date].total += record.count;
      if (record.status === 'present' || record.status === 'late') {
        dailyData[date].present += record.count;
      }
    });

    // Generate last 14 days
    const data: LineChartDataPoint[] = [];
    for (let i = 13; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayData = dailyData[dateStr] || { present: 0, total: 0 };
      const percentage = dayData.total > 0 ? Math.round((dayData.present / dayData.total) * 100) : 0;
      data.push({
        label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: percentage
      });
    }
    return data;
  }, [attendanceData]);

  // Demographics - Gender Distribution
  const genderDistribution: PieChartData[] = useMemo(() => {
    if (!studentStats?.byGender) return [];
    return [
      { label: 'Male', value: studentStats.byGender.male },
      { label: 'Female', value: studentStats.byGender.female },
      { label: 'Other', value: studentStats.byGender.other }
    ].filter((item) => item.value > 0);
  }, [studentStats]);

  // Demographics - Students per Class/Level
  const studentsPerClass: PieChartData[] = useMemo(() => {
    if (!studentStats?.byClass || !classes) return [];
    const classMap = new Map(classes.map((c) => [c.id, c.name]));
    return Object.entries(studentStats.byClass)
      .map(([classId, count]) => ({
        label: classMap.get(classId) || classId || 'Unassigned',
        value: count
      }))
      .filter((item) => item.value > 0)
      .slice(0, 10); // Top 10 classes
  }, [studentStats, classes]);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.overview() });
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.teacherStats() });
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.studentStats() });
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.classStats() });
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.subjectStats() });
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.todayAttendance() });
  };

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

  return (
    <RouteMeta title="Admin Dashboard">
      <div className="space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--brand-surface-contrast)]">
              Executive Dashboard
            </h1>
            <p className="text-sm text-[var(--brand-muted)]">
              Overview of school information, users, and statistics for your organization.
            </p>
          </div>
          <Button onClick={handleRefresh} leftIcon={<RefreshCw className="h-4 w-4" />}>
            Refresh
          </Button>
        </header>

        {/* System Alerts */}
        <SystemAlerts
          showExpiredPasswords={false}
          showUnauthorizedAttempts={loginAttempts?.failed ? loginAttempts.failed > 5 : false}
          showTenantErrors={false}
          showSyncFailures={false}
          showTermWarnings={false}
        />

        {/* Key Statistics - 8 Cards (2 rows, 4 cards each) */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Teachers"
            value={teacherStats?.total || 0}
            icon={<GraduationCap className="h-5 w-5" />}
            description={`${teacherStats?.active || 0} active`}
          />
          <StatCard
            title="Total Students"
            value={studentStats?.total || 0}
            icon={<Users className="h-5 w-5" />}
            description={`${studentStats?.active || 0} active`}
          />
          <StatCard
            title="Total Classes"
            value={classStats?.total || 0}
            icon={<BookOpen className="h-5 w-5" />}
            description={`${classStats?.withStudents || 0} with students`}
          />
          <StatCard
            title="Total Subjects"
            value={subjectStats?.total || 0}
            icon={<FileText className="h-5 w-5" />}
            description={`${subjectStats?.assigned || 0} assigned`}
          />
          <StatCard
            title="Attendance Today"
            value={todayAttendance?.percentage || 0}
            icon={<Calendar className="h-5 w-5" />}
            description={`${todayAttendance?.present || 0}/${todayAttendance?.total || 0} present`}
          />
          <StatCard
            title="Active Sessions"
            value={activeSessions?.length || 0}
            icon={<LogIn className="h-5 w-5" />}
            description="Currently logged in"
          />
          <StatCard
            title="Pending Approvals"
            value={pendingApprovals}
            icon={<UserCheck className="h-5 w-5" />}
            description="Awaiting approval"
          />
          <StatCard
            title="Login Attempts"
            value={(loginAttempts?.successful || 0) + (loginAttempts?.failed || 0)}
            icon={<TrendingUp className="h-5 w-5" />}
            description={`${loginAttempts?.failed || 0} failed today`}
          />
        </section>

        {/* Charts Section */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Student Growth Chart */}
          <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
            <LineChart
              data={studentGrowthData}
              title="Student Growth (Last 6 Months)"
              height={250}
              color="var(--brand-primary)"
            />
          </div>

          {/* Attendance Trend Chart */}
          <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
            <LineChart
              data={attendanceTrendData}
              title="Attendance Trend (Last 14 Days)"
              height={250}
              color="var(--brand-primary)"
            />
          </div>

          {/* Teacher Activity Chart */}
          <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
            <BarChart
              data={teacherActivityData}
              title="Teacher Activity (Last 4 Weeks)"
              height={250}
            />
          </div>

          {/* Demographics - Gender Distribution */}
          {genderDistribution.length > 0 && (
            <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
              <PieChart data={genderDistribution} title="Student Gender Distribution" size={250} />
            </div>
          )}
        </div>

        {/* Demographics Section - Students per Class */}
        {studentsPerClass.length > 0 && (
          <section className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
            <PieChart data={studentsPerClass} title="Students per Class" size={300} />
          </section>
        )}

        {/* Activity Logs Section */}
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
            <ActivityLog entityType="user" limit={10} showTitle={true} />
          </section>

          <section className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold text-[var(--brand-surface-contrast)]">
              Login Attempts
            </h3>
            {loginAttemptsLoading ? (
              <DashboardSkeleton />
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)]/50 p-4">
                  <span className="text-sm text-[var(--brand-muted)]">Successful</span>
                  <span className="text-lg font-semibold text-emerald-500">
                    {loginAttempts?.successful || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)]/50 p-4">
                  <span className="text-sm text-[var(--brand-muted)]">Failed</span>
                  <span className="text-lg font-semibold text-red-500">
                    {loginAttempts?.failed || 0}
                  </span>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Quick Actions Panel */}
        <QuickActionPanel />

        {/* School Information */}
        {school && (
          <section className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold text-[var(--brand-surface-contrast)]">
              School Information
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-[var(--brand-muted)]">School Name</p>
                <p className="text-lg font-semibold text-[var(--brand-surface-contrast)]">
                  {school.name}
                </p>
              </div>
              {school.address && typeof school.address === 'object' ? (
                <div>
                  <p className="text-sm font-medium text-[var(--brand-muted)]">Address</p>
                  <p className="text-lg font-semibold text-[var(--brand-surface-contrast)]">
                    {school.address.city && typeof school.address.city === 'string'
                      ? school.address.city
                      : 'N/A'}
                    {school.address.country && typeof school.address.country === 'string'
                      ? `, ${school.address.country}`
                      : ''}
                  </p>
                </div>
              ) : null}
            </div>
          </section>
        )}
      </div>
    </RouteMeta>
  );
}
