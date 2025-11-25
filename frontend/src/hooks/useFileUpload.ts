import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import type { FileUpload } from '../components/profile/FileUploads';

export interface UseFileUploadOptions {
  entityType?: 'user' | 'student' | 'teacher' | 'hod';
  entityId?: string;
  onUploadSuccess?: (upload: FileUpload) => void;
  onUploadError?: (error: Error) => void;
}

export function useFileUpload(options: UseFileUploadOptions = {}) {
  const [uploading, setUploading] = useState(false);

  const uploadFile = useCallback(
    async (file: File, description?: string): Promise<FileUpload> => {
      setUploading(true);
      try {
        // Convert file to base64
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            // Remove data URL prefix (e.g., "data:image/png;base64,")
            const base64Data = result.includes(',') ? result.split(',')[1] : result;
            resolve(base64Data);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const result = await api.uploadFile({
          file: base64,
          filename: file.name,
          mimetype: file.type,
          description,
          entityType: options.entityType,
          entityId: options.entityId,
        });

        const upload: FileUpload = {
          id: result.id,
          filename: result.filename,
          fileSize: result.fileSize,
          mimeType: result.mimeType,
          uploadedAt: result.uploadedAt.toISOString(),
          uploadedBy: result.uploadedBy,
          description: description || null,
          downloadUrl: result.fileUrl,
        };

        options.onUploadSuccess?.(upload);
        toast.success('File uploaded successfully');
        return upload;
      } catch (error) {
        const err = error as Error;
        options.onUploadError?.(err);
        toast.error(err.message || 'Failed to upload file');
        throw err;
      } finally {
        setUploading(false);
      }
    },
    [options]
  );

  const deleteFile = useCallback(async (fileId: string): Promise<void> => {
    try {
      await api.deleteFileUpload(fileId);
      toast.success('File deleted successfully');
    } catch (error) {
      const err = error as Error;
      toast.error(err.message || 'Failed to delete file');
      throw err;
    }
  }, []);

  return {
    uploadFile,
    deleteFile,
    uploading,
  };
}
