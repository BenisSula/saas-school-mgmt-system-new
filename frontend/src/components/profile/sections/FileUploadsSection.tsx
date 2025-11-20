import { FileUploads, type FileUpload } from '../FileUploads';

interface FileUploadsSectionProps {
  uploads: FileUpload[];
  onUpload?: (file: File, description?: string) => Promise<void>;
  onDelete?: (uploadId: string) => Promise<void>;
  canUpload?: boolean;
  canDelete?: boolean;
  emptyMessage?: string;
  title?: string;
  description?: string;
}

export function FileUploadsSection({
  uploads,
  onUpload,
  onDelete,
  canUpload = false,
  canDelete = false,
  emptyMessage = 'No files uploaded',
  title,
  description
}: FileUploadsSectionProps) {
  return (
    <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
      <header className="mb-4">
        {title && (
          <h2 className="text-lg font-semibold text-[var(--brand-surface-contrast)]">{title}</h2>
        )}
        {description && (
          <p className="mt-1 text-sm text-[var(--brand-muted)]">{description}</p>
        )}
      </header>
      <FileUploads
        uploads={uploads}
        onUpload={onUpload}
        onDelete={onDelete}
        canUpload={canUpload}
        canDelete={canDelete}
        emptyMessage={emptyMessage}
      />
    </div>
  );
}

