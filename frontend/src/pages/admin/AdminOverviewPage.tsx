import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { api, type TenantUser, type TeacherProfile, type StudentRecord } from '../../lib/api';
import { StatusBanner } from '../../components/ui/StatusBanner';
import { useAsyncFeedback } from '../../hooks/useAsyncFeedback';
import { Table } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';

interface SchoolInfo {
  id: string;
  name: string;
  address: Record<string, unknown>;
}

interface DashboardStats {
  totalUsers: number;
  totalTeachers: number;
  totalStudents: number;
  totalHODs: number;
  totalAdmins: number;
  pendingUsers: number;
}

function AdminOverviewPage() {
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo | null>(null);
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [teachers, setTeachers] = useState<TeacherProfile[]>([]);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const { status, message, setSuccess, setError, clear } = useAsyncFeedback();

  const stats: DashboardStats = useMemo(() => {
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

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      clear();

      const [schoolResult, usersResult, teachersResult, studentsResult] = await Promise.allSettled([
        api.getSchool(),
        api.listUsers(),
        api.listTeachers(),
        api.listStudents()
      ]);

      if (schoolResult.status === 'fulfilled') {
        setSchoolInfo(schoolResult.value);
      } else {
        console.warn('Failed to load school info:', schoolResult.reason);
      }

      if (usersResult.status === 'fulfilled') {
        setUsers(usersResult.value);
      } else {
        const errorMessage = (usersResult.reason as Error).message ?? 'Unable to load users.';
        setError(errorMessage);
        toast.error(errorMessage);
      }

      if (teachersResult.status === 'fulfilled') {
        setTeachers(teachersResult.value);
      } else {
        console.warn('Failed to load teachers:', teachersResult.reason);
      }

      if (studentsResult.status === 'fulfilled') {
        setStudents(studentsResult.value);
      } else {
        console.warn('Failed to load students:', studentsResult.reason);
      }

      setSuccess('Dashboard data loaded successfully.');
    } catch (error) {
      const errorMessage = (error as Error).message;
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [clear, setError, setSuccess]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const userColumns = useMemo(
    () => [
      { header: 'Email', key: 'email' as const },
      { header: 'Role', key: 'role_display' as const },
      { header: 'Status', key: 'status' as const },
      { header: 'Verified', key: 'is_verified' as const },
      { header: 'Created', key: 'created_at' as const }
    ],
    []
  );

  const userRows = useMemo(
    () =>
      users.map((user) => {
        const additionalRoles = user.additional_roles?.map((r) => r.role).join(', ') || '';
        const roleDisplay =
          user.role === 'teacher' && additionalRoles.includes('hod')
            ? 'Teacher (HOD)'
            : user.role.charAt(0).toUpperCase() + user.role.slice(1);
        return {
          ...user,
          role_display: roleDisplay,
          status: user.status ?? 'active',
          is_verified: user.is_verified ? 'Yes' : 'No',
          created_at: new Date(user.created_at).toLocaleDateString()
        };
      }),
    [users]
  );

  const teacherRows = useMemo(
    () =>
      teachers.map((teacher) => ({
        id: teacher.id,
        name: teacher.name,
        email: teacher.email,
        subjects: teacher.subjects.join(', ') || 'None',
        classes: teacher.assigned_classes.join(', ') || 'None'
      })),
    [teachers]
  );

  const studentRows = useMemo(
    () =>
      students.map((student) => ({
        id: student.id,
        name: `${student.first_name} ${student.last_name}`,
        admission_number: student.admission_number || 'N/A',
        class_id: student.class_id || 'N/A'
      })),
    [students]
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Executive Dashboard</h1>
          <p className="text-sm text-slate-300">
            Overview of school information, users, and statistics for your organization.
          </p>
        </div>
        <Button onClick={loadData} loading={loading}>
          Refresh
        </Button>
      </header>

      {message ? <StatusBanner status={status} message={message} onDismiss={clear} /> : null}

      {schoolInfo ? (
        <section className="rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold text-[var(--brand-surface-contrast)]">
            School Information
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-[var(--brand-muted)]">School Name</p>
              <p className="text-lg font-semibold text-[var(--brand-surface-contrast)]">
                {schoolInfo.name}
              </p>
            </div>
            {schoolInfo.address && typeof schoolInfo.address === 'object' ? (
              <div>
                <p className="text-sm font-medium text-[var(--brand-muted)]">Address</p>
                <p className="text-lg font-semibold text-[var(--brand-surface-contrast)]">
                  {schoolInfo.address.city && typeof schoolInfo.address.city === 'string'
                    ? schoolInfo.address.city
                    : 'N/A'}
                  {schoolInfo.address.country && typeof schoolInfo.address.country === 'string'
                    ? `, ${schoolInfo.address.country}`
                    : ''}
                </p>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-4 shadow-sm">
          <p className="text-sm font-medium text-[var(--brand-muted)]">Total Users</p>
          <p className="text-3xl font-bold text-[var(--brand-surface-contrast)]">
            {stats.totalUsers}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-4 shadow-sm">
          <p className="text-sm font-medium text-[var(--brand-muted)]">Teachers</p>
          <p className="text-3xl font-bold text-[var(--brand-surface-contrast)]">
            {stats.totalTeachers}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-4 shadow-sm">
          <p className="text-sm font-medium text-[var(--brand-muted)]">HODs</p>
          <p className="text-3xl font-bold text-[var(--brand-surface-contrast)]">
            {stats.totalHODs}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-4 shadow-sm">
          <p className="text-sm font-medium text-[var(--brand-muted)]">Students</p>
          <p className="text-3xl font-bold text-[var(--brand-surface-contrast)]">
            {stats.totalStudents}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-4 shadow-sm">
          <p className="text-sm font-medium text-[var(--brand-muted)]">Admins</p>
          <p className="text-3xl font-bold text-[var(--brand-surface-contrast)]">
            {stats.totalAdmins}
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
        <h2 className="mb-4 text-xl font-semibold text-[var(--brand-surface-contrast)]">
          All Users
        </h2>
        <Table columns={userColumns} data={userRows} caption="School users" />
      </section>

      <section className="rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
        <h2 className="mb-4 text-xl font-semibold text-[var(--brand-surface-contrast)]">
          Teachers
        </h2>
        <Table
          columns={[
            { header: 'Name', key: 'name' as const },
            { header: 'Email', key: 'email' as const },
            { header: 'Subjects', key: 'subjects' as const },
            { header: 'Classes', key: 'classes' as const }
          ]}
          data={teacherRows}
          caption="School teachers"
        />
      </section>

      <section className="rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
        <h2 className="mb-4 text-xl font-semibold text-[var(--brand-surface-contrast)]">
          Students
        </h2>
        <Table
          columns={[
            { header: 'Name', key: 'name' as const },
            { header: 'Admission Number', key: 'admission_number' as const },
            { header: 'Class', key: 'class_id' as const }
          ]}
          data={studentRows}
          caption="School students"
        />
      </section>
    </div>
  );
}

export default AdminOverviewPage;
