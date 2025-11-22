/**
 * Admin Departments Management Page
 * CRUD operations for departments, HOD assignment
 */

import { useState } from 'react';
import RouteMeta from '../../../components/layout/RouteMeta';
import { DashboardSkeleton } from '../../../components/ui/DashboardSkeleton';
import { StatusBanner } from '../../../components/ui/StatusBanner';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { Table, type TableColumn } from '../../../components/ui/Table';
import { Plus, UserPlus } from 'lucide-react';
import { EditButton, DeleteButton, ActionButtonGroup } from '../../../components/table-actions';
import {
  useDepartments,
  useCreateDepartment,
  useUpdateDepartment,
  useDeleteDepartment,
  type Department
} from '../../../hooks/queries/admin/useDepartments';

interface Department {
  id: string;
  name: string;
  slug: string;
  contactEmail: string | null;
  contactPhone: string | null;
  hodCount?: number;
  teacherCount?: number;
  createdAt: string;
  updatedAt: string;
}

export default function AdminDepartmentsPage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAssignHODModalOpen, setIsAssignHODModalOpen] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    contactEmail: '',
    contactPhone: ''
  });

  const { data, isLoading, error } = useDepartments(true);
  const createMutation = useCreateDepartment();
  const updateMutation = useUpdateDepartment();
  const deleteMutation = useDeleteDepartment();

  const handleCreate = () => {
    createMutation.mutate(formData, {
      onSuccess: () => {
        setIsCreateModalOpen(false);
        setFormData({ name: '', slug: '', contactEmail: '', contactPhone: '' });
      }
    });
  };

  const handleEdit = (dept: Department) => {
    setSelectedDepartment(dept);
    setFormData({
      name: dept.name,
      slug: dept.slug,
      contactEmail: dept.contactEmail || '',
      contactPhone: dept.contactPhone || ''
    });
    setIsEditModalOpen(true);
  };

  const handleUpdate = () => {
    if (!selectedDepartment) return;
    updateMutation.mutate(
      { id: selectedDepartment.id, payload: formData },
      {
        onSuccess: () => {
          setIsEditModalOpen(false);
          setSelectedDepartment(null);
        }
      }
    );
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this department?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleAssignHOD = (dept: Department) => {
    setSelectedDepartment(dept);
    setIsAssignHODModalOpen(true);
  };

  const columns: TableColumn<Department>[] = [
    { key: 'name', label: 'Name' },
    { key: 'slug', label: 'Slug' },
    {
      key: 'hodCount',
      label: 'HODs',
      render: (dept) => dept.hodCount ?? 0
    },
    {
      key: 'teacherCount',
      label: 'Teachers',
      render: (dept) => dept.teacherCount ?? 0
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (dept) => (
        <ActionButtonGroup>
          <EditButton onClick={() => handleEdit(dept)} />
          <DeleteButton onClick={() => handleDelete(dept.id)} />
          <Button
            size="sm"
            variant="outline"
            leftIcon={<UserPlus className="h-4 w-4" />}
            onClick={() => handleAssignHOD(dept)}
          >
            Assign HOD
          </Button>
        </ActionButtonGroup>
      )
    }
  ];

  if (isLoading) {
    return (
      <RouteMeta title="Departments">
        <DashboardSkeleton />
      </RouteMeta>
    );
  }

  if (error) {
    return (
      <RouteMeta title="Departments">
        <StatusBanner status="error" message={(error as Error).message} />
      </RouteMeta>
    );
  }

  const departments = (Array.isArray(data) ? data : (data as any)?.data || []) as Department[];

  return (
    <RouteMeta title="Departments">
      <div className="space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--brand-surface-contrast)]">
              Departments
            </h1>
            <p className="text-sm text-[var(--brand-muted)]">
              Manage departments and assign HODs
            </p>
          </div>
          <Button
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => setIsCreateModalOpen(true)}
          >
            Create Department
          </Button>
        </header>

        <Table
          columns={columns}
          data={departments}
          emptyMessage="No departments found"
        />

        {/* Create Modal */}
        <Modal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title="Create Department"
        >
          <div className="space-y-4">
            <Input
              label="Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
            <Input
              label="Slug"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              placeholder="auto-generated if empty"
            />
            <Input
              label="Contact Email"
              type="email"
              value={formData.contactEmail}
              onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
            />
            <Input
              label="Contact Phone"
              value={formData.contactPhone}
              onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
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

        {/* Edit Modal */}
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title="Edit Department"
        >
          <div className="space-y-4">
            <Input
              label="Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
            <Input
              label="Slug"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
            />
            <Input
              label="Contact Email"
              type="email"
              value={formData.contactEmail}
              onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
            />
            <Input
              label="Contact Phone"
              value={formData.contactPhone}
              onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdate} loading={updateMutation.isPending}>
                Update
              </Button>
            </div>
          </div>
        </Modal>

        {/* Assign HOD Modal */}
        <Modal
          isOpen={isAssignHODModalOpen}
          onClose={() => setIsAssignHODModalOpen(false)}
          title={`Assign HOD to ${selectedDepartment?.name}`}
        >
          <div className="space-y-4">
            <p className="text-sm text-[var(--brand-muted)]">
              HOD assignment functionality - to be implemented with user selection
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setIsAssignHODModalOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </RouteMeta>
  );
}

