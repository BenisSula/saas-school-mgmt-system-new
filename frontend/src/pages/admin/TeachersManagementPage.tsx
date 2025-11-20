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
  type SchoolClass,
  type Subject,
  type TenantUser
} from '../../lib/api';
import { userApi } from '../../lib/api/userApi';
import { defaultDate } from '../../lib/utils/date';
import { AdminUserRegistrationModal } from '../../components/admin/AdminUserRegistrationModal';

interface TeacherFilters {
  search: string;
  classId: string;
  subjectId: string;
  qualifications: string;
  experienceLevel: string;
  minExperience: string;
  maxExperience: string;
}

const defaultFilters: TeacherFilters = {
  search: '',
  classId: 'all',
  subjectId: 'all',
  qualifications: '',
  experienceLevel: 'all',
  minExperience: '',
  maxExperience: ''
};

export function TeachersManagementPage() {
  const navigate = useNavigate();
  const [teachers, setTeachers] = useState<TeacherProfile[]>([]);
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [school, setSchool] = useState<{ id: string; name: string; address?: Record<string, unknown> } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<TeacherFilters>(defaultFilters);
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [showAssignmentModal, setShowAssignmentModal] = useState<boolean>(false);
  const [showSubjectsModal, setShowSubjectsModal] = useState<boolean>(false);
  const [showAssignmentsModal, setShowAssignmentsModal] = useState<boolean>(false);
  const [showReportsModal, setShowReportsModal] = useState<boolean>(false);
  const [showPasswordModal, setShowPasswordModal] = useState<boolean>(false);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [pendingTeachers, setPendingTeachers] = useState<TenantUser[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherProfile | null>(null);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [isClassTeacher, setIsClassTeacher] = useState<boolean>(false);
  const [assignmentRoom, setAssignmentRoom] = useState<string>('');
  const [teacherAssignments, setTeacherAssignments] = useState<
    Array<{
      id: string;
      classId: string;
      className: string;
      subjectId: string;
      subjectName: string;
      isClassTeacher: boolean;
      room?: string;
    }>
  >([]);
  const [editingAssignment, setEditingAssignment] = useState<string | null>(null);
  const [editAssignmentClassTeacher, setEditAssignmentClassTeacher] = useState<boolean>(false);
  const [editAssignmentRoom, setEditAssignmentRoom] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [updatingPassword, setUpdatingPassword] = useState<boolean>(false);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [teachersResult, usersResult, pendingUsersResult, classesResult, subjectsResult, schoolResult] =
        await Promise.allSettled([
          api.listTeachers(),
          userApi.listUsers(),
          userApi.listPendingUsers(),
          api.listClasses(),
          api.admin.listSubjects(),
          api.getSchool()
        ]);

      if (teachersResult.status === 'fulfilled') {
        // Filter out HODs - they should be managed in HODsManagementPage
        const allTeachers = teachersResult.value;
        if (usersResult.status === 'fulfilled') {
          const hodEmails = new Set(
            usersResult.value
              .filter((u) => u.role === 'teacher' && u.additional_roles?.some((r) => r.role === 'hod'))
              .map((u) => u.email.toLowerCase())
          );
          const regularTeachers = allTeachers.filter(
            (t) => !hodEmails.has(t.email?.toLowerCase() ?? '')
          );
          setTeachers(regularTeachers);
        } else {
          setTeachers(allTeachers);
        }
      } else {
        throw new Error((teachersResult.reason as Error).message || 'Failed to load teachers');
      }

      if (usersResult.status === 'fulfilled') {
        setUsers(usersResult.value);
      }

      if (pendingUsersResult.status === 'fulfilled') {
        // Filter pending users by teacher role, excluding HODs
        const pending = pendingUsersResult.value.filter(
          (u) =>
            u.role === 'teacher' &&
            u.status === 'pending' &&
            !u.additional_roles?.some((r) => r.role === 'hod')
        );
        setPendingTeachers(pending);
      }

      if (classesResult.status === 'fulfilled') {
        setClasses(classesResult.value);
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

  const filteredTeachers = useMemo(() => {
    return teachers.filter((teacher) => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesSearch =
          teacher.name.toLowerCase().includes(searchLower) ||
          teacher.email.toLowerCase().includes(searchLower) ||
          teacher.subjects.some((s) => s.toLowerCase().includes(searchLower)) ||
          teacher.assigned_classes.some((c) => c.toLowerCase().includes(searchLower)) ||
          teacher.qualifications?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Class filter
      if (filters.classId !== 'all') {
        if (!teacher.assigned_classes.includes(filters.classId)) return false;
      }

      // Subject filter
      if (filters.subjectId !== 'all') {
        if (!teacher.subjects.includes(filters.subjectId)) return false;
      }

      // Qualifications filter
      if (filters.qualifications) {
        const qualLower = filters.qualifications.toLowerCase();
        if (!teacher.qualifications?.toLowerCase().includes(qualLower)) return false;
      }

      // Experience level filter
      const experience = teacher.yearsOfExperience ?? 0;
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

      // Min/Max experience range filter
      if (filters.minExperience) {
        const minExp = parseInt(filters.minExperience, 10);
        if (isNaN(minExp) || experience < minExp) return false;
      }

      if (filters.maxExperience) {
        const maxExp = parseInt(filters.maxExperience, 10);
        if (isNaN(maxExp) || experience > maxExp) return false;
      }

      return true;
    });
  }, [teachers, filters]);

  const handleViewProfile = (teacher: TeacherProfile) => {
    setSelectedTeacher(teacher);
    setShowProfileModal(true);
  };

  const handleAssignClass = (teacher: TeacherProfile) => {
    setSelectedTeacher(teacher);
    setSelectedClass('');
    setSelectedSubject('');
    setIsClassTeacher(false);
    setShowAssignmentModal(true);
  };

  const handleSaveAssignment = async () => {
    if (!selectedTeacher || !selectedClass || !selectedSubject) {
      toast.error('Please select class and subject');
      return;
    }

    try {
      // Assign teacher to class/subject via admin API
      await api.admin.assignTeacher(selectedTeacher.id, {
        classId: selectedClass,
        subjectId: selectedSubject,
        isClassTeacher,
        metadata: assignmentRoom ? { room: assignmentRoom } : undefined
      });

      // Also update teacher's assigned_classes and subjects arrays
      const updatedClasses = selectedTeacher.assigned_classes.includes(selectedClass)
        ? selectedTeacher.assigned_classes
        : [...selectedTeacher.assigned_classes, selectedClass];

      const updatedSubjects = selectedTeacher.subjects.includes(selectedSubject)
        ? selectedTeacher.subjects
        : [...selectedTeacher.subjects, selectedSubject];

      await api.updateTeacher(selectedTeacher.id, {
        assignedClasses: updatedClasses,
        subjects: updatedSubjects
      });

      toast.success('Teacher assigned successfully');
      setShowAssignmentModal(false);
      setSelectedClass('');
      setSelectedSubject('');
      setIsClassTeacher(false);
      setAssignmentRoom('');
      await loadData();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleManageSubjects = async (teacher: TeacherProfile) => {
    setSelectedTeacher(teacher);
    setShowSubjectsModal(true);
  };

  const handleDeleteSubject = async (subjectId: string) => {
    if (!selectedTeacher) return;
    if (!window.confirm('Remove this subject from teacher?')) return;

    try {
      const updatedSubjects = selectedTeacher.subjects.filter((s) => s !== subjectId);
      await api.updateTeacher(selectedTeacher.id, { subjects: updatedSubjects });
      toast.success('Subject removed successfully');
      await loadData();
      setSelectedTeacher({ ...selectedTeacher, subjects: updatedSubjects });
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleManageAssignments = async (teacher: TeacherProfile) => {
    setSelectedTeacher(teacher);
    try {
      const allAssignments = await api.admin.listTeacherAssignments();
      const teacherAssigns = allAssignments
        .filter((a) => a.teacher_id === teacher.id)
        .map((a) => ({
          id: a.id,
          classId: a.class_id,
          className: a.class_name,
          subjectId: a.subject_id,
          subjectName: a.subject_name,
          isClassTeacher: a.is_class_teacher,
          room: (a.metadata as { room?: string })?.room
        }));
      setTeacherAssignments(teacherAssigns);
      setShowAssignmentsModal(true);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleEditAssignment = (assignmentId: string) => {
    const assignment = teacherAssignments.find((a) => a.id === assignmentId);
    if (assignment) {
      setEditingAssignment(assignmentId);
      setEditAssignmentClassTeacher(assignment.isClassTeacher);
      setEditAssignmentRoom(assignment.room || '');
    }
  };

  const handleSaveAssignmentEdit = async () => {
    if (!editingAssignment || !selectedTeacher) return;

    try {
      const assignment = teacherAssignments.find((a) => a.id === editingAssignment);
      if (!assignment) return;

      // Update assignment via admin API
      await api.admin.assignTeacher(selectedTeacher.id, {
        classId: assignment.classId,
        subjectId: assignment.subjectId,
        isClassTeacher: editAssignmentClassTeacher,
        metadata: editAssignmentRoom ? { room: editAssignmentRoom } : undefined
      });

      toast.success('Assignment updated successfully');
      setEditingAssignment(null);
      setEditAssignmentClassTeacher(false);
      setEditAssignmentRoom('');
      await handleManageAssignments(selectedTeacher);
      await loadData();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleDeleteAssignment = async (assignmentId: string) => {
    if (!window.confirm('Remove this assignment?')) return;

    try {
      await api.admin.removeTeacherAssignment(assignmentId);
      toast.success('Assignment removed successfully');
      await handleManageAssignments(selectedTeacher!);
      await loadData();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedRows.size === 0) {
      toast.error('Please select teachers to delete');
      return;
    }

    if (!window.confirm(`Delete ${selectedRows.size} teacher(s)?`)) {
      return;
    }

    try {
      const deletePromises = Array.from(selectedRows).map((id) => api.deleteTeacher(id));
      await Promise.all(deletePromises);
      toast.success(`${selectedRows.size} teacher(s) deleted`);
      setSelectedRows(new Set());
      await loadData();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleExportCSV = () => {
    const exportData = filteredTeachers.map((t) => ({
      Name: t.name,
      Email: t.email,
      Subjects: t.subjects.join('; '),
      Classes: t.assigned_classes.join('; '),
      Qualifications: t.qualifications || 'N/A',
      'Years of Experience': t.yearsOfExperience || 0
    }));
    exportToCSV(exportData, `teachers-${defaultDate()}`);
  };

  const handleViewReports = (teacher: TeacherProfile) => {
    setSelectedTeacher(teacher);
    setShowReportsModal(true);
  };

  const handleManagePassword = (teacher: TeacherProfile) => {
    setSelectedTeacher(teacher);
    setNewPassword('');
    setConfirmPassword('');
    setShowPasswordModal(true);
  };

  const handleUpdatePassword = async () => {
    if (!selectedTeacher) return;

    if (!newPassword || newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    // Find user ID by email
    const user = users.find((u) => u.email === selectedTeacher.email && u.role === 'teacher');
    if (!user) {
      toast.error('User account not found for this teacher');
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

  const handleApproveTeacher = async (user: TenantUser) => {
    try {
      setLoading(true);
      await userApi.approveUser(user.id);
      toast.success(`${user.email} approved. Profile record created.`);
      setPendingTeachers((current) => current.filter((u) => u.id !== user.id));
      await loadData();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleRejectTeacher = async (user: TenantUser) => {
    if (!window.confirm(`Reject access for ${user.email}?`)) {
      return;
    }

    try {
      setLoading(true);
      await userApi.rejectUser(user.id);
      toast.success(`${user.email} rejected.`);
      setPendingTeachers((current) => current.filter((u) => u.id !== user.id));
      await loadData();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = () => {
    const exportData = filteredTeachers.map((t) => ({
      Name: t.name,
      Email: t.email,
      Subjects: t.subjects.join('; '),
      Classes: t.assigned_classes.join('; '),
      Qualifications: t.qualifications || 'N/A',
      'Years of Experience': t.yearsOfExperience || 0
    }));
    exportToPDF(exportData, `teachers-${defaultDate()}`, 'Teachers Report');
  };

  const handleExportExcel = () => {
    const exportData = filteredTeachers.map((t) => ({
      Name: t.name,
      Email: t.email,
      Subjects: t.subjects.join('; '),
      Classes: t.assigned_classes.join('; '),
      Qualifications: t.qualifications || 'N/A',
      'Years of Experience': t.yearsOfExperience || 0
    }));
    exportToExcel(exportData, `teachers-${defaultDate()}.xls`);
  };

  const toggleRowSelection = (teacherId: string) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(teacherId)) {
        next.delete(teacherId);
      } else {
        next.add(teacherId);
      }
      return next;
    });
  };

  const toggleAllSelection = () => {
    if (selectedRows.size === filteredTeachers.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(filteredTeachers.map((t) => t.id)));
    }
  };

  const teacherColumns: SortableTableColumn<TeacherProfile>[] = [
    {
      key: 'checkbox',
      header: (
        <input
          type="checkbox"
          checked={selectedRows.size === filteredTeachers.length && filteredTeachers.length > 0}
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
          {school && (
            <p className="text-xs text-[var(--brand-muted)] mt-1">
              <span className="font-medium">School:</span> {school.name}
            </p>
          )}
        </div>
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
            row.subjects.map((subject) => (
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
      )
    },
    {
      key: 'classes',
      header: 'Classes',
      sortable: true,
      sortKey: 'assigned_classes',
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.assigned_classes.length > 0 ? (
            row.assigned_classes.map((className) => (
              <span
                key={className}
                className="rounded-full bg-[var(--brand-accent)]/20 px-2 py-1 text-xs text-[var(--brand-accent)]"
              >
                {className}
              </span>
            ))
          ) : (
            <span className="text-xs text-[var(--brand-muted)]">No classes</span>
          )}
        </div>
      )
    },
    {
      key: 'qualifications',
      header: 'Qualifications',
      sortable: true,
      sortKey: 'qualifications',
      render: (row) => (
        <span className="text-sm text-[var(--brand-surface-contrast)]">
          {row.qualifications || 'N/A'}
        </span>
      )
    },
    {
      key: 'experience',
      header: 'Experience',
      sortable: true,
      sortKey: 'yearsOfExperience',
      render: (row) => (
        <span className="text-sm text-[var(--brand-surface-contrast)]">
          {row.yearsOfExperience ? `${row.yearsOfExperience} years` : 'N/A'}
        </span>
      )
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => handleViewProfile(row)}>
            View
          </Button>
          <Button size="sm" variant="ghost" onClick={() => handleAssignClass(row)}>
            Assign
          </Button>
          <Button size="sm" variant="ghost" onClick={() => handleManageSubjects(row)}>
            Subjects
          </Button>
          <Button size="sm" variant="ghost" onClick={() => handleManageAssignments(row)}>
            Assignments
          </Button>
          <Button size="sm" variant="ghost" onClick={() => handleViewReports(row)}>
            Reports
          </Button>
          <Button size="sm" variant="ghost" onClick={() => handleManagePassword(row)}>
            Password
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
      <RouteMeta title="Teachers management">
        <DashboardSkeleton />
      </RouteMeta>
    );
  }

  return (
    <RouteMeta title="Teachers management">
      <div className="space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--brand-surface-contrast)]">
              Teachers management
            </h1>
            <p className="text-sm text-[var(--brand-muted)]">
              Manage teachers, assign classes and subjects, view qualifications and reports.
            </p>
            {school && (
              <p className="text-xs text-[var(--brand-muted)] mt-1">
                School: <span className="font-medium">{school.name}</span>
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setShowCreateModal(true)}>Create Teacher</Button>
            <ExportButtons
              onExportCSV={handleExportCSV}
              onExportPDF={handleExportPDF}
              onExportExcel={handleExportExcel}
            />
            {selectedRows.size > 0 && (
              <Button variant="outline" onClick={handleBulkDelete}>
                Delete ({selectedRows.size})
              </Button>
            )}
          </div>
        </header>

        {error ? <StatusBanner status="error" message={error} /> : null}

        {pendingTeachers.length > 0 && (
          <section className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-4 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-[var(--brand-surface-contrast)]">
                Pending Teacher Approvals ({pendingTeachers.length})
              </h2>
              <p className="text-sm text-[var(--brand-muted)]">
                Review and approve teacher registrations
              </p>
            </div>
            <div className="space-y-3">
              {pendingTeachers.map((user) => (
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
                    <Button
                      size="sm"
                      onClick={() => handleApproveTeacher(user)}
                      disabled={loading}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRejectTeacher(user)}
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
              placeholder="Search by name, email, subject, class, qualifications..."
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            />
            <Select
              label="Class"
              value={filters.classId}
              onChange={(e) => setFilters((f) => ({ ...f, classId: e.target.value }))}
              options={[
                { label: 'All classes', value: 'all' },
                ...classes.map((c) => ({ label: c.name, value: c.id }))
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
              label="Min Experience (years)"
              type="number"
              placeholder="Minimum years"
              value={filters.minExperience}
              onChange={(e) => setFilters((f) => ({ ...f, minExperience: e.target.value }))}
            />
            <Input
              label="Max Experience (years)"
              type="number"
              placeholder="Maximum years"
              value={filters.maxExperience}
              onChange={(e) => setFilters((f) => ({ ...f, maxExperience: e.target.value }))}
            />
          </div>
          <div className="mt-4 flex items-center justify-between text-sm text-[var(--brand-muted)]">
            <span>
              Showing {filteredTeachers.length} of {teachers.length} teachers
            </span>
            {(filters.search ||
              filters.classId !== 'all' ||
              filters.subjectId !== 'all' ||
              filters.qualifications ||
              filters.experienceLevel !== 'all' ||
              filters.minExperience ||
              filters.maxExperience) && (
              <Button size="sm" variant="ghost" onClick={() => setFilters(defaultFilters)}>
                Clear filters
              </Button>
            )}
          </div>
        </section>

        <PaginatedTable
          columns={teacherColumns}
          data={filteredTeachers}
          caption="Teachers"
          emptyMessage="No teachers found matching the current filters."
        />

        {showProfileModal && selectedTeacher && (
          <Modal
            title={`Teacher profile: ${selectedTeacher.name}`}
            isOpen={showProfileModal}
            onClose={() => {
              setShowProfileModal(false);
              setSelectedTeacher(null);
            }}
          >
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs font-medium text-[var(--brand-muted)] mb-1">Name</p>
                  <p className="text-sm text-[var(--brand-surface-contrast)]">
                    {selectedTeacher.name}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--brand-muted)] mb-1">Email</p>
                  <p className="text-sm text-[var(--brand-surface-contrast)]">
                    {selectedTeacher.email}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--brand-muted)] mb-1">
                    Qualifications
                  </p>
                  <p className="text-sm text-[var(--brand-surface-contrast)]">
                    {selectedTeacher.qualifications || 'Not specified'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--brand-muted)] mb-1">
                    Years of Experience
                  </p>
                  <p className="text-sm text-[var(--brand-surface-contrast)]">
                    {selectedTeacher.yearsOfExperience || 'Not specified'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--brand-muted)] mb-1">Subjects</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedTeacher.subjects.length > 0 ? (
                      selectedTeacher.subjects.map((subject) => (
                        <span
                          key={subject}
                          className="rounded-full bg-[var(--brand-primary)]/20 px-2 py-1 text-xs text-[var(--brand-primary)]"
                        >
                          {subject}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-[var(--brand-muted)]">
                        No subjects assigned
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--brand-muted)] mb-1">Classes</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedTeacher.assigned_classes.length > 0 ? (
                      selectedTeacher.assigned_classes.map((className) => (
                        <span
                          key={className}
                          className="rounded-full bg-[var(--brand-accent)]/20 px-2 py-1 text-xs text-[var(--brand-accent)]"
                        >
                          {className}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-[var(--brand-muted)]">No classes assigned</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="ghost" onClick={() => setShowProfileModal(false)}>
                  Close
                </Button>
                <Button
                  onClick={() =>
                    navigate(`/dashboard/teacher/profile?teacherId=${selectedTeacher.id}`)
                  }
                >
                  View full profile
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {showReportsModal && selectedTeacher && (
          <Modal
            title={`Teacher Reports: ${selectedTeacher.name}`}
            isOpen={showReportsModal}
            onClose={() => {
              setShowReportsModal(false);
              setSelectedTeacher(null);
            }}
          >
            <div className="space-y-4">
              <p className="text-sm text-[var(--brand-muted)]">
                View and generate reports for this teacher's classes and students.
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    navigate(`/dashboard/reports/attendance?teacherId=${selectedTeacher.id}`);
                    setShowReportsModal(false);
                  }}
                >
                  Attendance Reports
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    navigate(`/dashboard/reports/grades?teacherId=${selectedTeacher.id}`);
                    setShowReportsModal(false);
                  }}
                >
                  Grade Reports
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    navigate(`/dashboard/reports/class-performance?teacherId=${selectedTeacher.id}`);
                    setShowReportsModal(false);
                  }}
                >
                  Class Performance
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    navigate(`/dashboard/teacher/profile?teacherId=${selectedTeacher.id}`);
                    setShowReportsModal(false);
                  }}
                >
                  Full Profile & Reports
                </Button>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="ghost" onClick={() => setShowReportsModal(false)}>
                  Close
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {showAssignmentModal && selectedTeacher && (
          <Modal
            title={`Assign class/subject: ${selectedTeacher.name}`}
            isOpen={showAssignmentModal}
            onClose={() => {
              setShowAssignmentModal(false);
              setSelectedTeacher(null);
            }}
          >
            <div className="space-y-4">
              <Select
                label="Class"
                required
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                options={[
                  { label: 'Select a class', value: '' },
                  ...classes.map((c) => ({ label: c.name, value: c.id }))
                ]}
              />
              <Select
                label="Subject"
                required
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                options={[
                  { label: 'Select a subject', value: '' },
                  ...subjects.map((s) => ({ label: s.name, value: s.id }))
                ]}
              />
              <Input
                label="Room"
                placeholder="Room number/name (optional)"
                value={assignmentRoom}
                onChange={(e) => setAssignmentRoom(e.target.value)}
              />
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isClassTeacher"
                  checked={isClassTeacher}
                  onChange={(e) => setIsClassTeacher(e.target.checked)}
                  className="rounded border-[var(--brand-border)]"
                  aria-label="Assign as class teacher"
                />
                <label
                  htmlFor="isClassTeacher"
                  className="text-sm text-[var(--brand-surface-contrast)]"
                >
                  Assign as class teacher
                </label>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowAssignmentModal(false);
                    setSelectedClass('');
                    setSelectedSubject('');
                    setIsClassTeacher(false);
                    setAssignmentRoom('');
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleSaveAssignment}>Assign</Button>
              </div>
            </div>
          </Modal>
        )}

        {showPasswordModal && selectedTeacher && (
          <Modal
            title={`Change Password: ${selectedTeacher.name}`}
            isOpen={showPasswordModal}
            onClose={() => {
              setShowPasswordModal(false);
              setSelectedTeacher(null);
              setNewPassword('');
              setConfirmPassword('');
            }}
          >
            <div className="space-y-4">
              <div>
                <p className="text-sm text-[var(--brand-muted)] mb-2">
                  Update password for {selectedTeacher.email}
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
              toast.success('Teacher created successfully');
            }}
          />
        )}

        {showSubjectsModal && selectedTeacher && (
          <Modal
            title={`Manage Subjects: ${selectedTeacher.name}`}
            isOpen={showSubjectsModal}
            onClose={() => {
              setShowSubjectsModal(false);
              setSelectedTeacher(null);
              setSelectedSubject('');
            }}
          >
            <div className="space-y-4">
              <p className="text-sm text-[var(--brand-muted)]">
                Manage subjects taught by this teacher. Add new subjects or remove existing ones.
              </p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {selectedTeacher.subjects.length > 0 ? (
                  selectedTeacher.subjects.map((subjectId) => {
                    const subject = subjects.find((s) => s.id === subjectId);
                    return (
                      <div
                        key={subjectId}
                        className="flex items-center justify-between rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)]/50 p-3"
                      >
                        <div>
                          <p className="font-semibold text-[var(--brand-surface-contrast)]">
                            {subject?.name || subjectId}
                          </p>
                          {subject?.code && (
                            <p className="text-xs text-[var(--brand-muted)]">{subject.code}</p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteSubject(subjectId)}
                        >
                          Remove
                        </Button>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-[var(--brand-muted)]">No subjects assigned</p>
                )}
              </div>
              <div className="border-t border-[var(--brand-border)] pt-4">
                <p className="mb-2 text-sm font-medium text-[var(--brand-surface-contrast)]">
                  Add New Subject
                </p>
                <Select
                  label="Select Subject"
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  options={[
                    { label: 'Select a subject', value: '' },
                    ...subjects
                      .filter((s) => !selectedTeacher.subjects.includes(s.id))
                      .map((s) => ({ label: `${s.name}${s.code ? ` (${s.code})` : ''}`, value: s.id }))
                  ]}
                />
                <div className="mt-3 flex justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (selectedSubject) {
                        const updatedSubjects = [...selectedTeacher.subjects, selectedSubject];
                        api
                          .updateTeacher(selectedTeacher.id, { subjects: updatedSubjects })
                          .then(() => {
                            toast.success('Subject added successfully');
                            setSelectedSubject('');
                            void loadData();
                            setSelectedTeacher({
                              ...selectedTeacher,
                              subjects: updatedSubjects
                            });
                          })
                          .catch((err) => {
                            toast.error((err as Error).message);
                          });
                      }
                    }}
                    disabled={!selectedSubject}
                  >
                    Add Subject
                  </Button>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="ghost" onClick={() => setShowSubjectsModal(false)}>
                  Close
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {showAssignmentsModal && selectedTeacher && (
          <Modal
            title={`Manage Assignments: ${selectedTeacher.name}`}
            isOpen={showAssignmentsModal}
            onClose={() => {
              setShowAssignmentsModal(false);
              setSelectedTeacher(null);
              setTeacherAssignments([]);
              setEditingAssignment(null);
              setEditAssignmentClassTeacher(false);
              setEditAssignmentRoom('');
            }}
          >
            <div className="space-y-4">
              <p className="text-sm text-[var(--brand-muted)]">
                Manage class/subject assignments. Edit classroom teacher status, room assignments, or
                remove assignments.
              </p>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {teacherAssignments.length > 0 ? (
                  teacherAssignments.map((assignment) => (
                    <div
                      key={assignment.id}
                      className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)]/50 p-3"
                    >
                      {editingAssignment === assignment.id ? (
                        <div className="space-y-3">
                          <div>
                            <p className="font-semibold text-[var(--brand-surface-contrast)]">
                              {assignment.className} - {assignment.subjectName}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id={`classTeacher-${assignment.id}`}
                              checked={editAssignmentClassTeacher}
                              onChange={(e) => setEditAssignmentClassTeacher(e.target.checked)}
                              className="rounded border-[var(--brand-border)]"
                            />
                            <label
                              htmlFor={`classTeacher-${assignment.id}`}
                              className="text-sm text-[var(--brand-surface-contrast)]"
                            >
                              Class Teacher
                            </label>
                          </div>
                          <Input
                            label="Room"
                            placeholder="Room number/name (optional)"
                            value={editAssignmentRoom}
                            onChange={(e) => setEditAssignmentRoom(e.target.value)}
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={handleSaveAssignmentEdit}
                              disabled={!selectedTeacher}
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingAssignment(null);
                                setEditAssignmentClassTeacher(false);
                                setEditAssignmentRoom('');
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-semibold text-[var(--brand-surface-contrast)]">
                              {assignment.className} - {assignment.subjectName}
                            </p>
                            <div className="mt-1 flex flex-wrap gap-2 text-xs">
                              {assignment.isClassTeacher && (
                                <span className="rounded-full bg-[var(--brand-primary)]/20 px-2 py-1 text-[var(--brand-primary)]">
                                  Class Teacher
                                </span>
                              )}
                              {assignment.room && (
                                <span className="text-[var(--brand-muted)]">
                                  Room: {assignment.room}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEditAssignment(assignment.id)}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeleteAssignment(assignment.id)}
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[var(--brand-muted)]">No assignments found</p>
                )}
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowAssignmentsModal(false);
                    setEditingAssignment(null);
                    setEditAssignmentClassTeacher(false);
                    setEditAssignmentRoom('');
                  }}
                >
                  Close
                </Button>
                <Button
                  onClick={() => {
                    setShowAssignmentsModal(false);
                    setEditingAssignment(null);
                    handleAssignClass(selectedTeacher);
                  }}
                >
                  Add Assignment
                </Button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </RouteMeta>
  );
}

export default TeachersManagementPage;
