/**
 * Resource Upload Modal Component
 * Reusable modal for uploading class resources
 */

import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { useUploadResource } from '../../hooks/queries/useTeacherPhase7';

interface ResourceUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  classId: string;
  onSuccess?: () => void;
}

export function ResourceUploadModal({ isOpen, onClose, classId, onSuccess }: ResourceUploadModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const uploadMutation = useUploadResource();

  const handleSubmit = async () => {
    if (!file || !title.trim()) {
      return;
    }

    const formData = new FormData();
    formData.append('classId', classId);
    formData.append('title', title);
    formData.append('description', description);
    formData.append('file', file);

    await uploadMutation.mutateAsync(formData);
    
    // Reset form
    setTitle('');
    setDescription('');
    setFile(null);
    
    onSuccess?.();
    onClose();
  };

  const handleClose = () => {
    setTitle('');
    setDescription('');
    setFile(null);
    onClose();
  };

  return (
    <Modal
      title="Upload Resource"
      isOpen={isOpen}
      onClose={handleClose}
      footer={
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!file || !title.trim() || uploadMutation.isPending}
          >
            {uploadMutation.isPending ? 'Uploading...' : 'Upload'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter resource title"
          required
        />
        <Input
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Enter description (optional)"
          multiline
          rows={3}
        />
        <div>
          <label className="block text-sm font-medium mb-1">
            File <span className="text-red-500">*</span>
          </label>
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png,.zip"
          />
          <p className="text-xs text-gray-500 mt-1">
            Supported formats: PDF, DOCX, PPTX, Images, ZIP (Max 10MB)
          </p>
        </div>
      </div>
    </Modal>
  );
}

