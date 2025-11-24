/**
 * Admin Announcements Page
 * Create and manage announcements for different user roles
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
import { Plus } from 'lucide-react';
import {
  useAnnouncements,
  useCreateAnnouncement,
  type Announcement,
} from '../../../hooks/queries/admin/useAnnouncements';

export default function AdminAnnouncementsPage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [targetRoleFilter, setTargetRoleFilter] = useState<string>('all');
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    targetRoles: [] as Array<'admin' | 'hod' | 'teacher' | 'student'>,
    priority: 'normal' as 'low' | 'normal' | 'high' | 'urgent',
    expiresAt: '',
  });

  const filters = {
    targetRole:
      targetRoleFilter !== 'all'
        ? (targetRoleFilter as 'admin' | 'hod' | 'teacher' | 'student')
        : undefined,
  };

  const { data, isLoading, error } = useAnnouncements(filters);
  const createMutation = useCreateAnnouncement();

  const handleCreate = () => {
    if (formData.targetRoles.length === 0) {
      alert('Please select at least one target role');
      return;
    }
    createMutation.mutate(
      {
        ...formData,
        expiresAt: formData.expiresAt || undefined,
      },
      {
        onSuccess: () => {
          setIsCreateModalOpen(false);
          setFormData({
            title: '',
            content: '',
            targetRoles: [],
            priority: 'normal',
            expiresAt: '',
          });
        },
      }
    );
  };

  const toggleTargetRole = (role: 'admin' | 'hod' | 'teacher' | 'student') => {
    if (formData.targetRoles.includes(role)) {
      setFormData({
        ...formData,
        targetRoles: formData.targetRoles.filter((r) => r !== role),
      });
    } else {
      setFormData({
        ...formData,
        targetRoles: [...formData.targetRoles, role],
      });
    }
  };

  const columns: TableColumn<Announcement>[] = [
    { key: 'title', label: 'Title' },
    {
      key: 'content',
      label: 'Content',
      render: (announcement) => <div className="max-w-md truncate">{announcement.content}</div>,
    },
    {
      key: 'targetRoles',
      label: 'Target Roles',
      render: (announcement) => announcement.targetRoles.join(', '),
    },
    {
      key: 'priority',
      label: 'Priority',
      render: (announcement) => (
        <span
          className={
            announcement.priority === 'urgent'
              ? 'text-red-500'
              : announcement.priority === 'high'
                ? 'text-orange-500'
                : announcement.priority === 'low'
                  ? 'text-gray-500'
                  : 'text-blue-500'
          }
        >
          {announcement.priority}
        </span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Created',
      render: (announcement) => new Date(announcement.createdAt).toLocaleString(),
    },
    {
      key: 'expiresAt',
      label: 'Expires',
      render: (announcement) =>
        announcement.expiresAt ? new Date(announcement.expiresAt).toLocaleString() : 'Never',
    },
  ];

  if (isLoading) {
    return (
      <RouteMeta title="Announcements">
        <DashboardSkeleton />
      </RouteMeta>
    );
  }

  if (error) {
    return (
      <RouteMeta title="Announcements">
        <StatusBanner status="error" message={(error as Error).message} />
      </RouteMeta>
    );
  }

  const response = data as
    | { announcements?: Announcement[]; data?: { announcements?: Announcement[] } }
    | undefined;
  const announcements = (response?.announcements ||
    response?.data?.announcements ||
    []) as Announcement[];

  return (
    <RouteMeta title="Announcements">
      <div className="space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--brand-surface-contrast)]">
              Announcements
            </h1>
            <p className="text-sm text-[var(--brand-muted)]">
              Create and manage announcements for users
            </p>
          </div>
          <Button
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => setIsCreateModalOpen(true)}
          >
            Create Announcement
          </Button>
        </header>

        {/* Filter */}
        <Select
          label="Filter by Target Role"
          value={targetRoleFilter}
          onChange={(e) => setTargetRoleFilter(e.target.value)}
          options={[
            { value: 'all', label: 'All Roles' },
            { value: 'admin', label: 'Admin' },
            { value: 'hod', label: 'HOD' },
            { value: 'teacher', label: 'Teacher' },
            { value: 'student', label: 'Student' },
          ]}
        />

        <Table columns={columns} data={announcements} emptyMessage="No announcements found" />

        {/* Create Modal */}
        <Modal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title="Create Announcement"
        >
          <div className="space-y-4">
            <Input
              label="Title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
            <div>
              <label className="block text-sm font-medium mb-2">Content</label>
              <textarea
                className="w-full rounded-md border border-[var(--brand-border)] bg-[var(--brand-surface)] px-3 py-2"
                rows={4}
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Target Roles</label>
              <div className="space-y-2">
                {(['admin', 'hod', 'teacher', 'student'] as const).map((role) => (
                  <label key={role} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.targetRoles.includes(role)}
                      onChange={() => toggleTargetRole(role)}
                    />
                    <span className="capitalize">{role}</span>
                  </label>
                ))}
              </div>
            </div>
            <Select
              label="Priority"
              value={formData.priority}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  priority: e.target.value as 'low' | 'normal' | 'high' | 'urgent',
                })
              }
              options={[
                { value: 'low', label: 'Low' },
                { value: 'normal', label: 'Normal' },
                { value: 'high', label: 'High' },
                { value: 'urgent', label: 'Urgent' },
              ]}
            />
            <Input
              label="Expires At"
              type="datetime-local"
              value={formData.expiresAt}
              onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} loading={createMutation.isPending}>
                Create
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </RouteMeta>
  );
}
