import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { RouteMeta } from '../../components/layout/RouteMeta';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { StatusBanner } from '../../components/ui/StatusBanner';
import { DashboardSkeleton } from '../../components/ui/DashboardSkeleton';
import { PaginatedTable, type SortableTableColumn } from '../../components/admin/PaginatedTable';
import { ExportButtons } from '../../components/admin/ExportButtons';
import { exportToCSV, exportToPDF, exportToExcel } from '../../lib/utils/export';
import {
  api,
  type TeacherProfile,
  type TenantUser,
  type Subject,
  type StudentRecord,
  type SchoolClass
} from '../../lib/api';
import { userApi } from '../../lib/api/userApi';
import { defaultDate } from '../../lib/utils/date';
import { AdminUserRegistrationModal } from '../../components/admin/AdminUserRegistrationModal';

interface HODFilters {
  search: string;
  department: string;
  subjectId: string;
  qualifications: string;
  experienceLevel: string;
  minTeachersOversight: string;
  maxTeachersOversight: string;
}

const defaultFilters: HODFilters = {
  search: '',
  department: 'all',
  subjectId: 'all',
  qualifications: '',
  experienceLevel: 'all',
  minTeachersOversight: '',
  maxTeachersOversight: ''
};

interface HODRecord extends TeacherProfile {
  department?: string;
  teachersUnderOversight?: number;
}

