import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { api, type TenantUser } from '../../lib/api';

// Helper to safely convert unknown to string for display
const safeString = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  return String(value);
};
import { Table } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { StatusBanner } from '../../components/ui/StatusBanner';
import { useAsyncFeedback } from '../../hooks/useAsyncFeedback';
import { AdminUserRegistrationModal } from '../../components/admin/AdminUserRegistrationModal';
import RouteMeta from '../../components/layout/RouteMeta';
import { RefreshCw } from 'lucide-react';

const ROLES: TenantUser['role'][] = ['student', 'teacher', 'admin', 'superadmin'];

function AdminRoleManagementPage() {
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [pendingUsers, setPendingUsers] = useState<TenantUser[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const { status, message, setInfo, setSuccess, setError, clear } = useAsyncFeedback();

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      clear();
      const [allResult, pendingResult] = await Promise.allSettled([
        api.listUsers(),
        api.listPendingUsers()
      ]);

      if (allResult.status === 'fulfilled') {
        const data = allResult.value;
        setUsers(data);
        if (data.length === 0) {
          setInfo('No users found for this tenant.');
        } else {
          toast.success('Loaded latest users.');
        }
      } else {
        const errorMessage = (allResult.reason as Error).message ?? 'Unable to load users.';
        setError(errorMessage);
        toast.error(errorMessage);
      }

      if (pendingResult.status === 'fulfilled') {
        // Only show users with status='pending' in pending approvals
        setPendingUsers(pendingResult.value.filter((user) => user.status === 'pending'));
      } else if (allResult.status === 'fulfilled') {
        // Fallback: filter from all users
        setPendingUsers(allResult.value.filter((user) => user.status === 'pending'));
      } else {
        setPendingUsers([]);
      }
    } catch (error) {
      const errorMessage = (error as Error).message;
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [clear, setError, setInfo]);

  const handleApprove = useCallback(
    async (user: TenantUser) => {
      try {
        setLoading(true);
        clear();
        const updated = await api.approveUser(user.id);
        setSuccess(
          `${user.email} approved. Profile record created. You can now edit and assign classes.`
        );
        toast.success(`${user.email} approved. Profile record created.`, {
          description: 'You can now edit the profile to assign classes or make corrections.'
        });
        setPendingUsers((current) => current.filter((candidate) => candidate.id !== user.id));
        setUsers((current) => {
          const normalised = {
            ...updated,
            status: updated.status ?? 'active'
          };
          const exists = current.some((candidate) => candidate.id === user.id);
          if (exists) {
            return current.map((candidate) => (candidate.id === user.id ? normalised : candidate));
          }
          return [...current, normalised];
        });
      } catch (error) {
        const errorMessage = (error as Error).message;
        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setLoading(false);
      }
    },
    [clear, setError, setSuccess]
  );

  const handleReject = useCallback(
    async (user: TenantUser) => {
      if (typeof window !== 'undefined') {
        const confirmed = window.confirm(
          `Reject access for ${user.email}? They will remain unable to sign in.`
        );
        if (!confirmed) {
          return;
        }
      }

      try {
        setLoading(true);
        clear();
        const updated = await api.rejectUser(user.id);
        setPendingUsers((current) => current.filter((candidate) => candidate.id !== user.id));
        setUsers((current) =>
          current.map((candidate) =>
            candidate.id === user.id
              ? {
                  ...candidate,
                  status: updated.status ?? 'rejected'
                }
              : candidate
          )
        );
        setSuccess(`${user.email} rejected.`);
        toast.success(`${user.email} rejected.`);
      } catch (error) {
        const errorMessage = (error as Error).message;
        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setLoading(false);
      }
    },
    [clear, setError, setSuccess]
  );

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const columns = useMemo(
    () => [
      { header: 'Email', key: 'email' as const },
      { header: 'Role', key: 'role' as const },
      { header: 'Status', key: 'status' as const },
      { header: 'Verified', key: 'is_verified' as const },
      { header: 'Created', key: 'created_at' as const },
      { header: 'Actions', key: 'actions' as const }
    ],
    []
  );

  const roleOptions = ROLES.map((role) => ({ label: role, value: role }));

  const rows = users.map((user) => ({
    ...user,
    status: user.status ?? 'active',
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
              current.map((entry) =>
                entry.id === user.id
                  ? { ...entry, role: updated.role, status: updated.status ?? entry.status }
                  : entry
              )
            );
            setSuccess(`Role updated for ${user.email}`);
            toast.success(`Role updated for ${user.email}`);
          } catch (error) {
            const errorMessage = (error as Error).message;
            setError(errorMessage);
            toast.error(errorMessage);
          } finally {
            setLoading(false);
          }
        }}
      />
    )
  }));

  return (
    <RouteMeta title="Role management">
      <div className="space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--brand-surface-contrast)]">
              Role management
            </h1>
            <p className="text-sm text-[var(--brand-muted)]">
              View tenant users, register new users, and adjust their role assignment
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowRegisterModal(true)}>
              Register New User
            </Button>
            <Button onClick={loadUsers} loading={loading} leftIcon={<RefreshCw className="h-4 w-4" />}>
              Refresh
            </Button>
          </div>
        </header>

      <section className="space-y-4 rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
        <header className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-[var(--brand-surface-contrast)]">
              Pending user approvals
            </h2>
            <div className="space-y-2">
              <p className="text-sm text-[var(--brand-muted)]">
                Review and approve user registrations. Users have filled in their profile details
                during registration. You can approve to create their profile records, then make any
                necessary adjustments (class assignments, corrections) afterward.
              </p>
              <p className="text-xs text-[var(--brand-muted)] italic">
                💡 Tip: After approval, you can edit student/teacher profiles to assign classes,
                correct information, or make other adjustments as needed.
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={loadUsers} loading={loading}>
            Reload
          </Button>
        </header>

        {pendingUsers.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--brand-border)] px-4 py-6 text-sm text-[var(--brand-muted)]">
            No pending approvals right now. New registrations will appear here for review.
          </p>
        ) : (
          <ul className="space-y-4" role="list">
            {pendingUsers.map((user) => (
              <li
                key={user.id}
                role="listitem"
                className="flex flex-col gap-4 rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/90 p-4"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-[var(--brand-surface-contrast)]">
                      {user.email}
                    </p>
                    <p className="text-xs uppercase tracking-wide text-[var(--brand-muted)]">
                      {user.role} · {user.is_verified ? 'Verified' : 'Not verified'} · Requested on{' '}
                      {new Date(user.created_at).toLocaleString()}
                    </p>
                    {/* Display profile data if available */}
                    {user.pending_profile_data && (
                      <div className="mt-3 rounded-lg border border-[var(--brand-border)]/50 bg-[var(--brand-surface)]/50 p-3">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--brand-muted)]">
                          Registration Details
                        </p>
                        <div className="space-y-1 text-xs text-[var(--brand-surface-contrast)]">
                          {user.pending_profile_data?.fullName ? (
                            <p>
                              <span className="font-medium">Name:</span>{' '}
                              {safeString(user.pending_profile_data.fullName)}
                            </p>
                          ) : null}
                          {user.pending_profile_data?.gender ? (
                            <p>
                              <span className="font-medium">Gender:</span>{' '}
                              {safeString(user.pending_profile_data.gender)}
                            </p>
                          ) : null}
                          {user.role === 'student' && (
                            <>
                              {user.pending_profile_data.dateOfBirth && (
                                <p>
                                  <span className="font-medium">Date of Birth:</span>{' '}
                                  {String(user.pending_profile_data.dateOfBirth)}
                                </p>
                              )}
                              {user.pending_profile_data.parentGuardianName && (
                                <p>
                                  <span className="font-medium">Parent/Guardian:</span>{' '}
                                  {String(user.pending_profile_data.parentGuardianName)}
                                </p>
                              )}
                              {user.pending_profile_data.classId && (
                                <p>
                                  <span className="font-medium">Class:</span>{' '}
                                  {String(user.pending_profile_data.classId)}
                                </p>
                              )}
                            </>
                          )}
                          {user.role === 'teacher' && (
                            <>
                              {user.pending_profile_data.phone && (
                                <p>
                                  <span className="font-medium">Phone:</span>{' '}
                                  {String(user.pending_profile_data.phone)}
                                </p>
                              )}
                              {user.pending_profile_data.qualifications && (
                                <p>
                                  <span className="font-medium">Qualifications:</span>{' '}
                                  {String(user.pending_profile_data.qualifications)}
                                </p>
                              )}
                              {user.pending_profile_data.subjects &&
                                Array.isArray(user.pending_profile_data.subjects) &&
                                user.pending_profile_data.subjects.length > 0 && (
                                  <p>
                                    <span className="font-medium">Subjects:</span>{' '}
                                    {(user.pending_profile_data.subjects as string[]).join(', ')}
                                  </p>
                                )}
                            </>
                          )}
                          {user.pending_profile_data?.address ? (
                            <p>
                              <span className="font-medium">Address:</span>{' '}
                              {safeString(user.pending_profile_data.address)}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={() => {
                          void handleApprove(user);
                        }}
                        disabled={loading}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          void handleReject(user);
                        }}
                        disabled={loading}
                      >
                        Reject
                      </Button>
                    </div>
                    {user.status === 'active' && (
                      <p className="text-xs text-[var(--brand-muted)] italic">
                        ✓ Approved - Profile created. You can now edit and assign classes.
                      </p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {message ? <StatusBanner status={status} message={message} onDismiss={clear} /> : null}

      <Table columns={columns} data={rows} caption="Tenant user roles" />

      {/* Admin User Registration Modal */}
      {showRegisterModal && (
        <AdminUserRegistrationModal
          onClose={() => setShowRegisterModal(false)}
          onSuccess={async () => {
            setShowRegisterModal(false);
            await loadUsers();
            toast.success('User registered successfully and is now active.');
          }}
        />
      )}
      </div>
    </RouteMeta>
  );
}

export default AdminRoleManagementPage;
