/**
 * Admin Users Management Page
 * Unified user management for HOD, Teacher, and Student creation
 */

import { useState } from 'react';
import RouteMeta from '../../../components/layout/RouteMeta';
import { DashboardSkeleton } from '../../../components/ui/DashboardSkeleton';
import { StatusBanner } from '../../../components/ui/StatusBanner';
import { Button } from '../../../components/ui/Button';
import { Select } from '../../../components/ui/Select';
import { Table, type TableColumn } from '../../../components/ui/Table';
import { Plus, UserCheck, UserX } from 'lucide-react';
import { ActionButtonGroup } from '../../../components/table-actions';
import {
  useAdminUsers,
  useDisableUser,
  useEnableUser,
  type AdminUser,
} from '../../../hooks/queries/admin/useAdminUsers';
import { usePermission } from '../../../hooks/usePermission';
import { AdminUserRegistrationModal } from '../../../components/admin/AdminUserRegistrationModal';

export default function AdminUsersPage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [defaultRole, setDefaultRole] = useState<'student' | 'teacher' | 'hod'>('student');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filters = {
    role: roleFilter !== 'all' ? roleFilter : undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
  };

  const { data: usersData, isLoading, error } = useAdminUsers(filters);
  const disableUserMutation = useDisableUser();
  const enableUserMutation = useEnableUser();

  // RBAC: Check permissions for UI controls
  const canManageUsers = usePermission('users:manage');

  const handleOpenCreateModal = (role: 'student' | 'teacher' | 'hod') => {
    setDefaultRole(role);
    setIsCreateModalOpen(true);
  };

  const handleCreateSuccess = () => {
    setIsCreateModalOpen(false);
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
            {canManageUsers && (
              <Button
                leftIcon={<Plus className="h-4 w-4" />}
                onClick={() => handleOpenCreateModal('student')}
              >
                Create User
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

        {/* Unified User Registration Modal */}
        {isCreateModalOpen && (
          <AdminUserRegistrationModal
            defaultRole={defaultRole}
            onClose={() => setIsCreateModalOpen(false)}
            onSuccess={handleCreateSuccess}
          />
        )}
      </div>
    </RouteMeta>
  );
}
