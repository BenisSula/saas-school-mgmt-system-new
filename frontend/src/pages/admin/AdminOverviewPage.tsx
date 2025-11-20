import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminOverview } from '../../hooks/queries/useAdminQueries';
import { StatCard } from '../../components/charts/StatCard';
import { BarChart, type BarChartData } from '../../components/charts/BarChart';
import { PieChart, type PieChartData } from '../../components/charts/PieChart';
import { ChartContainer, PageHeader } from '../../components/charts';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import RouteMeta from '../../components/layout/RouteMeta';
import { DashboardSkeleton } from '../../components/ui/DashboardSkeleton';
import { StatusBanner } from '../../components/ui/StatusBanner';
import { Users, GraduationCap, UserCheck, Shield, AlertCircle, School, NotebookPen } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../hooks/useQuery';

export default function AdminOverviewPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useAdminOverview();

  const { school, users = [], classes = [] } = data || {};

  const stats = useMemo(() => {
    const totalUsers = users.length;
    const totalTeachers = users.filter((u) => u.role === 'teacher').length;
    const totalStudents = users.filter((u) => u.role === 'student').length;
    const totalHODs = users.filter(
      (u) => u.role === 'teacher' && u.additional_roles?.some((r) => r.role === 'hod')
    ).length;
    const totalAdmins = users.filter((u) => u.role === 'admin').length;
    const pendingUsers = users.filter((u) => u.status === 'pending').length;

    return {
      totalUsers,
      totalTeachers,
      totalStudents,
      totalHODs,
      totalAdmins,
      pendingUsers
    };
  }, [users]);

  // Role distribution chart
  const roleDistribution: PieChartData[] = useMemo(() => {
    return [
      { label: 'Teachers', value: stats.totalTeachers },
      { label: 'Students', value: stats.totalStudents },
      { label: 'HODs', value: stats.totalHODs },
      { label: 'Admins', value: stats.totalAdmins }
    ].filter((item) => item.value > 0);
  }, [stats]);

  // Status distribution chart
  const statusDistribution: BarChartData[] = useMemo(() => {
    const statusCounts = new Map<string, number>();
    users.forEach((user) => {
      const status = user.status || 'active';
      statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
    });
    return Array.from(statusCounts.entries()).map(([label, value]) => ({
      label: label.charAt(0).toUpperCase() + label.slice(1),
      value,
      color: 'var(--brand-primary)'
    }));
  }, [users]);


  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.overview() });
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
        <PageHeader
          title="Executive Dashboard"
          description="Overview of school information, users, and statistics for your organization."
          action={<Button onClick={handleRefresh}>Refresh</Button>}
        />

        {/* School Information */}
        <Card padding="md">
          <h2 className="mb-4 text-xl font-semibold text-[var(--brand-surface-contrast)]">
            School Information
          </h2>
          {school ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <p className="text-sm font-medium text-[var(--brand-muted)]">School Name</p>
                <p className="text-lg font-semibold text-[var(--brand-surface-contrast)]">
                  {school.name || 'Not configured'}
                </p>
              </div>
              {school.address && typeof school.address === 'object' ? (
                <div>
                  <p className="text-sm font-medium text-[var(--brand-muted)]">Address</p>
                  <p className="text-lg font-semibold text-[var(--brand-surface-contrast)]">
                    {school.address.city && typeof school.address.city === 'string'
                      ? school.address.city
                      : ''}
                    {school.address.country && typeof school.address.country === 'string'
                      ? `${school.address.city ? ', ' : ''}${school.address.country}`
                      : ''}
                    {!school.address.city && !school.address.country ? 'Not specified' : ''}
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-medium text-[var(--brand-muted)]">Address</p>
                  <p className="text-lg font-semibold text-[var(--brand-surface-contrast)]">
                    Not specified
                  </p>
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-[var(--brand-muted)]">Total Classes</p>
                <p className="text-lg font-semibold text-[var(--brand-surface-contrast)]">
                  {classes.length}
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-[var(--brand-border)] p-4">
              <p className="text-sm text-[var(--brand-muted)]">
                School information not configured. Please configure school details in settings.
              </p>
            </div>
          )}
        </Card>

        {/* Stats Cards */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <StatCard
            title="Total Users"
            value={stats.totalUsers}
            icon={<Users className="h-5 w-5" />}
            description="All registered users"
          />
          <StatCard
            title="Teachers"
            value={stats.totalTeachers}
            icon={<GraduationCap className="h-5 w-5" />}
            description="Teaching staff"
          />
          <StatCard
            title="HODs"
            value={stats.totalHODs}
            icon={<UserCheck className="h-5 w-5" />}
            description="Heads of Department"
          />
          <StatCard
            title="Students"
            value={stats.totalStudents}
            icon={<Users className="h-5 w-5" />}
            description="Enrolled students"
          />
          <StatCard
            title="Admins"
            value={stats.totalAdmins}
            icon={<Shield className="h-5 w-5" />}
            description="Administrators"
          />
          <StatCard
            title="Pending"
            value={stats.pendingUsers}
            icon={<AlertCircle className="h-5 w-5" />}
            description="Awaiting approval"
          />
        </section>

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          {roleDistribution.length > 0 ? (
            <ChartContainer>
              <PieChart data={roleDistribution} title="Role Distribution" size={250} />
            </ChartContainer>
          ) : (
            <ChartContainer>
              <p className="text-sm text-[var(--brand-muted)] text-center py-8">
                No role distribution data available
              </p>
            </ChartContainer>
          )}
          {statusDistribution.length > 0 ? (
            <ChartContainer>
              <BarChart data={statusDistribution} title="User Status Distribution" height={250} />
            </ChartContainer>
          ) : (
            <ChartContainer>
              <p className="text-sm text-[var(--brand-muted)] text-center py-8">
                No status distribution data available
              </p>
            </ChartContainer>
          )}
        </div>

        {/* Quick Links to Management Pages */}
        <Card padding="md">
          <h2 className="mb-4 text-xl font-semibold text-[var(--brand-surface-contrast)]">
            Quick Access
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Button
              variant="outline"
              className="h-auto flex-col items-start gap-2 p-4"
              onClick={() => navigate('/dashboard/users')}
            >
              <Users className="h-6 w-6" />
              <div className="text-left">
                <p className="font-semibold">User Management</p>
                <p className="text-xs text-[var(--brand-muted)]">
                  Approve users, manage roles
                </p>
              </div>
            </Button>
            <Button
              variant="outline"
              className="h-auto flex-col items-start gap-2 p-4"
              onClick={() => navigate('/dashboard/teachers')}
            >
              <School className="h-6 w-6" />
              <div className="text-left">
                <p className="font-semibold">Teachers Management</p>
                <p className="text-xs text-[var(--brand-muted)]">
                  {stats.totalTeachers} teachers
                </p>
              </div>
            </Button>
            <Button
              variant="outline"
              className="h-auto flex-col items-start gap-2 p-4"
              onClick={() => navigate('/dashboard/students')}
            >
              <GraduationCap className="h-6 w-6" />
              <div className="text-left">
                <p className="font-semibold">Students Management</p>
                <p className="text-xs text-[var(--brand-muted)]">
                  {stats.totalStudents} students
                </p>
              </div>
            </Button>
            <Button
              variant="outline"
              className="h-auto flex-col items-start gap-2 p-4"
              onClick={() => navigate('/dashboard/hods')}
            >
              <UserCheck className="h-6 w-6" />
              <div className="text-left">
                <p className="font-semibold">HODs Management</p>
                <p className="text-xs text-[var(--brand-muted)]">
                  {stats.totalHODs} HODs
                </p>
              </div>
            </Button>
            <Button
              variant="outline"
              className="h-auto flex-col items-start gap-2 p-4"
              onClick={() => navigate('/dashboard/classes')}
            >
              <NotebookPen className="h-6 w-6" />
              <div className="text-left">
                <p className="font-semibold">Classes & Subjects</p>
                <p className="text-xs text-[var(--brand-muted)]">
                  {classes.length} classes
                </p>
              </div>
            </Button>
          </div>
        </Card>
      </div>
    </RouteMeta>
  );
}
