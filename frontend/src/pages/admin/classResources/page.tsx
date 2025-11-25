/**
 * Class Resources Management Page
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { toast } from 'sonner';
import { ManagementPageLayout } from '../../../components/admin/ManagementPageLayout';
import { Button } from '../../../components/ui/Button';
import { Table, type TableColumn } from '../../../components/ui/Table';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Plus, FileText, Link, Video, Trash2, Edit } from 'lucide-react';
import { useClasses } from '../../../hooks/queries/useClasses';

interface ClassResource {
  id: string;
  class_id: string;
  title: string;
  description: string | null;
  resource_type: 'document' | 'link' | 'file' | 'video';
  resource_url: string;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
  updated_at: string;
}

export default function ClassResourcesPage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedResource, setSelectedResource] = useState<ClassResource | null>(null);
  const [formData, setFormData] = useState<{
    class_id: string;
    title: string;
    description: string;
    resource_type: 'document' | 'link' | 'file' | 'video';
    resource_url: string;
    file_name: string;
  }>({
    class_id: '',
    title: '',
    description: '',
    resource_type: 'document',
    resource_url: '',
    file_name: '',
  });
  const queryClient = useQueryClient();

  const { data: classes } = useClasses();
  const { data, isLoading, error } = useQuery({
    queryKey: ['class-resources'],
    queryFn: () => api.classResources.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => api.classResources.create(data),
    onSuccess: () => {
      toast.success('Class resource created successfully');
      queryClient.invalidateQueries({ queryKey: ['class-resources'] });
      setIsCreateModalOpen(false);
      setFormData({
        class_id: '',
        title: '',
        description: '',
        resource_type: 'document',
        resource_url: '',
        file_name: '',
      });
    },
    onError: (error: Error) => {
      toast.error(`Failed to create resource: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<typeof formData> }) =>
      api.classResources.update(id, data),
    onSuccess: () => {
      toast.success('Class resource updated successfully');
      queryClient.invalidateQueries({ queryKey: ['class-resources'] });
      setIsEditModalOpen(false);
      setSelectedResource(null);
    },
    onError: (error: Error) => {
      toast.error(`Failed to update resource: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.classResources.delete(id),
    onSuccess: () => {
      toast.success('Class resource deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['class-resources'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete resource: ${error.message}`);
    },
  });

  const getResourceIcon = (type: string) => {
    switch (type) {
      case 'document':
        return <FileText className="h-4 w-4" />;
      case 'link':
        return <Link className="h-4 w-4" />;
      case 'video':
        return <Video className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const columns: TableColumn<ClassResource>[] = [
    {
      header: 'Type',
      key: 'resource_type',
      render: (item) => (
        <div className="flex items-center gap-2">
          {getResourceIcon(item.resource_type)}
          <span className="capitalize">{item.resource_type}</span>
        </div>
      ),
    },
    {
      header: 'Title',
      key: 'title',
    },
    {
      header: 'Class',
      key: 'class_id',
      render: (item) => {
        const classItem = classes?.find((c) => c.id === item.class_id);
        return classItem?.name || item.class_id;
      },
    },
    {
      header: 'URL',
      key: 'resource_url',
      render: (item) => (
        <a
          href={item.resource_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 hover:underline truncate max-w-xs"
        >
          {item.resource_url}
        </a>
      ),
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (item) => (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedResource(item);
              setFormData({
                class_id: item.class_id,
                title: item.title,
                description: item.description || '',
                resource_type: item.resource_type,
                resource_url: item.resource_url,
                file_name: item.file_name || '',
              });
              setIsEditModalOpen(true);
            }}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (confirm('Are you sure you want to delete this resource?')) {
                deleteMutation.mutate(item.id);
              }
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const handleExportCSV = () => {
    // TODO: Implement CSV export
    toast.info('CSV export coming soon');
  };

  return (
    <ManagementPageLayout
      title="Class Resources"
      description="Manage resources (documents, links, files, videos) for classes"
      error={error ? (error as Error).message : null}
      loading={isLoading}
      bulkActionButton={
        <Button onClick={() => setIsCreateModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Resource
        </Button>
      }
      onExportCSV={handleExportCSV}
    >
      <Table
        columns={columns}
        data={data || []}
        emptyMessage="No class resources found. Add your first resource to get started."
      />

      {/* Create Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Add Class Resource"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate(formData);
          }}
        >
          <Select
            label="Class"
            value={formData.class_id}
            onChange={(e) => setFormData({ ...formData, class_id: e.target.value })}
            required
            options={classes?.map((c) => ({ label: c.name, value: c.id })) || []}
          />
          <Input
            label="Title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            required
            className="mt-4"
          />
          <Input
            label="Description"
            multiline
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="mt-4"
          />
          <Select
            label="Resource Type"
            value={formData.resource_type}
            onChange={(e) =>
              setFormData({
                ...formData,
                resource_type: e.target.value as typeof formData.resource_type,
              })
            }
            required
            className="mt-4"
            options={[
              { label: 'Document', value: 'document' },
              { label: 'Link', value: 'link' },
              { label: 'File', value: 'file' },
              { label: 'Video', value: 'video' },
            ]}
          />
          <Input
            label="Resource URL"
            type="url"
            value={formData.resource_url}
            onChange={(e) => setFormData({ ...formData, resource_url: e.target.value })}
            required
            className="mt-4"
          />
          <Input
            label="File Name (optional)"
            value={formData.file_name}
            onChange={(e) => setFormData({ ...formData, file_name: e.target.value })}
            className="mt-4"
          />
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedResource(null);
        }}
        title="Edit Class Resource"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (selectedResource) {
              updateMutation.mutate({ id: selectedResource.id, data: formData });
            }
          }}
        >
          <Select
            label="Class"
            value={formData.class_id}
            onChange={(e) => setFormData({ ...formData, class_id: e.target.value })}
            required
            options={classes?.map((c) => ({ label: c.name, value: c.id })) || []}
          />
          <Input
            label="Title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            required
            className="mt-4"
          />
          <Input
            label="Description"
            multiline
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="mt-4"
          />
          <Select
            label="Resource Type"
            value={formData.resource_type}
            onChange={(e) =>
              setFormData({
                ...formData,
                resource_type: e.target.value as typeof formData.resource_type,
              })
            }
            required
            className="mt-4"
            options={[
              { label: 'Document', value: 'document' },
              { label: 'Link', value: 'link' },
              { label: 'File', value: 'file' },
              { label: 'Video', value: 'video' },
            ]}
          />
          <Input
            label="Resource URL"
            type="url"
            value={formData.resource_url}
            onChange={(e) => setFormData({ ...formData, resource_url: e.target.value })}
            required
            className="mt-4"
          />
          <Input
            label="File Name (optional)"
            value={formData.file_name}
            onChange={(e) => setFormData({ ...formData, file_name: e.target.value })}
            className="mt-4"
          />
          <div className="mt-4 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsEditModalOpen(false);
                setSelectedResource(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Updating...' : 'Update'}
            </Button>
          </div>
        </form>
      </Modal>
    </ManagementPageLayout>
  );
}
