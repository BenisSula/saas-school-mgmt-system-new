import { useState, type ChangeEvent } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

export interface FileUpload {
  id: string;
  filename: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
  uploadedBy: string | null;
  description: string | null;
  downloadUrl?: string;
}

interface FileUploadsProps {
  uploads: FileUpload[];
  onUpload?: (file: File, description?: string) => Promise<void>;
  onDelete?: (uploadId: string) => Promise<void>;
  canUpload?: boolean;
  canDelete?: boolean;
  emptyMessage?: string;
}

export function FileUploads({
  uploads,
  onUpload,
  onDelete,
  canUpload = false,
  canDelete = false,
  emptyMessage = 'No files uploaded'
}: FileUploadsProps) {
  const [uploading, setUploading] = useState(false);
  const [description, setDescription] = useState('');

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !onUpload) return;

    setUploading(true);
    try {
      await onUpload(file, description || undefined);
      setDescription('');
      event.target.value = '';
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setUploading(false);
    }
  };

  if (uploads.length === 0 && !canUpload) {
    return <p className="text-sm text-[var(--brand-muted)]">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-4">
      {canUpload && onUpload && (
        <div className="rounded-lg border border-[var(--brand-border)]/60 bg-slate-950/40 p-4">
          <div className="space-y-3">
            <Input
              label="File description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the file..."
            />
            <div className="flex items-center gap-2">
              <Input
                type="file"
                onChange={handleFileSelect}
                disabled={uploading}
                className="flex-1"
              />
              {uploading && <span className="text-sm text-[var(--brand-muted)]">Uploading...</span>}
            </div>
          </div>
        </div>
      )}

      {uploads.length > 0 && (
        <div className="space-y-2">
          {uploads.map((upload) => (
            <div
              key={upload.id}
              className="flex items-center justify-between rounded-lg border border-[var(--brand-border)]/60 bg-slate-950/40 p-3"
            >
              <div className="flex-1">
                <p className="text-sm font-medium text-[var(--brand-surface-contrast)]">
                  {upload.filename}
                </p>
                <div className="mt-1 flex items-center gap-3 text-xs text-[var(--brand-muted)]">
                  <span>{formatFileSize(upload.fileSize)}</span>
                  <span>•</span>
                  <span>{upload.mimeType}</span>
                  <span>•</span>
                  <time>{new Date(upload.uploadedAt).toLocaleDateString()}</time>
                  {upload.description && (
                    <>
                      <span>•</span>
                      <span>{upload.description}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                {upload.downloadUrl && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(upload.downloadUrl, '_blank')}
                  >
                    Download
                  </Button>
                )}
                {canDelete && onDelete && (
                  <Button size="sm" variant="ghost" onClick={() => onDelete(upload.id)}>
                    Delete
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