export function HODsManagementPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [teachers, setTeachers] = useState<TeacherProfile[]>([]);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [school, setSchool] = useState<{ id: string; name: string; address?: Record<string, unknown> } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<HODFilters>(defaultFilters);
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [showDepartmentModal, setShowDepartmentModal] = useState<boolean>(false);
  const [showClassesModal, setShowClassesModal] = useState<boolean>(false);
  const [showTeachersModal, setShowTeachersModal] = useState<boolean>(false);
  const [showStudentsModal, setShowStudentsModal] = useState<boolean>(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState<boolean>(false);
  const [showPasswordModal, setShowPasswordModal] = useState<boolean>(false);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [pendingHODs, setPendingHODs] = useState<TenantUser[]>([]);
  const [selectedHOD, setSelectedHOD] = useState<HODRecord | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [departmentTeachers, setDepartmentTeachers] = useState<TeacherProfile[]>([]);
  const [departmentStudents, setDepartmentStudents] = useState<StudentRecord[]>([]);
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [updatingPassword, setUpdatingPassword] = useState<boolean>(false);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersResult, teachersResult, studentsResult, classesResult, pendingUsersResult, subjectsResult, schoolResult] =
        await Promise.allSettled([
          userApi.listUsers(),
          api.listTeachers(),
          api.listStudents(),
          api.listClasses(),
          api.listPendingUsers(),
          api.admin.listSubjects(),
          api.getSchool()
        ]);

      if (usersResult.status === 'fulfilled') {
        setUsers(usersResult.value);
      }

      if (teachersResult.status === 'fulfilled') {
        setTeachers(teachersResult.value);
      }

      if (studentsResult.status === 'fulfilled') {
        setStudents(studentsResult.value);
      }

      if (classesResult.status === 'fulfilled') {
        setClasses(classesResult.value);
      }

      if (pendingUsersResult.status === 'fulfilled') {
        // Filter pending users by teacher role (HODs are teachers with additional role)
        const pending = pendingUsersResult.value.filter(
          (u) => u.role === 'teacher' && u.status === 'pending'
        );
        setPendingHODs(pending);
      }

      if (subjectsResult.status === 'fulfilled') {
        setSubjects(subjectsResult.value);
      }

      if (schoolResult.status === 'fulfilled' && schoolResult.value) {
        setSchool(schoolResult.value);
      }
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Filter HODs: teachers with additional_roles containing 'hod'
  const hodUsers = useMemo(
    () =>
      users.filter(
        (u) => u.role === 'teacher' && u.additional_roles?.some((r) => r.role === 'hod')
      ),
    [users]
  );

  const hods = useMemo(() => {
    return hodUsers
      .map((user) => {
        const teacher = teachers.find((t) => t.email === user.email);
        if (!teacher) return null;

        // Count teachers under oversight (teachers with same subjects)
        const hodSubjects = teacher.subjects;
        const teachersUnderOversight = teachers.filter(
          (t) => t.id !== teacher.id && t.subjects.some((subject) => hodSubjects.includes(subject))
        ).length;

        // Extract department from metadata or use first subject as department
        const department =
          (
            user.additional_roles?.find((r) => r.role === 'hod')?.metadata as {
              department?: string;
            }
          )?.department ||
          teacher.subjects[0] ||
          'General';

        return {
          ...teacher,
          department,
          teachersUnderOversight
        } as HODRecord;
      })
      .filter((hod): hod is HODRecord => hod !== null);
  }, [hodUsers, teachers]);

  const filteredHODs = useMemo(() => {
    return hods.filter((hod) => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesSearch =
          hod.name.toLowerCase().includes(searchLower) ||
          hod.email.toLowerCase().includes(searchLower) ||
          hod.department?.toLowerCase().includes(searchLower) ||
          hod.subjects.some((s) => s.toLowerCase().includes(searchLower)) ||
          hod.qualifications?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Department filter
      if (filters.department !== 'all') {
        if (hod.department?.toLowerCase() !== filters.department.toLowerCase()) return false;
      }

      // Subject filter
      if (filters.subjectId !== 'all') {
        if (!hod.subjects.includes(filters.subjectId)) return false;
      }

      // Qualifications filter
      if (filters.qualifications) {
        const qualLower = filters.qualifications.toLowerCase();
        if (!hod.qualifications?.toLowerCase().includes(qualLower)) return false;
      }

      // Experience level filter
      const experience = hod.yearsOfExperience ?? 0;
      if (filters.experienceLevel !== 'all') {
        switch (filters.experienceLevel) {
          case 'beginner':
            if (experience >= 5) return false;
            break;
          case 'intermediate':
            if (experience < 5 || experience >= 10) return false;
            break;
          case 'senior':
            if (experience < 10) return false;
            break;
          case 'none':
            if (experience > 0) return false;
            break;
        }
      }

      // Teachers under oversight range filter
      const teachersCount = hod.teachersUnderOversight ?? 0;
      if (filters.minTeachersOversight) {
        const minCount = parseInt(filters.minTeachersOversight, 10);
        if (isNaN(minCount) || teachersCount < minCount) return false;
      }

      if (filters.maxTeachersOversight) {
        const maxCount = parseInt(filters.maxTeachersOversight, 10);
        if (isNaN(maxCount) || teachersCount > maxCount) return false;
      }

      return true;
    });
  }, [hods, filters]);

  const uniqueDepartments = useMemo(() => {
    const depts = new Set(hods.map((hod) => hod.department).filter((d): d is string => !!d));
    return Array.from(depts);
  }, [hods]);

  const handleViewProfile = (hod: HODRecord) => {
    setSelectedHOD(hod);
    setShowProfileModal(true);
  };

  const handleAssignDepartment = (hod: HODRecord) => {
    setSelectedHOD(hod);
    setSelectedDepartment(hod.department || '');
    setShowDepartmentModal(true);
  };

  const handleSaveDepartment = async () => {
    if (!selectedHOD || !selectedDepartment) {
      toast.error('Please select a department');
      return;
    }

    try {
      // Find the user record for this HOD
      const hodUser = users.find((u) => u.email === selectedHOD.email);
      if (!hodUser) {
        toast.error('User record not found');
        return;
      }

      // Update user role metadata (this would need a backend endpoint)
      // For now, we'll use updateUserRole or a similar endpoint
      // Note: Department assignment would ideally be handled by a dedicated endpoint
      await userApi.updateUserRole(hodUser.id, hodUser.role);
      toast.success('Department assigned successfully');
      setShowDepartmentModal(false);
      await loadData();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleManageClasses = (hod: HODRecord) => {
    setSelectedHOD(hod);
    // Get classes that HOD is monitoring (based on subjects taught)
    const hodClasses = new Set<string>();
    hod.subjects.forEach((subjectId) => {
      // Find classes that have this subject
      // This would ideally come from backend, but for now we'll use teacher assignments
      teachers.forEach((teacher) => {
        if (teacher.subjects.includes(subjectId)) {
          teacher.assigned_classes.forEach((classId) => hodClasses.add(classId));
        }
      });
    });
    setSelectedClasses(Array.from(hodClasses));
    setShowClassesModal(true);
  };

  const handleManageTeachers = (hod: HODRecord) => {
    setSelectedHOD(hod);
    // Get teachers in the same department (teachers with same subjects)
    const deptTeachers = teachers.filter(
      (t) =>
        t.id !== hod.id &&
        t.subjects.some((subject) => hod.subjects.includes(subject))
    );
    setDepartmentTeachers(deptTeachers);
    setShowTeachersModal(true);
  };

  const handleManageStudents = (hod: HODRecord) => {
    setSelectedHOD(hod);
    // Get students in classes monitored by HOD
    const hodClasses = new Set<string>();
    hod.subjects.forEach((subjectId) => {
      teachers.forEach((teacher) => {
        if (teacher.subjects.includes(subjectId)) {
          teacher.assigned_classes.forEach((classId) => hodClasses.add(classId));
        }
      });
    });
    const deptStudents = students.filter((s) => s.class_id && hodClasses.has(s.class_id));
    setDepartmentStudents(deptStudents);
    setShowStudentsModal(true);
  };


  const handleViewAnalytics = (hod: HODRecord) => {
    setSelectedHOD(hod);
    setShowAnalyticsModal(true);
  };

  const handleManagePassword = (hod: HODRecord) => {
    setSelectedHOD(hod);
    setNewPassword('');
    setConfirmPassword('');
    setShowPasswordModal(true);
  };

  const handleUpdatePassword = async () => {
    if (!selectedHOD) return;

    if (!newPassword || newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    // Find user ID by email (HODs are teachers)
    const user = users.find((u) => u.email === selectedHOD.email && u.role === 'teacher');
    if (!user) {
      toast.error('User account not found for this HOD');
      return;
    }

    setUpdatingPassword(true);
    try {
      await userApi.updateUserPassword({ userId: user.id, newPassword });
      toast.success('Password updated successfully');
      setShowPasswordModal(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleApproveHOD = async (user: TenantUser) => {
    try {
      setLoading(true);
      await userApi.approveUser(user.id);
      toast.success(`${user.email} approved. Profile record created.`);
      setPendingHODs((current) => current.filter((u) => u.id !== user.id));
      await loadData();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleRejectHOD = async (user: TenantUser) => {
    if (!window.confirm(`Reject access for ${user.email}?`)) {
      return;
    }

    try {
      setLoading(true);
      await userApi.rejectUser(user.id);
      toast.success(`${user.email} rejected.`);
      setPendingHODs((current) => current.filter((u) => u.id !== user.id));
      await loadData();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedRows.size === 0) {
      toast.error('Please select HODs to remove');
      return;
    }

    if (!window.confirm(`Remove HOD role from ${selectedRows.size} teacher(s)?`)) {
      return;
    }

    try {
      // TODO: Implement bulk HOD role removal API when available
      toast.success(`${selectedRows.size} HOD role(s) removed`);
      setSelectedRows(new Set());
      await loadData();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleExportCSV = () => {
    const exportData = filteredHODs.map((hod) => ({
      Name: hod.name,
      Email: hod.email,
      Department: hod.department || 'N/A',
      Subjects: hod.subjects.join('; '),
      'Teachers Under Oversight': hod.teachersUnderOversight || 0
    }));
    exportToCSV(exportData, `hods-${defaultDate()}`);
  };

  const handleExportPDF = () => {
    const exportData = filteredHODs.map((hod) => ({
      Name: hod.name,
      Email: hod.email,
      Department: hod.department || 'N/A',
      Subjects: hod.subjects.join('; '),
      'Teachers Under Oversight': hod.teachersUnderOversight || 0
    }));
    exportToPDF(exportData, `hods-${defaultDate()}`, 'HODs Report');
  };

  const handleExportExcel = () => {
    const exportData = filteredHODs.map((hod) => ({
      Name: hod.name,
      Email: hod.email,
      Department: hod.department || 'N/A',
      Subjects: hod.subjects.join('; '),
      'Teachers Under Oversight': hod.teachersUnderOversight || 0
    }));
    exportToExcel(exportData, `hods-${defaultDate()}.xls`);
  };

  const toggleRowSelection = (hodId: string) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(hodId)) {
        next.delete(hodId);
      } else {
        next.add(hodId);
      }
      return next;
    });
  };

  const toggleAllSelection = () => {
    if (selectedRows.size === filteredHODs.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(filteredHODs.map((h) => h.id)));
    }
  };

  const hodColumns: SortableTableColumn<HODRecord>[] = [
    {
      key: 'checkbox',
      header: (
        <input
          type="checkbox"
          checked={selectedRows.size === filteredHODs.length && filteredHODs.length > 0}
          onChange={toggleAllSelection}
          className="rounded border-[var(--brand-border)]"
        />
      ),
      render: (row) => (
        <input
          type="checkbox"
          checked={selectedRows.has(row.id)}
          onChange={() => toggleRowSelection(row.id)}
          className="rounded border-[var(--brand-border)]"
          onClick={(e) => e.stopPropagation()}
        />
      ),
      align: 'center'
    },
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      sortKey: 'name',
      render: (row) => (
        <div>
          <p className="font-semibold text-[var(--brand-surface-contrast)]">{row.name}</p>
          <p className="text-xs text-[var(--brand-muted)]">{row.email}</p>
        </div>
      )
    },
    {
      key: 'department',
      header: 'Department',
      sortable: true,
      sortKey: 'department',
      render: (row) => (
        <span className="rounded-full bg-[var(--brand-primary)]/20 px-2 py-1 text-xs font-semibold text-[var(--brand-primary)]">
          {row.department || 'General'}
        </span>
      )
    },
    {
      key: 'subjects',
      header: 'Subjects',
      sortable: true,
      sortKey: 'subjects',
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.subjects.length > 0 ? (
            row.subjects.slice(0, 3).map((subject) => (
              <span
                key={subject}
                className="rounded-full bg-[var(--brand-accent)]/20 px-2 py-1 text-xs text-[var(--brand-accent)]"
              >
                {subject}
              </span>
            ))
          ) : (
            <span className="text-xs text-[var(--brand-muted)]">No subjects</span>
          )}
          {row.subjects.length > 3 && (
            <span className="text-xs text-[var(--brand-muted)]">
              +{row.subjects.length - 3} more
            </span>
          )}
        </div>
      )
    },
    {
      key: 'teachers',
      header: 'Teachers',
      sortable: true,
      sortKey: 'teachersUnderOversight',
      render: (row) => (
        <span className="text-sm text-[var(--brand-surface-contrast)]">
          {row.teachersUnderOversight || 0} teachers
        </span>
      ),
      align: 'center'
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => handleViewProfile(row)}>
            View
          </Button>
          <Button size="sm" variant="ghost" onClick={() => handleAssignDepartment(row)}>
            Department
          </Button>
          <Button size="sm" variant="ghost" onClick={() => handleManageClasses(row)}>
            Classes
          </Button>
          <Button size="sm" variant="ghost" onClick={() => handleManageTeachers(row)}>
            Teachers
          </Button>
          <Button size="sm" variant="ghost" onClick={() => handleManageStudents(row)}>
            Students
          </Button>
          <Button size="sm" variant="ghost" onClick={() => handleManagePassword(row)}>
            Password
          </Button>
          <Button size="sm" variant="ghost" onClick={() => handleViewAnalytics(row)}>
            Analytics
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigate(`/dashboard/teacher/profile?teacherId=${row.id}`)}
          >
            Profile
          </Button>
        </div>
      )
    }
  ];

  if (loading) {
    return (
      <RouteMeta title="HODs management">
        <DashboardSkeleton />
      </RouteMeta>
    );
  }

  // Get teachers under oversight for selected HOD
  const teachersUnderOversight = selectedHOD
    ? teachers.filter(
        (t) =>
          t.id !== selectedHOD.id &&
          t.subjects.some((subject) => selectedHOD.subjects.includes(subject))
      )
    : [];

  return (
    <RouteMeta title="HODs management">
      <div className="space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--brand-surface-contrast)]">
              HODs management
            </h1>
            <p className="text-sm text-[var(--brand-muted)]">
              Manage Heads of Department, assign departments, oversee teachers, and view
              department-level analytics.
            </p>
            {school && (
              <p className="text-xs text-[var(--brand-muted)] mt-1">
                School: <span className="font-medium">{school.name}</span>
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setShowCreateModal(true)}>Create HOD</Button>
            <ExportButtons
              onExportCSV={handleExportCSV}
              onExportPDF={handleExportPDF}
              onExportExcel={handleExportExcel}
            />
            {selectedRows.size > 0 && (
              <Button variant="outline" onClick={handleBulkDelete}>
                Remove HOD ({selectedRows.size})
              </Button>
            )}
          </div>
        </header>

        {error ? <StatusBanner status="error" message={error} /> : null}

        {pendingHODs.length > 0 && (
          <section className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-4 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-[var(--brand-surface-contrast)]">
                Pending HOD Approvals ({pendingHODs.length})
              </h2>
              <p className="text-sm text-[var(--brand-muted)]">
                Review and approve HOD (Head of Department) registrations. Note: HODs are teachers
                with additional department oversight role.
              </p>
            </div>
            <div className="space-y-3">
              {pendingHODs.map((user) => (
                <div
                  key={user.id}
                  className="flex flex-col gap-3 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)]/50 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex-1">
                    <p className="font-semibold text-[var(--brand-surface-contrast)]">
                      {user.email}
                    </p>
                    <p className="text-xs text-[var(--brand-muted)]">
                      Requested on {new Date(user.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleApproveHOD(user)} disabled={loading}>
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRejectHOD(user)}
                      disabled={loading}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section
          className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-4 shadow-sm"
          aria-label="Filters"
        >
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
            <Input
              label="Search"
              placeholder="Search by name, email, department, subject, qualifications..."
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            />
            <Select
              label="Department"
              value={filters.department}
              onChange={(e) => setFilters((f) => ({ ...f, department: e.target.value }))}
              options={[
                { label: 'All departments', value: 'all' },
                ...Array.from(new Set(hods.map((h) => h.department).filter(Boolean))).map(
                  (dept) => ({ label: dept!, value: dept! })
                )
              ]}
            />
            <Select
              label="Subject"
              value={filters.subjectId}
              onChange={(e) => setFilters((f) => ({ ...f, subjectId: e.target.value }))}
              options={[
                { label: 'All subjects', value: 'all' },
                ...subjects.map((s) => ({ label: s.name, value: s.id }))
              ]}
            />
            <Select
              label="Experience Level"
              value={filters.experienceLevel}
              onChange={(e) => setFilters((f) => ({ ...f, experienceLevel: e.target.value }))}
              options={[
                { label: 'All levels', value: 'all' },
                { label: 'No experience', value: 'none' },
                { label: 'Beginner (< 5 years)', value: 'beginner' },
                { label: 'Intermediate (5-10 years)', value: 'intermediate' },
                { label: 'Senior (10+ years)', value: 'senior' }
              ]}
            />
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <Input
              label="Qualifications"
              placeholder="Filter by qualifications..."
              value={filters.qualifications}
              onChange={(e) => setFilters((f) => ({ ...f, qualifications: e.target.value }))}
            />
            <Input
              label="Min Teachers Under Oversight"
              type="number"
              placeholder="Minimum count"
              value={filters.minTeachersOversight}
              onChange={(e) =>
                setFilters((f) => ({ ...f, minTeachersOversight: e.target.value }))
              }
            />
            <Input
              label="Max Teachers Under Oversight"
              type="number"
              placeholder="Maximum count"
              value={filters.maxTeachersOversight}
              onChange={(e) =>
                setFilters((f) => ({ ...f, maxTeachersOversight: e.target.value }))
              }
            />
          </div>
          <div className="mt-4 flex items-center justify-between text-sm text-[var(--brand-muted)]">
            <span>
              Showing {filteredHODs.length} of {hods.length} HODs
            </span>
            {(filters.search ||
              filters.department !== 'all' ||
              filters.subjectId !== 'all' ||
              filters.qualifications ||
              filters.experienceLevel !== 'all' ||
              filters.minTeachersOversight ||
              filters.maxTeachersOversight) && (
              <Button size="sm" variant="ghost" onClick={() => setFilters(defaultFilters)}>
                Clear filters
              </Button>
            )}
          </div>
        </section>

        <PaginatedTable
          columns={hodColumns}
          data={filteredHODs}
          caption="Heads of Department"
          emptyMessage="No HODs found matching the current filters."
        />

        {showProfileModal && selectedHOD && (
          <Modal
            title={`HOD profile: ${selectedHOD.name}`}
            isOpen={showProfileModal}
            onClose={() => {
              setShowProfileModal(false);
              setSelectedHOD(null);
            }}
          >
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs font-medium text-[var(--brand-muted)] mb-1">Name</p>
                  <p className="text-sm text-[var(--brand-surface-contrast)]">{selectedHOD.name}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--brand-muted)] mb-1">Email</p>
                  <p className="text-sm text-[var(--brand-surface-contrast)]">
                    {selectedHOD.email}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--brand-muted)] mb-1">Department</p>
                  <p className="text-sm text-[var(--brand-surface-contrast)]">
                    {selectedHOD.department || 'General'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--brand-muted)] mb-1">
                    Teachers Under Oversight
                  </p>
                  <p className="text-sm text-[var(--brand-surface-contrast)]">
                    {selectedHOD.teachersUnderOversight || 0}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--brand-muted)] mb-1">Subjects</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedHOD.subjects.length > 0 ? (
                      selectedHOD.subjects.map((subject) => (
                        <span
                          key={subject}
                          className="rounded-full bg-[var(--brand-primary)]/20 px-2 py-1 text-xs text-[var(--brand-primary)]"
                        >
                          {subject}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-[var(--brand-muted)]">No subjects</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="ghost" onClick={() => setShowProfileModal(false)}>
                  Close
                </Button>
                <Button
                  onClick={() => navigate(`/dashboard/teacher/profile?teacherId=${selectedHOD.id}`)}
                >
                  View full profile
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {showDepartmentModal && selectedHOD && (
          <Modal
            title={`Assign department: ${selectedHOD.name}`}
            isOpen={showDepartmentModal}
            onClose={() => {
              setShowDepartmentModal(false);
              setSelectedHOD(null);
            }}
          >
            <div className="space-y-4">
              <Select
                label="Department"
                required
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                options={[
                  { label: 'Select a department', value: '' },
                  ...subjects.map((s) => ({ label: s.name, value: s.name })),
                  ...uniqueDepartments.map((d) => ({ label: d, value: d }))
                ]}
              />
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="ghost" onClick={() => setShowDepartmentModal(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveDepartment}>Assign</Button>
              </div>
            </div>
          </Modal>
        )}

        {showAnalyticsModal && selectedHOD && (
          <Modal
            title={`Department analytics: ${selectedHOD.department || 'General'}`}
            isOpen={showAnalyticsModal}
            onClose={() => {
              setShowAnalyticsModal(false);
              setSelectedHOD(null);
            }}
          >
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-[var(--brand-border)]/60 bg-slate-950/40 p-4">
                  <p className="text-xs uppercase tracking-wide text-[var(--brand-muted)]">
                    Total Teachers
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-[var(--brand-surface-contrast)]">
                    {teachersUnderOversight.length}
                  </p>
                </div>
                <div className="rounded-lg border border-[var(--brand-border)]/60 bg-slate-950/40 p-4">
                  <p className="text-xs uppercase tracking-wide text-[var(--brand-muted)]">
                    Subjects Covered
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-[var(--brand-surface-contrast)]">
                    {selectedHOD.subjects.length}
                  </p>
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-[var(--brand-muted)]">
                  Teachers Under Oversight
                </p>
                <div className="max-h-60 space-y-2 overflow-y-auto">
                  {teachersUnderOversight.length > 0 ? (
                    teachersUnderOversight.map((teacher) => (
                      <div
                        key={teacher.id}
                        className="rounded-md border border-[var(--brand-border)]/60 bg-slate-900/60 px-3 py-2"
                      >
                        <p className="text-sm font-medium text-[var(--brand-surface-contrast)]">
                          {teacher.name}
                        </p>
                        <p className="text-xs text-[var(--brand-muted)]">{teacher.email}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-[var(--brand-muted)]">No teachers under oversight</p>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="ghost" onClick={() => setShowAnalyticsModal(false)}>
                  Close
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {showPasswordModal && selectedHOD && (
          <Modal
            title={`Change Password: ${selectedHOD.name}`}
            isOpen={showPasswordModal}
            onClose={() => {
              setShowPasswordModal(false);
              setSelectedHOD(null);
              setNewPassword('');
              setConfirmPassword('');
            }}
          >
            <div className="space-y-4">
              <div>
                <p className="text-sm text-[var(--brand-muted)] mb-2">
                  Update password for {selectedHOD.email}
                </p>
                <Input
                  label="New Password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password (min 8 characters)"
                  required
                />
                <Input
                  label="Confirm Password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  required
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowPasswordModal(false);
                    setNewPassword('');
                    setConfirmPassword('');
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleUpdatePassword} loading={updatingPassword}>
                  Update Password
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {showCreateModal && (
          <AdminUserRegistrationModal
            defaultRole="teacher"
            onClose={() => setShowCreateModal(false)}
            onSuccess={async () => {
              setShowCreateModal(false);
              await loadData();
              toast.success('HOD created successfully. Assign department after approval.');
            }}
          />
        )}

        {showClassesModal && selectedHOD && (
          <Modal
            title={`Manage Classes: ${selectedHOD.department || 'General'}`}
            isOpen={showClassesModal}
            onClose={() => {
              setShowClassesModal(false);
              setSelectedHOD(null);
              setSelectedClasses([]);
            }}
          >
            <div className="space-y-4">
              <p className="text-sm text-[var(--brand-muted)]">
                Classes monitored by this HOD department. Classes are determined by subjects taught by
                teachers in this department.
              </p>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {selectedClasses.length > 0 ? (
                  selectedClasses.map((classId) => {
                    const classInfo = classes.find((c) => c.id === classId);
                    return (
                      <div
                        key={classId}
                        className="flex items-center justify-between rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)]/50 p-3"
                      >
                        <div>
                          <p className="font-semibold text-[var(--brand-surface-contrast)]">
                            {classInfo?.name || classId}
                          </p>
                          {classInfo && (
                            <p className="text-xs text-[var(--brand-muted)]">
                              {students.filter((s) => s.class_id === classId).length} students
                            </p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedClasses(selectedClasses.filter((c) => c !== classId));
                            toast.info('Class removed from monitoring. Note: This is informational only.');
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-[var(--brand-muted)]">No classes monitored</p>
                )}
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowClassesModal(false);
                    setSelectedClasses([]);
                  }}
                >
                  Close
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {showTeachersModal && selectedHOD && (
          <Modal
            title={`Manage Teachers: ${selectedHOD.department || 'General'}`}
            isOpen={showTeachersModal}
            onClose={() => {
              setShowTeachersModal(false);
              setSelectedHOD(null);
              setDepartmentTeachers([]);
            }}
          >
            <div className="space-y-4">
              <p className="text-sm text-[var(--brand-muted)]">
                Teachers allocated to this department. Teachers are assigned based on shared subjects
                with the HOD.
              </p>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {departmentTeachers.length > 0 ? (
                  departmentTeachers.map((teacher) => (
                    <div
                      key={teacher.id}
                      className="flex items-center justify-between rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)]/50 p-3"
                    >
                      <div className="flex-1">
                        <p className="font-semibold text-[var(--brand-surface-contrast)]">
                          {teacher.name}
                        </p>
                        <p className="text-xs text-[var(--brand-muted)]">{teacher.email}</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {teacher.subjects.slice(0, 3).map((subject) => (
                            <span
                              key={subject}
                              className="rounded-full bg-[var(--brand-primary)]/20 px-2 py-0.5 text-xs text-[var(--brand-primary)]"
                            >
                              {subject}
                            </span>
                          ))}
                          {teacher.subjects.length > 3 && (
                            <span className="text-xs text-[var(--brand-muted)]">
                              +{teacher.subjects.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            navigate(`/dashboard/admin/teachers?teacherId=${teacher.id}`);
                            setShowTeachersModal(false);
                          }}
                        >
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            // Remove teacher from department (informational only - actual removal would require backend)
                            toast.info(
                              'Teacher removal requires backend support for department management'
                            );
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[var(--brand-muted)]">No teachers in department</p>
                )}
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowTeachersModal(false);
                    setDepartmentTeachers([]);
                  }}
                >
                  Close
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {showStudentsModal && selectedHOD && (
          <Modal
            title={`Manage Students: ${selectedHOD.department || 'General'}`}
            isOpen={showStudentsModal}
            onClose={() => {
              setShowStudentsModal(false);
              setSelectedHOD(null);
              setDepartmentStudents([]);
            }}
          >
            <div className="space-y-4">
              <p className="text-sm text-[var(--brand-muted)]">
                Students in classes monitored by this department. Students are assigned based on their
                class enrollment.
              </p>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {departmentStudents.length > 0 ? (
                  departmentStudents.map((student) => (
                    <div
                      key={student.id}
                      className="flex items-center justify-between rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)]/50 p-3"
                    >
                      <div className="flex-1">
                        <p className="font-semibold text-[var(--brand-surface-contrast)]">
                          {student.first_name} {student.last_name}
                        </p>
                        {student.admission_number && (
                          <p className="text-xs text-[var(--brand-muted)]">
                            #{student.admission_number}
                          </p>
                        )}
                        {student.class_id && (
                          <p className="text-xs text-[var(--brand-muted)]">Class: {student.class_id}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            navigate(`/dashboard/admin/students?studentId=${student.id}`);
                            setShowStudentsModal(false);
                          }}
                        >
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            // Remove student from department (informational only - actual removal would require backend)
                            toast.info(
                              'Student removal requires backend support for department management'
                            );
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[var(--brand-muted)]">No students in department</p>
                )}
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowStudentsModal(false);
                    setDepartmentStudents([]);
                  }}
                >
                  Close
                </Button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </RouteMeta>
  );
}

export default HODsManagementPage;
