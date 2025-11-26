/**
 * Teacher Class Resources Page
 * Allows teachers to upload and manage class resources
 */

import { useState } from 'react';
import RouteMeta from '../../components/layout/RouteMeta';
import { StatusBanner } from '../../components/ui/StatusBanner';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Input } from '../../components/ui/Input';
import { useTeacherClasses } from '../../hooks/queries/useTeachers';
import {
  useClassResources,
  useUploadResource,
  useDeleteResource,
} from '../../hooks/queries/useTeacherPhase7';
import { FileText, Upload, Trash2, Download } from 'lucide-react';
import { formatDate } from '../../lib/utils/date';

export default function TeacherClassResourcesPage() {
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const { data: classes, isLoading: loadingClasses } = useTeacherClasses();
  const { data: resources, isLoading: loadingResources } = useClassResources(selectedClassId);
  const uploadMutation = useUploadResource();
  const deleteMutation = useDeleteResource();

  const handleUpload = async () => {
    if (!selectedClassId || !uploadFile || !uploadTitle.trim()) {
      return;
    }

    const formData = new FormData();
    formData.append('classId', selectedClassId);
    formData.append('title', uploadTitle);
    formData.append('description', uploadDescription);
    formData.append('file', uploadFile);

    await uploadMutation.mutateAsync(formData);
    setShowUploadModal(false);
    setUploadTitle('');
    setUploadDescription('');
    setUploadFile(null);
  };

  const handleDelete = async (resourceId: string) => {
    if (confirm('Are you sure you want to delete this resource?')) {
      await deleteMutation.mutateAsync(resourceId);
    }
  };

  const handleDownload = (fileUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <RouteMeta title="Class Resources">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Class Resources</h1>
          {selectedClassId && (
            <Button onClick={() => setShowUploadModal(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Upload Resource
            </Button>
          )}
        </div>

        <div className="flex gap-4">
          <Select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="w-64"
            options={[
              { value: '', label: 'Select a class' },
              ...(classes?.map((cls) => ({ value: cls.id, label: cls.name })) || []),
            ]}
          />
        </div>

        {loadingClasses && <StatusBanner status="info" message="Loading classes..." />}
        {loadingResources && <StatusBanner status="info" message="Loading resources..." />}

        {selectedClassId && resources && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {resources.length === 0 ? (
              <div className="col-span-full text-center text-gray-500 py-8">
                No resources uploaded yet
              </div>
            ) : (
              resources.map((resource) => (
                <div
                  key={resource.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-2">
                    <FileText className="h-8 w-8 text-blue-500" />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(resource.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <h3 className="font-semibold mb-1">{resource.title}</h3>
                  {resource.description && (
                    <p className="text-sm text-gray-600 mb-2">{resource.description}</p>
                  )}
                  <div className="text-xs text-gray-500 mb-3">
                    {formatDate(resource.created_at)} • {(resource.size / 1024).toFixed(1)} KB
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDownload(resource.file_url, resource.title)}
                    className="w-full"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </Button>
                </div>
              ))
            )}
          </div>
        )}

        {showUploadModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h2 className="text-xl font-bold mb-4">Upload Resource</h2>
              <div className="space-y-4">
                <Input
                  label="Title"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  required
                />
                <Input
                  label="Description"
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  multiline
                />
                <div>
                  <label className="block text-sm font-medium mb-1">File</label>
                  <input
                    type="file"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    className="w-full"
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png,.zip"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setShowUploadModal(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleUpload}
                    disabled={!uploadFile || !uploadTitle.trim() || uploadMutation.isPending}
                  >
                    {uploadMutation.isPending ? 'Uploading...' : 'Upload'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </RouteMeta>
  );
}
