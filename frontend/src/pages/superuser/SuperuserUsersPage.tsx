import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { RouteMeta } from '../../components/layout/RouteMeta';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { Table, type TableColumn } from '../../components/ui/Table';
import { StatusBanner } from '../../components/ui/StatusBanner';
import { DashboardSkeleton } from '../../components/ui/DashboardSkeleton';
import { api, type PlatformUserSummary, type Role, type UserStatus } from '../../lib/api';
import { formatDate, formatDateTime } from '../../lib/utils/date';

type FilterRole = Role | 'all';
type FilterStatus = UserStatus | 'all' | 'pending';

interface UserFilters {
  tenant: string;
  role: FilterRole;
  status: FilterStatus;
  search: string;
}

const defaultFilters: UserFilters = {
  tenant: 'all',
  role: 'all',
  status: 'all',
  search: ''
};

export function SuperuserUsersPage() {
  const [users, setUsers] = useState<PlatformUserSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<UserFilters>(defaultFilters);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [selectedUser, setSelectedUser] = useState<PlatformUserSummary | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.superuser.listUsers();
      setUsers(result);
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      // Tenant filter
      if (filters.tenant !== 'all' && user.tenantId !== filters.tenant) {
        return false;
      }

      // Role filter
      if (filters.role !== 'all' && user.role !== filters.role) {
        return false;
      }

      // Status filter
      if (filters.status !== 'all') {
        if (filters.status === 'pending' && user.isVerified) {
          return false;
        }
        if (filters.status !== 'pending' && user.status !== filters.status) {
          return false;
        }
      }

      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesSearch =
          user.email.toLowerCase().includes(searchLower) ||
          user.fullName?.toLowerCase().includes(searchLower) ||
          user.username?.toLowerCase().includes(searchLower) ||
          user.tenantName?.toLowerCase().includes(searchLower) ||
          user.schoolName?.toLowerCase().includes(searchLower);
        if (!matchesSearch) {
          return false;
        }
      }

      return true;
    });
  }, [users, filters]);

  const uniqueTenants = useMemo(() => {
    const tenantMap = new Map<string, string>();
    users.forEach((user) => {
      if (user.tenantId && user.tenantName) {
        tenantMap.set(user.tenantId, user.tenantName);
      }
    });
    return Array.from(tenantMap.entries()).map(([id, name]) => ({ id, name }));
  }, [users]);

  const roleOptions: Array<{ label: string; value: FilterRole }> = [
    { label: 'All roles', value: 'all' },
    { label: 'SuperAdmin', value: 'superadmin' },
    { label: 'Admin', value: 'admin' }
  ];

  const statusOptions: Array<{ label: string; value: FilterStatus }> = [
    { label: 'All statuses', value: 'all' },
    { label: 'Active', value: 'active' },
    { label: 'Pending', value: 'pending' },
    { label: 'Suspended', value: 'suspended' },
    { label: 'Rejected', value: 'rejected' }
  ];

  const tenantOptions = useMemo(
    () => [
      { label: 'All tenants', value: 'all' },
      ...uniqueTenants.map((t) => ({ label: t.name, value: t.id }))
    ],
    [uniqueTenants]
  );

  const handleEditUser = (user: PlatformUserSummary) => {
    setSelectedUser(user);
    setShowEditModal(true);
  };

  const handleStatusUpdate = async (userId: string, newStatus: UserStatus) => {
    try {
      await api.superuser.updateUserStatus(userId, newStatus);
      toast.success(`User status updated to ${newStatus}`);
      await loadUsers();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const userColumns: TableColumn<PlatformUserSummary>[] = [
    {
      header: 'User',
      render: (row) => (
        <div>
          <p className="font-semibold text-[var(--brand-surface-contrast)]">
            {row.fullName || row.email}
          </p>
          <p className="text-xs text-[var(--brand-muted)]">{row.email}</p>
          {row.username && <p className="text-xs text-[var(--brand-muted)]">@{row.username}</p>}
        </div>
      )
    },
    {
      header: 'Role',
      render: (row) => (
        <span className="rounded-full bg-[var(--brand-primary)]/20 px-2 py-1 text-xs font-semibold text-[var(--brand-primary)] capitalize">
          {row.role}
        </span>
      )
    },
    {
      header: 'Tenant',
      render: (row) => (
        <div>
          <p className="text-sm text-[var(--brand-surface-contrast)]">
            {row.tenantName || row.schoolName || 'No tenant'}
          </p>
          {row.registrationCode && (
            <p className="text-xs text-[var(--brand-muted)]">{row.registrationCode}</p>
          )}
        </div>
      )
    },
    {
      header: 'Status',
      render: (row) => {
        const status = row.isVerified ? row.status || 'active' : 'pending';
        const statusColors = {
          active: 'bg-emerald-500/20 text-emerald-200',
          pending: 'bg-amber-500/20 text-amber-200',
          suspended: 'bg-rose-500/20 text-rose-200',
          rejected: 'bg-slate-500/20 text-slate-200'
        };
        return (
          <span
            className={`rounded-full px-2 py-1 text-xs font-semibold ${
              statusColors[status as keyof typeof statusColors] || statusColors.active
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
            {!row.isVerified && ' (Unverified)'}
          </span>
        );
      }
    },
    {
      header: 'Created',
      render: (row) => formatDate(row.createdAt)
    },
    {
      header: 'Actions',
      render: (row) => (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => handleEditUser(row)}>
            View
          </Button>
          {row.status === 'active' ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleStatusUpdate(row.id, 'suspended')}
            >
              Suspend
            </Button>
          ) : row.status === 'suspended' ? (
            <Button size="sm" variant="ghost" onClick={() => handleStatusUpdate(row.id, 'active')}>
              Activate
            </Button>
          ) : null}
        </div>
      )
    }
  ];

  if (loading) {
    return (
      <RouteMeta title="User management">
        <DashboardSkeleton />
      </RouteMeta>
    );
  }

  return (
    <RouteMeta title="User management">
      <div className="space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--brand-surface-contrast)]">
              Platform user management
            </h1>
            <p className="text-sm text-[var(--brand-muted)]">
              Audit all platform users, enforce password resets, and monitor pending approvals
              across tenant environments.
            </p>
          </div>
        </header>

        {error ? <StatusBanner status="error" message={error} /> : null}

        <section
          className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-4 shadow-sm"
          aria-label="Filters"
        >
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Input
              label="Search"
              placeholder="Search by email, name, tenant..."
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            />
            <Select
              label="Tenant"
              value={filters.tenant}
              onChange={(e) => setFilters((f) => ({ ...f, tenant: e.target.value }))}
              options={tenantOptions}
            />
            <Select
              label="Role"
              value={filters.role}
              onChange={(e) => setFilters((f) => ({ ...f, role: e.target.value as FilterRole }))}
              options={roleOptions}
            />
            <Select
              label="Status"
              value={filters.status}
              onChange={(e) =>
                setFilters((f) => ({ ...f, status: e.target.value as FilterStatus }))
              }
              options={statusOptions}
            />
          </div>
          <div className="mt-4 flex items-center justify-between text-sm text-[var(--brand-muted)]">
            <span>
              Showing {filteredUsers.length} of {users.length} users
            </span>
            {(filters.tenant !== 'all' ||
              filters.role !== 'all' ||
              filters.status !== 'all' ||
              filters.search) && (
              <Button size="sm" variant="ghost" onClick={() => setFilters(defaultFilters)}>
                Clear filters
              </Button>
            )}
          </div>
        </section>

        <Table
          columns={userColumns}
          data={filteredUsers}
          caption="Platform users"
          emptyMessage="No users found matching the current filters."
        />

        {showEditModal && selectedUser && (
          <Modal
            title="User details"
            isOpen={showEditModal}
            onClose={() => {
              setShowEditModal(false);
              setSelectedUser(null);
            }}
          >
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs font-medium text-[var(--brand-muted)] mb-1">Email</p>
                  <p className="text-sm text-[var(--brand-surface-contrast)]">
                    {selectedUser.email}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--brand-muted)] mb-1">Username</p>
                  <p className="text-sm text-[var(--brand-surface-contrast)]">
                    {selectedUser.username || 'Not set'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--brand-muted)] mb-1">Full name</p>
                  <p className="text-sm text-[var(--brand-surface-contrast)]">
                    {selectedUser.fullName || 'Not set'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--brand-muted)] mb-1">Role</p>
                  <p className="text-sm text-[var(--brand-surface-contrast)] capitalize">
                    {selectedUser.role}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--brand-muted)] mb-1">Tenant</p>
                  <p className="text-sm text-[var(--brand-surface-contrast)]">
                    {selectedUser.tenantName || selectedUser.schoolName || 'No tenant'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--brand-muted)] mb-1">Status</p>
                  <p className="text-sm text-[var(--brand-surface-contrast)] capitalize">
                    {selectedUser.isVerified ? selectedUser.status || 'active' : 'pending'}
                    {!selectedUser.isVerified && ' (Unverified)'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--brand-muted)] mb-1">Created</p>
                  <p className="text-sm text-[var(--brand-surface-contrast)]">
                    {formatDateTime(selectedUser.createdAt)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--brand-muted)] mb-1">User ID</p>
                  <p className="text-xs font-mono text-[var(--brand-muted)] break-all">
                    {selectedUser.id}
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="ghost" onClick={() => setShowEditModal(false)}>
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

export default SuperuserUsersPage;
