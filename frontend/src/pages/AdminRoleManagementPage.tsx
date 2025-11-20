import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api, type TenantUser } from '../lib/api';
import { userApi } from '../lib/api/userApi';

// Helper to safely convert unknown to string for display
const safeString = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  return String(value);
};
import { Button } from '../components/ui/Button';
import { StatusBanner } from '../components/ui/StatusBanner';
import { useAsyncFeedback } from '../hooks/useAsyncFeedback';
import { AdminUserRegistrationModal } from '../components/admin/AdminUserRegistrationModal';

function AdminRoleManagementPage() {
  const navigate = useNavigate();
  const [pendingUsers, setPendingUsers] = useState<TenantUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<TenantUser[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<boolean>(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [sortBy, setSortBy] = useState<'date' | 'role' | 'email'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const { status, message, setInfo, setSuccess, setError, clear } = useAsyncFeedback();

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      clear();
      const pendingResult = await Promise.allSettled([userApi.listPendingUsers()]);

      if (pendingResult[0].status === 'fulfilled') {
        // Only show users with status='pending' in pending approvals
        const pending = pendingResult[0].value.filter((user) => user.status === 'pending');
        setPendingUsers(pending);
        applyFiltersAndSort(pending, filterRole, searchQuery, sortBy, sortOrder);
      } else {
        setPendingUsers([]);
        setFilteredUsers([]);
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
        await userApi.approveUser(user.id);
        setSuccess(
          `${user.email} approved. Profile record created. You can now edit and assign classes.`
        );
        toast.success(`${user.email} approved. Profile record created.`, {
          description: 'You can now edit the profile to assign classes or make corrections.'
        });
        setPendingUsers((current) => current.filter((candidate) => candidate.id !== user.id));
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
        await userApi.rejectUser(user.id);
        setPendingUsers((current) => current.filter((candidate) => candidate.id !== user.id));
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

  // Apply filters and sorting
  const applyFiltersAndSort = useCallback((
    users: TenantUser[],
    roleFilter: string,
    query: string,
    sortField: 'date' | 'role' | 'email',
    order: 'asc' | 'desc'
  ) => {
    let filtered = [...users];

    // Filter by role
    if (roleFilter !== 'all') {
      filtered = filtered.filter((u) => u.role === roleFilter);
    }

    // Filter by search query
    if (query.trim()) {
      const lowerQuery = query.toLowerCase();
      filtered = filtered.filter((u) =>
        u.email.toLowerCase().includes(lowerQuery) ||
        (u.pending_profile_data?.fullName && 
         String(u.pending_profile_data.fullName).toLowerCase().includes(lowerQuery))
      );
    }

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'date') {
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else if (sortField === 'role') {
        comparison = a.role.localeCompare(b.role);
      } else if (sortField === 'email') {
        comparison = a.email.localeCompare(b.email);
      }
      return order === 'asc' ? comparison : -comparison;
    });

    setFilteredUsers(filtered);
  }, []);

  // Update filtered list when filters change
  useEffect(() => {
    applyFiltersAndSort(pendingUsers, filterRole, searchQuery, sortBy, sortOrder);
  }, [pendingUsers, filterRole, searchQuery, sortBy, sortOrder, applyFiltersAndSort]);

  const handleBulkApprove = useCallback(async () => {
    if (selectedUsers.size === 0) return;

    try {
      setLoading(true);
      clear();
      const userIds = Array.from(selectedUsers);
      const result = await api.bulkApproveUsers(userIds);
      
      if (result.successful > 0) {
        setSuccess(`Successfully approved ${result.successful} user(s)`);
        toast.success(`Approved ${result.successful} user(s)`, {
          description: result.failed > 0 ? `${result.failed} failed` : undefined
        });
        setSelectedUsers(new Set());
        await loadUsers();
      } else {
        setError('Failed to approve users');
        toast.error('Failed to approve users');
      }
    } catch (error) {
      const errorMessage = (error as Error).message;
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [selectedUsers, clear, setSuccess, setError, loadUsers]);

  const handleBulkReject = useCallback(async () => {
    if (selectedUsers.size === 0) return;

    if (typeof window !== 'undefined') {
      const confirmed = window.confirm(
        `Reject ${selectedUsers.size} user(s)? They will remain unable to sign in.`
      );
      if (!confirmed) {
        return;
      }
    }

    try {
      setLoading(true);
      clear();
      const userIds = Array.from(selectedUsers);
      const result = await api.bulkRejectUsers(userIds);
      
      if (result.successful > 0) {
        setSuccess(`Successfully rejected ${result.successful} user(s)`);
        toast.success(`Rejected ${result.successful} user(s)`, {
          description: result.failed > 0 ? `${result.failed} failed` : undefined
        });
        setSelectedUsers(new Set());
        await loadUsers();
      } else {
        setError('Failed to reject users');
        toast.error('Failed to reject users');
      }
    } catch (error) {
      const errorMessage = (error as Error).message;
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [selectedUsers, clear, setSuccess, setError, loadUsers]);

  const toggleUserSelection = useCallback((userId: string) => {
    setSelectedUsers((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedUsers.size === filteredUsers.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(filteredUsers.map((u) => u.id)));
    }
  }, [filteredUsers, selectedUsers.size]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);


  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Role management</h1>
          <p className="text-sm text-slate-300">
            View tenant users, register new users, and adjust their role assignment. Only admins and
            superadmins can modify roles.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowRegisterModal(true)}>
            Register New User
          </Button>
          <Button onClick={loadUsers} loading={loading}>
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

        {/* Filters and Sorting */}
        {pendingUsers.length > 0 && (
          <div className="space-y-4 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)]/50 p-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--brand-surface-contrast)]">
                  Search
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by email or name..."
                  className="w-full rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--brand-surface-contrast)]">
                  Filter by Role
                </label>
                <select
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value)}
                  className="w-full rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] px-3 py-2 text-sm"
                >
                  <option value="all">All Roles</option>
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                  <option value="hod">HOD</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--brand-surface-contrast)]">
                  Sort By
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'date' | 'role' | 'email')}
                  className="w-full rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] px-3 py-2 text-sm"
                >
                  <option value="date">Date</option>
                  <option value="role">Role</option>
                  <option value="email">Email</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--brand-surface-contrast)]">
                  Order
                </label>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                  className="w-full rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] px-3 py-2 text-sm"
                >
                  <option value="desc">Descending</option>
                  <option value="asc">Ascending</option>
                </select>
              </div>
            </div>
            {selectedUsers.size > 0 && (
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleBulkApprove}
                  disabled={loading}
                  size="sm"
                >
                  Approve Selected ({selectedUsers.size})
                </Button>
                <Button
                  variant="outline"
                  onClick={handleBulkReject}
                  disabled={loading}
                  size="sm"
                >
                  Reject Selected ({selectedUsers.size})
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setSelectedUsers(new Set())}
                  size="sm"
                >
                  Clear Selection
                </Button>
              </div>
            )}
          </div>
        )}

        {filteredUsers.length === 0 && pendingUsers.length > 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--brand-border)] px-4 py-6 text-sm text-[var(--brand-muted)]">
            No users match the current filters. Try adjusting your search or filter criteria.
          </p>
        ) : filteredUsers.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--brand-border)] px-4 py-6 text-sm text-[var(--brand-muted)]">
            No pending approvals right now. New registrations will appear here for review.
          </p>
        ) : (
          <ul className="space-y-4" role="list">
            {pendingUsers.length > 0 && (
              <li className="flex items-center gap-2 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)]/50 p-2">
                <input
                  type="checkbox"
                  checked={selectedUsers.size === filteredUsers.length && filteredUsers.length > 0}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 rounded border-[var(--brand-border)]"
                />
                <span className="text-sm text-[var(--brand-muted)]">
                  Select All ({filteredUsers.length} users)
                </span>
              </li>
            )}
            {filteredUsers.map((user) => (
              <li
                key={user.id}
                role="listitem"
                className="flex flex-col gap-4 rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/90 p-4"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <input
                      type="checkbox"
                      checked={selectedUsers.has(user.id)}
                      onChange={() => toggleUserSelection(user.id)}
                      className="mt-1 h-4 w-4 rounded border-[var(--brand-border)]"
                    />
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
                          {(user.role === 'teacher' || user.role === 'hod') && (
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

      {/* Quick Links to Management Pages */}
      <section className="space-y-4 rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-[var(--brand-surface-contrast)]">
              User Management
            </h2>
            <p className="text-sm text-[var(--brand-muted)]">
              Approve pending user registrations and manage user access. For detailed management of
              specific user types, use the dedicated management pages.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => navigate('/dashboard/teachers')}>
              Manage Teachers
            </Button>
            <Button variant="outline" onClick={() => navigate('/dashboard/students')}>
              Manage Students
            </Button>
            <Button variant="outline" onClick={() => navigate('/dashboard/hods')}>
              Manage HODs
            </Button>
          </div>
        </header>
      </section>

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
  );
}

export default AdminRoleManagementPage;
