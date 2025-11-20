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
  type StudentRecord,
  type SchoolClass,
  type StudentProfileDetail,
  type TenantUser,
  type Subject
} from '../../lib/api';
import { userApi } from '../../lib/api/userApi';
import { defaultDate } from '../../lib/utils/date';
import { AdminUserRegistrationModal } from '../../components/admin/AdminUserRegistrationModal';

interface StudentFilters {
  search: string;
  classId: string;
  enrollmentStatus: string;
  admissionNumber: string;
  hasParentInfo: string;
  enrollmentDateFrom: string;
  enrollmentDateTo: string;
  dateOfBirthFrom: string;
  dateOfBirthTo: string;
}

const defaultFilters: StudentFilters = {
  search: '',
  classId: 'all',
  enrollmentStatus: 'all',
  admissionNumber: '',
  hasParentInfo: 'all',
  enrollmentDateFrom: '',
  enrollmentDateTo: '',
  dateOfBirthFrom: '',
  dateOfBirthTo: ''
};

export function StudentsManagementPage() {
  const navigate = useNavigate();
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [school, setSchool] = useState<{ id: string; name: string; address?: Record<string, unknown> } | null>(null);
  const [studentDetails, setStudentDetails] = useState<Map<string, StudentProfileDetail>>(
    new Map()
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<StudentFilters>(defaultFilters);
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [showClassModal, setShowClassModal] = useState<boolean>(false);
  const [showParentModal, setShowParentModal] = useState<boolean>(false);
  const [showPasswordModal, setShowPasswordModal] = useState<boolean>(false);
  const [showSubjectsModal, setShowSubjectsModal] = useState<boolean>(false);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [pendingStudents, setPendingStudents] = useState<TenantUser[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentRecord | null>(null);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [parentName, setParentName] = useState<string>('');
  const [parentContact, setParentContact] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [updatingPassword, setUpdatingPassword] = useState<boolean>(false);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [studentsResult, usersResult, pendingUsersResult, classesResult, subjectsResult, schoolResult] =
        await Promise.allSettled([
          api.listStudents(),
          userApi.listUsers(),
          api.listPendingUsers(),
          api.listClasses(),
          api.admin.listSubjects(),
          api.getSchool()
        ]);

      if (studentsResult.status === 'fulfilled') {
        setStudents(studentsResult.value);
        // Load details for students (lazy load on demand to avoid too many requests)
        setStudentDetails(new Map());
      } else {
        throw new Error((studentsResult.reason as Error).message || 'Failed to load students');
      }

      if (usersResult.status === 'fulfilled') {
        setUsers(usersResult.value);
      }

      if (pendingUsersResult.status === 'fulfilled') {
        // Filter pending users by student role
        const pending = pendingUsersResult.value.filter(
          (u) => u.role === 'student' && u.status === 'pending'
        );
        setPendingStudents(pending);
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

  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const fullName = `${student.first_name} ${student.last_name}`.toLowerCase();
        const matchesSearch =
          fullName.includes(searchLower) ||
          student.admission_number?.toLowerCase().includes(searchLower) ||
          student.class_id?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Class filter
      if (filters.classId !== 'all') {
        if (student.class_id !== filters.classId && student.class_uuid !== filters.classId) {
          return false;
        }
      }

      // Admission number filter
      if (filters.admissionNumber) {
        const admissionLower = filters.admissionNumber.toLowerCase();
        if (!student.admission_number?.toLowerCase().includes(admissionLower)) return false;
      }

      // Parent info filter
      if (filters.hasParentInfo !== 'all') {
        const hasParent =
          Array.isArray(student.parent_contacts) && student.parent_contacts.length > 0;
        if (filters.hasParentInfo === 'yes' && !hasParent) return false;
        if (filters.hasParentInfo === 'no' && hasParent) return false;
      }

      // Enrollment date range filter
      if (filters.enrollmentDateFrom || filters.enrollmentDateTo) {
        const enrollmentDate = student.enrollment_date
          ? new Date(student.enrollment_date)
          : null;
        if (filters.enrollmentDateFrom && enrollmentDate) {
          const fromDate = new Date(filters.enrollmentDateFrom);
          if (enrollmentDate < fromDate) return false;
        }
        if (filters.enrollmentDateTo && enrollmentDate) {
          const toDate = new Date(filters.enrollmentDateTo);
          toDate.setHours(23, 59, 59, 999); // Include entire end date
          if (enrollmentDate > toDate) return false;
        }
        if ((filters.enrollmentDateFrom || filters.enrollmentDateTo) && !enrollmentDate)
          return false;
      }

      // Date of birth range filter
      if (filters.dateOfBirthFrom || filters.dateOfBirthTo) {
        const dob = student.date_of_birth ? new Date(student.date_of_birth) : null;
        if (filters.dateOfBirthFrom && dob) {
          const fromDate = new Date(filters.dateOfBirthFrom);
          if (dob < fromDate) return false;
        }
        if (filters.dateOfBirthTo && dob) {
          const toDate = new Date(filters.dateOfBirthTo);
          toDate.setHours(23, 59, 59, 999);
          if (dob > toDate) return false;
        }
        if ((filters.dateOfBirthFrom || filters.dateOfBirthTo) && !dob) return false;
      }

      // Enrollment status filter (placeholder - would need backend support)
      if (filters.enrollmentStatus !== 'all') {
        // TODO: Implement enrollment status filtering when backend supports it
      }

      return true;
    });
  }, [students, filters]);

  const handleViewProfile = async (student: StudentRecord) => {
    setSelectedStudent(student);
    // Load full profile if not already loaded
    if (!studentDetails.has(student.id)) {
      try {
        const fullStudent = await api.getStudent(student.id);
        const detail: StudentProfileDetail = {
          id: fullStudent.id,
          firstName: fullStudent.first_name,
          lastName: fullStudent.last_name,
          classId: fullStudent.class_id,
          className: fullStudent.class_id,
          admissionNumber: fullStudent.admission_number,
          parentContacts: Array.isArray(fullStudent.parent_contacts)
            ? fullStudent.parent_contacts.map((p) => ({
                name: p.name,
                contact: p.phone || p.relationship || ''
              }))
            : [],
          subjects: [] // Will be loaded separately if needed
        };
        setStudentDetails((prev) => new Map(prev).set(student.id, detail));
      } catch (err) {
        toast.error((err as Error).message);
      }
    }
    setShowProfileModal(true);
  };

  // Helper to find user by student record
  const findUserForStudent = useCallback(
    (student: StudentRecord): TenantUser | null => {
      // Try multiple matching strategies
      const firstName = student.first_name.toLowerCase();
      const lastName = student.last_name.toLowerCase();
      const admissionNumber = student.admission_number?.toLowerCase() || '';

      // Strategy 1: Match by admission number in email
      if (admissionNumber) {
        const userByAdmission = users.find(
          (u) => u.role === 'student' && u.email.toLowerCase().includes(admissionNumber)
        );
        if (userByAdmission) return userByAdmission;
      }

      // Strategy 2: Match by first name and last name in email
      const userByName = users.find(
        (u) =>
          u.role === 'student' &&
          (u.email.toLowerCase().includes(firstName) || u.email.toLowerCase().includes(lastName))
      );
      if (userByName) return userByName;

      return null;
    },
    [users]
  );

  const handleAssignClass = (student: StudentRecord) => {
    setSelectedStudent(student);
    setSelectedClass(student.class_id || '');
    setShowClassModal(true);
  };

  const handleSaveClassAssignment = async () => {
    if (!selectedStudent || !selectedClass) {
      toast.error('Please select a class');
      return;
    }

    try {
      await api.updateStudent(selectedStudent.id, { classId: selectedClass });
      toast.success('Class assigned successfully');
      setShowClassModal(false);
      setSelectedClass('');
      await loadData();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleRemoveClass = async (student: StudentRecord) => {
    if (!window.confirm(`Remove ${student.first_name} ${student.last_name} from their class?`)) {
      return;
    }

    try {
      await api.updateStudent(student.id, { classId: '' });
      toast.success('Class removed successfully');
      await loadData();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleManageSubjects = async (student: StudentRecord) => {
    setSelectedStudent(student);
    try {
      const currentSubjects = await api.admin.getStudentSubjects(student.id);
      setSelectedSubjectIds(currentSubjects.map((s) => s.subject_id));
      setShowSubjectsModal(true);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleSaveSubjects = async () => {
    if (!selectedStudent) return;

    try {
      await api.admin.setStudentSubjects(selectedStudent.id, selectedSubjectIds);
      toast.success('Subjects updated successfully');
      setShowSubjectsModal(false);
      await loadData();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleManageParent = async (student: StudentRecord) => {
    setSelectedStudent(student);
    // Load student data if not already loaded
    if (!studentDetails.has(student.id)) {
      try {
        const fullStudent = await api.getStudent(student.id);
        const detail: StudentProfileDetail = {
          id: fullStudent.id,
          firstName: fullStudent.first_name,
          lastName: fullStudent.last_name,
          classId: fullStudent.class_id,
          className: fullStudent.class_id,
          admissionNumber: fullStudent.admission_number,
          parentContacts: Array.isArray(fullStudent.parent_contacts)
            ? fullStudent.parent_contacts.map((p) => ({
                name: p.name,
                contact: p.phone || p.relationship || ''
              }))
            : [],
          subjects: []
        };
        setStudentDetails((prev) => new Map(prev).set(student.id, detail));
      } catch (err) {
        toast.error((err as Error).message);
      }
    }

    const detail = studentDetails.get(student.id);
    const parentContacts = detail?.parentContacts || [];
    if (Array.isArray(parentContacts) && parentContacts.length > 0) {
      const firstParent = parentContacts[0] as { name?: string; contact?: string };
      setParentName(firstParent.name || '');
      setParentContact(firstParent.contact || '');
    } else {
      // Check if student has parent_contacts in the raw data
      const rawStudent = students.find((s) => s.id === student.id);
      if (
        rawStudent &&
        Array.isArray(rawStudent.parent_contacts) &&
        rawStudent.parent_contacts.length > 0
      ) {
        const firstParent = rawStudent.parent_contacts[0];
        setParentName(firstParent.name || '');
        setParentContact(firstParent.phone || firstParent.relationship || '');
      } else {
        setParentName('');
        setParentContact('');
      }
    }
    setShowParentModal(true);
  };

  const handleSaveParent = async () => {
    if (!selectedStudent || !parentName || !parentContact) {
      toast.error('Please provide parent/guardian name and contact');
      return;
    }

    try {
      const existingStudent = students.find((s) => s.id === selectedStudent.id);
      const existingContacts = Array.isArray(existingStudent?.parent_contacts)
        ? existingStudent.parent_contacts
        : [];

      const updatedContacts = [
        ...existingContacts.filter((c) => c.name !== parentName),
        { name: parentName, relationship: 'Parent', phone: parentContact }
      ];

      await api.updateStudent(selectedStudent.id, {
        parentContacts: updatedContacts
      });
      toast.success('Parent/guardian information updated');
      setShowParentModal(false);
      await loadData();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleManagePassword = async (student: StudentRecord) => {
    setSelectedStudent(student);
    setNewPassword('');
    setConfirmPassword('');
    setShowPasswordModal(true);
  };

  const handleUpdatePassword = async () => {
    if (!selectedStudent) return;

    if (!newPassword || newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    // Find user by student record
    const targetUser = findUserForStudent(selectedStudent);
    if (!targetUser) {
      toast.error(
        'User account not found for this student. Please ensure the student has a registered account with matching email.'
      );
      return;
    }

    setUpdatingPassword(true);
    try {
      await userApi.updateUserPassword({ userId: targetUser.id, newPassword });
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

  const handleApproveStudent = async (user: TenantUser) => {
    try {
      setLoading(true);
      await userApi.approveUser(user.id);
      toast.success(`${user.email} approved. Profile record created.`);
      setPendingStudents((current) => current.filter((u) => u.id !== user.id));
      await loadData();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleRejectStudent = async (user: TenantUser) => {
    if (!window.confirm(`Reject access for ${user.email}?`)) {
      return;
    }

    try {
      setLoading(true);
      await userApi.rejectUser(user.id);
      toast.success(`${user.email} rejected.`);
      setPendingStudents((current) => current.filter((u) => u.id !== user.id));
      await loadData();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedRows.size === 0) {
      toast.error('Please select students to delete');
      return;
    }

    if (!window.confirm(`Delete ${selectedRows.size} student(s)?`)) {
      return;
    }

    try {
      const deletePromises = Array.from(selectedRows).map((id) => api.deleteStudent(id));
      await Promise.all(deletePromises);
      toast.success(`${selectedRows.size} student(s) deleted`);
      setSelectedRows(new Set());
      await loadData();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleExportCSV = () => {
    const exportData = filteredStudents.map((s) => ({
      'First Name': s.first_name,
      'Last Name': s.last_name,
      'Admission Number': s.admission_number || 'N/A',
      Class: s.class_id || 'N/A'
    }));
    exportToCSV(exportData, `students-${defaultDate()}`);
  };

  const handleExportPDF = () => {
    const exportData = filteredStudents.map((s) => ({
      'First Name': s.first_name,
      'Last Name': s.last_name,
      'Admission Number': s.admission_number || 'N/A',
      Class: s.class_id || 'N/A'
    }));
    exportToPDF(exportData, `students-${defaultDate()}`, 'Students Report');
  };

  const handleExportExcel = () => {
    const exportData = filteredStudents.map((s) => ({
      'First Name': s.first_name,
      'Last Name': s.last_name,
      'Admission Number': s.admission_number || 'N/A',
      Class: s.class_id || 'N/A'
    }));
    exportToExcel(exportData, `students-${defaultDate()}.xls`);
  };

  const toggleRowSelection = (studentId: string) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  };

  const toggleAllSelection = () => {
    if (selectedRows.size === filteredStudents.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(filteredStudents.map((s) => s.id)));
    }
  };

  const studentColumns: SortableTableColumn<StudentRecord>[] = [
    {
      key: 'checkbox',
      header: (
        <input
          type="checkbox"
          checked={selectedRows.size === filteredStudents.length && filteredStudents.length > 0}
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
      sortKey: 'first_name',
      render: (row) => (
        <div>
          <p className="font-semibold text-[var(--brand-surface-contrast)]">
            {row.first_name} {row.last_name}
          </p>
          {row.admission_number && (
            <p className="text-xs text-[var(--brand-muted)]">#{row.admission_number}</p>
          )}
        </div>
      )
    },
    {
      key: 'admission_number',
      header: 'Admission #',
      sortable: true,
      sortKey: 'admission_number',
      render: (row) => (
        <span className="text-sm text-[var(--brand-surface-contrast)]">
          {row.admission_number || 'N/A'}
        </span>
      )
    },
    {
      key: 'class',
      header: 'Class',
      sortable: true,
      sortKey: 'class_id',
      render: (row) => (
        <span className="text-sm text-[var(--brand-surface-contrast)]">
          {row.class_id || 'Not assigned'}
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
            Assign Class
          </Button>
          {row.class_id && (
            <Button size="sm" variant="outline" onClick={() => handleRemoveClass(row)}>
              Remove Class
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => handleManageSubjects(row)}>
            Subjects
          </Button>
          <Button size="sm" variant="ghost" onClick={() => handleManageParent(row)}>
            Parent
          </Button>
          <Button size="sm" variant="ghost" onClick={() => handleManagePassword(row)}>
            Password
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigate(`/dashboard/student/profile?studentId=${row.id}`)}
          >
            Profile
          </Button>
        </div>
      )
    }
  ];

  if (loading) {
    return (
      <RouteMeta title="Students management">
        <DashboardSkeleton />
      </RouteMeta>
    );
  }

  const selectedStudentDetail = selectedStudent ? studentDetails.get(selectedStudent.id) : null;

  return (
    <RouteMeta title="Students management">
      <div className="space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--brand-surface-contrast)]">
              Students management
            </h1>
            <p className="text-sm text-[var(--brand-muted)]">
              Manage students, assign classes, manage parent/guardian information, and view academic
              history.
            </p>
            {school && (
              <p className="text-xs text-[var(--brand-muted)] mt-1">
                School: <span className="font-medium">{school.name}</span>
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setShowCreateModal(true)}>Create Student</Button>
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

        {pendingStudents.length > 0 && (
          <section className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-4 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-[var(--brand-surface-contrast)]">
                Pending Student Approvals ({pendingStudents.length})
              </h2>
              <p className="text-sm text-[var(--brand-muted)]">
                Review and approve student registrations
              </p>
            </div>
            <div className="space-y-3">
              {pendingStudents.map((user) => (
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
                      onClick={() => handleApproveStudent(user)}
                      disabled={loading}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRejectStudent(user)}
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
              placeholder="Search by name, admission number, class..."
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
            <Input
              label="Admission Number"
              placeholder="Filter by admission number..."
              value={filters.admissionNumber}
              onChange={(e) => setFilters((f) => ({ ...f, admissionNumber: e.target.value }))}
            />
            <Select
              label="Has Parent Info"
              value={filters.hasParentInfo}
              onChange={(e) => setFilters((f) => ({ ...f, hasParentInfo: e.target.value }))}
              options={[
                { label: 'All', value: 'all' },
                { label: 'Yes', value: 'yes' },
                { label: 'No', value: 'no' }
              ]}
            />
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Input
              label="Enrollment Date From"
              type="date"
              value={filters.enrollmentDateFrom}
              onChange={(e) => setFilters((f) => ({ ...f, enrollmentDateFrom: e.target.value }))}
            />
            <Input
              label="Enrollment Date To"
              type="date"
              value={filters.enrollmentDateTo}
              onChange={(e) => setFilters((f) => ({ ...f, enrollmentDateTo: e.target.value }))}
            />
            <Input
              label="Date of Birth From"
              type="date"
              value={filters.dateOfBirthFrom}
              onChange={(e) => setFilters((f) => ({ ...f, dateOfBirthFrom: e.target.value }))}
            />
            <Input
              label="Date of Birth To"
              type="date"
              value={filters.dateOfBirthTo}
              onChange={(e) => setFilters((f) => ({ ...f, dateOfBirthTo: e.target.value }))}
            />
          </div>
          <div className="mt-4 flex items-center justify-between text-sm text-[var(--brand-muted)]">
            <span>
              Showing {filteredStudents.length} of {students.length} students
            </span>
            {(filters.search ||
              filters.classId !== 'all' ||
              filters.enrollmentStatus !== 'all' ||
              filters.admissionNumber ||
              filters.hasParentInfo !== 'all' ||
              filters.enrollmentDateFrom ||
              filters.enrollmentDateTo ||
              filters.dateOfBirthFrom ||
              filters.dateOfBirthTo) && (
              <Button size="sm" variant="ghost" onClick={() => setFilters(defaultFilters)}>
                Clear filters
              </Button>
            )}
          </div>
        </section>

        <PaginatedTable
          columns={studentColumns}
          data={filteredStudents}
          caption="Students"
          emptyMessage="No students found matching the current filters."
        />

        {showProfileModal && selectedStudent && (
          <Modal
            title={`Student profile: ${selectedStudent.first_name} ${selectedStudent.last_name}`}
            isOpen={showProfileModal}
            onClose={() => {
              setShowProfileModal(false);
              setSelectedStudent(null);
            }}
          >
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs font-medium text-[var(--brand-muted)] mb-1">Name</p>
                  <p className="text-sm text-[var(--brand-surface-contrast)]">
                    {selectedStudent.first_name} {selectedStudent.last_name}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--brand-muted)] mb-1">
                    Admission Number
                  </p>
                  <p className="text-sm text-[var(--brand-surface-contrast)]">
                    {selectedStudent.admission_number || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--brand-muted)] mb-1">Class</p>
                  <p className="text-sm text-[var(--brand-surface-contrast)]">
                    {selectedStudentDetail?.className || selectedStudent.class_id || 'Not assigned'}
                  </p>
                </div>
                    {selectedStudentDetail && (
                      <>
                        <div>
                          <p className="text-xs font-medium text-[var(--brand-muted)] mb-1">Subjects</p>
                          <div className="flex flex-wrap gap-1">
                            {selectedStudentDetail.subjects.length > 0 ? (
                              selectedStudentDetail.subjects.map((subject) => (
                                <span
                                  key={subject.subjectId}
                                  className="rounded-full bg-[var(--brand-primary)]/20 px-2 py-1 text-xs text-[var(--brand-primary)]"
                                >
                                  {subject.name}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-[var(--brand-muted)]">No subjects</span>
                            )}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-[var(--brand-muted)] mb-1">
                            Parent/Guardian
                          </p>
                          <div className="text-sm text-[var(--brand-surface-contrast)]">
                            {Array.isArray(selectedStudentDetail.parentContacts) &&
                            selectedStudentDetail.parentContacts.length > 0 ? (
                              selectedStudentDetail.parentContacts.map(
                                (parent: unknown, idx: number) => {
                                  const p = parent as { name?: string; contact?: string };
                                  return (
                                    <div key={idx}>
                                      {p.name} - {p.contact}
                                    </div>
                                  );
                                }
                              )
                            ) : (
                              <span className="text-[var(--brand-muted)]">No parent information</span>
                            )}
                          </div>
                        </div>
                        <div className="md:col-span-2">
                          <p className="text-xs font-medium text-[var(--brand-muted)] mb-1">
                            Academic History
                          </p>
                          <div className="text-sm text-[var(--brand-surface-contrast)]">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                navigate(`/dashboard/student/profile?studentId=${selectedStudent.id}`)
                              }
                            >
                              View Full Academic History
                            </Button>
                          </div>
                        </div>
                      </>
                    )}
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="ghost" onClick={() => setShowProfileModal(false)}>
                  Close
                </Button>
                <Button
                  onClick={() =>
                    navigate(`/dashboard/student/profile?studentId=${selectedStudent.id}`)
                  }
                >
                  View full profile
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {showClassModal && selectedStudent && (
          <Modal
            title={`Assign class: ${selectedStudent.first_name} ${selectedStudent.last_name}`}
            isOpen={showClassModal}
            onClose={() => {
              setShowClassModal(false);
              setSelectedStudent(null);
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
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="ghost" onClick={() => setShowClassModal(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveClassAssignment}>Assign</Button>
              </div>
            </div>
          </Modal>
        )}

        {showParentModal && selectedStudent && (
          <Modal
            title={`Parent/Guardian: ${selectedStudent.first_name} ${selectedStudent.last_name}`}
            isOpen={showParentModal}
            onClose={() => {
              setShowParentModal(false);
              setSelectedStudent(null);
            }}
          >
            <div className="space-y-4">
              <Input
                label="Parent/Guardian name"
                value={parentName}
                onChange={(e) => setParentName(e.target.value)}
              />
              <Input
                label="Contact information"
                value={parentContact}
                onChange={(e) => setParentContact(e.target.value)}
                placeholder="Phone or email"
              />
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="ghost" onClick={() => setShowParentModal(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveParent}>Save</Button>
              </div>
            </div>
          </Modal>
        )}

        {showPasswordModal && selectedStudent && (
          <Modal
            title={`Change Password: ${selectedStudent.first_name} ${selectedStudent.last_name}`}
            isOpen={showPasswordModal}
            onClose={() => {
              setShowPasswordModal(false);
              setSelectedStudent(null);
              setNewPassword('');
              setConfirmPassword('');
            }}
          >
            <div className="space-y-4">
              <div>
                <p className="text-sm text-[var(--brand-muted)] mb-2">
                  Update password for this student account
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
            defaultRole="student"
            onClose={() => setShowCreateModal(false)}
            onSuccess={async () => {
              setShowCreateModal(false);
              await loadData();
              toast.success('Student created successfully');
            }}
          />
        )}

        {showSubjectsModal && selectedStudent && (
          <Modal
            title={`Manage Subjects: ${selectedStudent.first_name} ${selectedStudent.last_name}`}
            isOpen={showSubjectsModal}
            onClose={() => {
              setShowSubjectsModal(false);
              setSelectedStudent(null);
              setSelectedSubjectIds([]);
            }}
          >
            <div className="space-y-4">
              <p className="text-sm text-[var(--brand-muted)]">
                Select subjects for this student. Changes will replace existing subject assignments.
              </p>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {subjects.length > 0 ? (
                  subjects.map((subject) => (
                    <div
                      key={subject.id}
                      className="flex items-center gap-2 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)]/50 p-3"
                    >
                      <input
                        type="checkbox"
                        checked={selectedSubjectIds.includes(subject.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedSubjectIds([...selectedSubjectIds, subject.id]);
                          } else {
                            setSelectedSubjectIds(selectedSubjectIds.filter((id) => id !== subject.id));
                          }
                        }}
                        className="rounded border-[var(--brand-border)]"
                      />
                      <div className="flex-1">
                        <p className="font-semibold text-[var(--brand-surface-contrast)]">
                          {subject.name}
                        </p>
                        {subject.code && (
                          <p className="text-xs text-[var(--brand-muted)]">{subject.code}</p>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[var(--brand-muted)]">No subjects available</p>
                )}
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowSubjectsModal(false);
                    setSelectedSubjectIds([]);
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleSaveSubjects}>Save Subjects</Button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </RouteMeta>
  );
}

export default StudentsManagementPage;
