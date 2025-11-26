/**
 * Admin Users Management Page
 * Unified user management for HOD, Teacher, and Student creation
 */

import { useState } from 'react';
import RouteMeta from '../../../components/layout/RouteMeta';
import { DashboardSkeleton } from '../../../components/ui/DashboardSkeleton';
import { StatusBanner } from '../../../components/ui/StatusBanner';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Modal } from '../../../components/ui/Modal';
import { Table, type TableColumn } from '../../../components/ui/Table';
import { Plus, UserCheck, UserX } from 'lucide-react';
import { ActionButtonGroup } from '../../../components/table-actions';
import {
  useAdminUsers,
  useCreateHOD,
  useCreateTeacher,
  useCreateStudent,
  useDisableUser,
  useEnableUser,
  type AdminUser,
} from '../../../hooks/queries/admin/useAdminUsers';
import { useDepartments } from '../../../hooks/queries/admin/useDepartments';
import { useClasses } from '../../../hooks/queries/useClasses';
import { usePermission } from '../../../hooks/usePermission';

export default function AdminUsersPage() {
  const [isCreateHODModalOpen, setIsCreateHODModalOpen] = useState(false);
  const [isCreateTeacherModalOpen, setIsCreateTeacherModalOpen] = useState(false);
  const [isCreateStudentModalOpen, setIsCreateStudentModalOpen] = useState(false);
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [hodFormData, setHODFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    phone: '',
    departmentId: '',
  });
  const [teacherFormData, setTeacherFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    phone: '',
    qualifications: '',
    yearsOfExperience: '',
  });
  const [studentFormData, setStudentFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    gender: '',
    dateOfBirth: '',
    parentGuardianName: '',
    parentGuardianContact: '',
    studentId: '',
    classId: '',
  });

  const filters = {
    role: roleFilter !== 'all' ? roleFilter : undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
  };

  const { data: usersData, isLoading, error } = useAdminUsers(filters);
  const { data: departmentsData } = useDepartments(false);
  const { data: classesData } = useClasses();
  const createHODMutation = useCreateHOD();
  const createTeacherMutation = useCreateTeacher();
  const createStudentMutation = useCreateStudent();
  const disableUserMutation = useDisableUser();
  const enableUserMutation = useEnableUser();

  // RBAC: Check permissions for UI controls
  const canManageUsers = usePermission('users:manage');
  const canManageTeachers = usePermission('teachers:manage');
  const canManageStudents = usePermission('students:manage');

  const handleCreateHOD = () => {
    createHODMutation.mutate(
      {
        ...hodFormData,
        departmentId: hodFormData.departmentId || undefined,
        phone: hodFormData.phone || undefined,
      },
      {
        onSuccess: () => {
          setIsCreateHODModalOpen(false);
          setHODFormData({ email: '', password: '', fullName: '', phone: '', departmentId: '' });
        },
      }
    );
  };

  const handleCreateTeacher = () => {
    createTeacherMutation.mutate(
      {
        ...teacherFormData,
        phone: teacherFormData.phone || undefined,
        qualifications: teacherFormData.qualifications || undefined,
        yearsOfExperience: teacherFormData.yearsOfExperience
          ? Number(teacherFormData.yearsOfExperience)
          : undefined,
      },
      {
        onSuccess: () => {
          setIsCreateTeacherModalOpen(false);
          setTeacherFormData({
            email: '',
            password: '',
            fullName: '',
            phone: '',
            qualifications: '',
            yearsOfExperience: '',
          });
        },
      }
    );
  };

  const handleCreateStudent = () => {
    createStudentMutation.mutate(
      {
        ...studentFormData,
        gender: (studentFormData.gender as 'male' | 'female' | 'other') || undefined,
        classId: studentFormData.classId || undefined,
      },
      {
        onSuccess: () => {
          setIsCreateStudentModalOpen(false);
          setStudentFormData({
            email: '',
            password: '',
            fullName: '',
            gender: '',
            dateOfBirth: '',
            parentGuardianName: '',
            parentGuardianContact: '',
            studentId: '',
            classId: '',
          });
        },
      }
    );
  };

  const handleDisable = (id: string) => {
    if (confirm('Are you sure you want to disable this user?')) {
      disableUserMutation.mutate(id);
    }
  };

  const handleEnable = (id: string) => {
    enableUserMutation.mutate(id);
  };

  const columns: TableColumn<AdminUser>[] = [
    { key: 'email', header: 'Email' },
    { key: 'role', header: 'Role' },
    {
      key: 'status',
      header: 'Status',
      render: (user) => (
        <span
          className={
            user.status === 'active'
              ? 'text-emerald-500'
              : user.status === 'disabled'
                ? 'text-red-500'
                : 'text-yellow-500'
          }
        >
          {user.status}
        </span>
      ),
    },
    {
      key: 'isVerified',
      header: 'Verified',
      render: (user) => (user.isVerified ? 'Yes' : 'No'),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (user) => (
        <ActionButtonGroup>
          {canManageUsers &&
            (user.status === 'active' ? (
              <Button
                size="sm"
                variant="outline"
                leftIcon={<UserX className="h-4 w-4" />}
                onClick={() => handleDisable(user.id)}
              >
                Disable
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                leftIcon={<UserCheck className="h-4 w-4" />}
                onClick={() => handleEnable(user.id)}
              >
                Enable
              </Button>
            ))}
        </ActionButtonGroup>
      ),
    },
  ];

  if (isLoading) {
    return (
      <RouteMeta title="Users Management">
        <DashboardSkeleton />
      </RouteMeta>
    );
  }

  if (error) {
    return (
      <RouteMeta title="Users Management">
        <StatusBanner status="error" message={(error as Error).message} />
      </RouteMeta>
    );
  }

  const users = (Array.isArray(usersData) ? usersData : usersData || []) as AdminUser[];
  const departments = (Array.isArray(departmentsData) ? departmentsData : departmentsData || []) as Array<{ id: string; name: string }>;
  const classes = classesData || [];

  return (
    <RouteMeta title="Users Management">
      <div className="space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--brand-surface-contrast)]">
              Users Management
            </h1>
            <p className="text-sm text-[var(--brand-muted)]">
              Create and manage HODs, Teachers, and Students
            </p>
          </div>
          <div className="flex gap-2">
            {canManageUsers && canManageTeachers && (
              <Button
                variant="outline"
                leftIcon={<Plus className="h-4 w-4" />}
                onClick={() => setIsCreateHODModalOpen(true)}
              >
                Create HOD
              </Button>
            )}
            {canManageUsers && canManageTeachers && (
              <Button
                variant="outline"
                leftIcon={<Plus className="h-4 w-4" />}
                onClick={() => setIsCreateTeacherModalOpen(true)}
              >
                Create Teacher
              </Button>
            )}
            {canManageUsers && canManageStudents && (
              <Button
                leftIcon={<Plus className="h-4 w-4" />}
                onClick={() => setIsCreateStudentModalOpen(true)}
              >
                Create Student
              </Button>
            )}
          </div>
        </header>

        {/* Filters */}
        <div className="flex gap-4">
          <Select
            label="Role"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            options={[
              { value: 'all', label: 'All Roles' },
              { value: 'hod', label: 'HOD' },
              { value: 'teacher', label: 'Teacher' },
              { value: 'student', label: 'Student' },
            ]}
          />
          <Select
            label="Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: 'all', label: 'All Status' },
              { value: 'active', label: 'Active' },
              { value: 'disabled', label: 'Disabled' },
              { value: 'pending', label: 'Pending' },
            ]}
          />
        </div>

        <Table columns={columns} data={users} emptyMessage="No users found" />

        {/* Create HOD Modal */}
        <Modal
          isOpen={isCreateHODModalOpen}
          onClose={() => setIsCreateHODModalOpen(false)}
          title="Create HOD"
        >
          <div className="space-y-4">
            <Input
              label="Email"
              type="email"
              value={hodFormData.email}
              onChange={(e) => setHODFormData({ ...hodFormData, email: e.target.value })}
              required
            />
            <Input
              label="Password"
              type="password"
              value={hodFormData.password}
              onChange={(e) => setHODFormData({ ...hodFormData, password: e.target.value })}
              required
            />
            <Input
              label="Full Name"
              value={hodFormData.fullName}
              onChange={(e) => setHODFormData({ ...hodFormData, fullName: e.target.value })}
              required
            />
            <Input
              label="Phone"
              value={hodFormData.phone}
              onChange={(e) => setHODFormData({ ...hodFormData, phone: e.target.value })}
            />
            <Select
              label="Department"
              value={hodFormData.departmentId}
              onChange={(e) => setHODFormData({ ...hodFormData, departmentId: e.target.value })}
              options={[
                { value: '', label: 'Select department' },
                ...departments.map((d) => ({ value: d.id, label: d.name })),
              ]}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setIsCreateHODModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateHOD} loading={createHODMutation.isPending}>
                Create HOD
              </Button>
            </div>
          </div>
        </Modal>

        {/* Create Teacher Modal */}
        <Modal
          isOpen={isCreateTeacherModalOpen}
          onClose={() => setIsCreateTeacherModalOpen(false)}
          title="Create Teacher"
        >
          <div className="space-y-4">
            <Input
              label="Email"
              type="email"
              value={teacherFormData.email}
              onChange={(e) => setTeacherFormData({ ...teacherFormData, email: e.target.value })}
              required
            />
            <Input
              label="Password"
              type="password"
              value={teacherFormData.password}
              onChange={(e) => setTeacherFormData({ ...teacherFormData, password: e.target.value })}
              required
            />
            <Input
              label="Full Name"
              value={teacherFormData.fullName}
              onChange={(e) => setTeacherFormData({ ...teacherFormData, fullName: e.target.value })}
              required
            />
            <Input
              label="Phone"
              value={teacherFormData.phone}
              onChange={(e) => setTeacherFormData({ ...teacherFormData, phone: e.target.value })}
            />
            <Input
              label="Qualifications"
              value={teacherFormData.qualifications}
              onChange={(e) =>
                setTeacherFormData({ ...teacherFormData, qualifications: e.target.value })
              }
            />
            <Input
              label="Years of Experience"
              type="number"
              value={teacherFormData.yearsOfExperience}
              onChange={(e) =>
                setTeacherFormData({ ...teacherFormData, yearsOfExperience: e.target.value })
              }
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setIsCreateTeacherModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateTeacher} loading={createTeacherMutation.isPending}>
                Create Teacher
              </Button>
            </div>
          </div>
        </Modal>

        {/* Create Student Modal */}
        <Modal
          isOpen={isCreateStudentModalOpen}
          onClose={() => setIsCreateStudentModalOpen(false)}
          title="Create Student"
        >
          <div className="space-y-4">
            <Input
              label="Email"
              type="email"
              value={studentFormData.email}
              onChange={(e) => setStudentFormData({ ...studentFormData, email: e.target.value })}
              required
            />
            <Input
              label="Password"
              type="password"
              value={studentFormData.password}
              onChange={(e) => setStudentFormData({ ...studentFormData, password: e.target.value })}
              required
            />
            <Input
              label="Full Name"
              value={studentFormData.fullName}
              onChange={(e) => setStudentFormData({ ...studentFormData, fullName: e.target.value })}
              required
            />
            <Select
              label="Gender"
              value={studentFormData.gender}
              onChange={(e) => setStudentFormData({ ...studentFormData, gender: e.target.value })}
              options={[
                { value: '', label: 'Select gender' },
                { value: 'male', label: 'Male' },
                { value: 'female', label: 'Female' },
                { value: 'other', label: 'Other' },
              ]}
            />
            <Input
              label="Date of Birth"
              type="date"
              value={studentFormData.dateOfBirth}
              onChange={(e) =>
                setStudentFormData({ ...studentFormData, dateOfBirth: e.target.value })
              }
            />
            <Input
              label="Student ID"
              value={studentFormData.studentId}
              onChange={(e) =>
                setStudentFormData({ ...studentFormData, studentId: e.target.value })
              }
            />
            <Select
              label="Class"
              value={studentFormData.classId}
              onChange={(e) => setStudentFormData({ ...studentFormData, classId: e.target.value })}
              options={[
                { value: '', label: 'Select class' },
                ...classes.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
            <Input
              label="Parent/Guardian Name"
              value={studentFormData.parentGuardianName}
              onChange={(e) =>
                setStudentFormData({ ...studentFormData, parentGuardianName: e.target.value })
              }
            />
            <Input
              label="Parent/Guardian Contact"
              value={studentFormData.parentGuardianContact}
              onChange={(e) =>
                setStudentFormData({ ...studentFormData, parentGuardianContact: e.target.value })
              }
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setIsCreateStudentModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateStudent} loading={createStudentMutation.isPending}>
                Create Student
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </RouteMeta>
  );
}
