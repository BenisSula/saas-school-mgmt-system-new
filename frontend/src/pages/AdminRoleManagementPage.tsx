import React, { useEffect, useMemo, useState } from 'react';
import { api, type TenantUser } from '../lib/api';
import { Table } from '../components/ui/Table';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { StatusBanner } from '../components/ui/StatusBanner';
import { useAsyncFeedback } from '../hooks/useAsyncFeedback';

const ROLES: TenantUser['role'][] = ['student', 'teacher', 'admin', 'superadmin'];

function AdminRoleManagementPage() {
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const { status, message, setInfo, setSuccess, setError, clear } = useAsyncFeedback();

  async function loadUsers() {
    try {
      setLoading(true);
      clear();
      const data = await api.listUsers();
      setUsers(data);
      if (data.length === 0) {
        setInfo('No users found for this tenant.');
      }
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  const columns = useMemo(
    () => [
      { header: 'Email', key: 'email' as const },
      { header: 'Role', key: 'role' as const },
      { header: 'Verified', key: 'is_verified' as const },
      { header: 'Created', key: 'created_at' as const },
      { header: 'Actions', key: 'actions' as const }
    ],
    []
  );

  const roleOptions = ROLES.map((role) => ({ label: role, value: role }));

  const rows = users.map((user) => ({
    ...user,
    is_verified: user.is_verified ? 'Yes' : 'No',
    actions: (
      <Select
        aria-label={`Update role for ${user.email}`}
        value={user.role}
        options={roleOptions}
        className="min-w-[160px]"
        onChange={async (event) => {
          const nextRole = event.target.value as TenantUser['role'];
          try {
            setLoading(true);
            clear();
            const updated = await api.updateUserRole(user.id, nextRole);
            setUsers((current) =>
              current.map((entry) => (entry.id === user.id ? { ...entry, role: updated.role } : entry))
            );
            setSuccess(`Role updated for ${user.email}`);
          } catch (error) {
            setError((error as Error).message);
          } finally {
            setLoading(false);
          }
        }}
      />
    )
  }));

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Role management</h1>
          <p className="text-sm text-slate-300">
            View tenant users and adjust their role assignment. Only admins and superadmins can modify roles.
          </p>
        </div>
        <Button onClick={loadUsers} loading={loading}>
          Refresh
        </Button>
      </header>

      {message ? <StatusBanner status={status} message={message} onDismiss={clear} /> : null}

      <Table columns={columns} data={rows} caption="Tenant user roles" />
    </div>
  );
}

export default AdminRoleManagementPage;

