import { useMemo } from 'react';
import { useAdminOverview } from '../../hooks/queries/useAdminQueries';
import { StatCard } from '../../components/charts/StatCard';
import { DataTable, type DataTableColumn } from '../../components/tables/DataTable';
import { BarChart, type BarChartData } from '../../components/charts/BarChart';
import { PieChart, type PieChartData } from '../../components/charts/PieChart';
import { Button } from '../../components/ui/Button';
import RouteMeta from '../../components/layout/RouteMeta';
import { DashboardSkeleton } from '../../components/ui/DashboardSkeleton';
import { StatusBanner } from '../../components/ui/StatusBanner';
import { Users, GraduationCap, UserCheck, Shield, AlertCircle, RefreshCw } from 'lucide-react';
import type { TenantUser, TeacherProfile, StudentRecord } from '../../lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../hooks/useQuery';
import { formatDate } from '../../lib/utils/date';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { isHOD } from '../../lib/utils/userHelpers';

export default function AdminOverviewPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useAdminOverview();

  const { school, users = [], teachers = [], students = [] } = data || {};

  const stats = useMemo(() => {
    const totalUsers = users.length;
    const totalTeachers = users.filter((u) => u.role === 'teacher').length;
    const totalStudents = users.filter((u) => u.role === 'student').length;
    const totalHODs = users.filter((u) => isHOD(u)).length;
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

  const userColumns: DataTableColumn<TenantUser>[] = useMemo(
    () => [
      {
        key: 'email',
        header: 'Email',
        render: (row) => row.email,
        sortable: true
      },
      {
        key: 'role',
        header: 'Role',
        render: (row) => {
          return isHOD(row)
            ? 'Teacher (HOD)'
            : row.role.charAt(0).toUpperCase() + row.role.slice(1);
        },
        sortable: true
      },
      {
        key: 'status',
        header: 'Status',
        render: (row) => <StatusBadge status={row.status || 'active'} />,
        sortable: true
      },
      {
        key: 'is_verified',
        header: 'Verified',
        render: (row) => (row.is_verified ? 'Yes' : 'No')
      },
      {
        key: 'created_at',
        header: 'Created',
        render: (row) => formatDate(row.created_at),
        sortable: true
      }
    ],
    []
  );

  const teacherColumns: DataTableColumn<TeacherProfile>[] = useMemo(
    () => [
      {
        key: 'name',
        header: 'Name',
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
        render: (row) => row.subjects.join(', ') || 'None'
      },
      {
        key: 'classes',
        header: 'Classes',
        render: (row) => row.assigned_classes.join(', ') || 'None'
      }
    ],
    []
  );

  const studentColumns: DataTableColumn<StudentRecord>[] = useMemo(
    () => [
      {
        key: 'name',
        header: 'Name',
        render: (row) => `${row.first_name} ${row.last_name}`,
        sortable: true
      },
      {
        key: 'admission_number',
        header: 'Admission Number',
        render: (row) => row.admission_number || 'N/A',
        sortable: true
      },
      {
        key: 'class_id',
        header: 'Class',
        render: (row) => row.class_id || 'N/A',
        sortable: true
      }
    ],
    []
  );

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
          {roleDistribution.length > 0 && (
            <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
              <PieChart data={roleDistribution} title="Role Distribution" size={250} />
            </div>
          )}
          {statusDistribution.length > 0 && (
            <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
              <BarChart data={statusDistribution} title="User Status Distribution" height={250} />
            </div>
          )}
        </div>

        {/* Users Table */}
        <section className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold text-[var(--brand-surface-contrast)]">
            All Users
          </h2>
          <DataTable<TenantUser>
            data={users}
            columns={userColumns}
            pagination={{ pageSize: 10, showSizeSelector: true }}
            emptyMessage="No users found"
          />
        </section>

        {/* Teachers Table */}
        <section className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold text-[var(--brand-surface-contrast)]">
            Teachers
          </h2>
          <DataTable<TeacherProfile>
            data={teachers}
            columns={teacherColumns}
            pagination={{ pageSize: 10, showSizeSelector: true }}
            emptyMessage="No teachers found"
          />
        </section>

        {/* Students Table */}
        <section className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold text-[var(--brand-surface-contrast)]">
            Students
          </h2>
          <DataTable<StudentRecord>
            data={students}
            columns={studentColumns}
            pagination={{ pageSize: 10, showSizeSelector: true }}
            emptyMessage="No students found"
          />
        </section>
      </div>
    </RouteMeta>
  );
}
