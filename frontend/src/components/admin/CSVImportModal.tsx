import React, { useState, useRef } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { toast } from 'sonner';

export interface CSVImportResult {
  success: number;
  failed: number;
  errors: Array<{ row: number; message: string }>;
}

export interface CSVImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (file: File) => Promise<CSVImportResult>;
  entityType: 'teachers' | 'students' | 'hods';
  templateUrl?: string;
  acceptedColumns?: string[];
}

export function CSVImportModal({
  isOpen,
  onClose,
  onImport,
  entityType,
  templateUrl,
  acceptedColumns
}: CSVImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<CSVImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.csv')) {
        toast.error('Please select a CSV file');
        return;
      }
      setFile(selectedFile);
      setResult(null);
    }
  };

  const handleImport = async () => {
    if (!file) {
      toast.error('Please select a file first');
      return;
    }

    setIsUploading(true);
    setResult(null);

    try {
      const importResult = await onImport(file);
      setResult(importResult);

      if (importResult.failed === 0) {
        toast.success(`Successfully imported ${importResult.success} ${entityType}`);
        setTimeout(() => {
          handleClose();
        }, 2000);
      } else if (importResult.success > 0) {
        toast.warning(
          `Imported ${importResult.success} ${entityType}, but ${importResult.failed} failed`
        );
      } else {
        toast.error(`Failed to import ${entityType}. Please check the errors below.`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Import failed';
      toast.error(message);
      setResult({
        success: 0,
        failed: 1,
        errors: [{ row: 0, message }]
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  const handleDownloadTemplate = () => {
    if (templateUrl) {
      window.open(templateUrl, '_blank');
    } else {
      // Generate a simple CSV template based on entity type
      const templates = {
        teachers: 'email,fullName,password,phone,qualifications,yearsOfExperience,subjects\n',
        students:
          'email,fullName,password,dateOfBirth,classId,studentId,parentGuardianName,parentGuardianContact\n',
        hods: 'email,fullName,password,phone,qualifications,subjects,department\n'
      };

      const csvContent = templates[entityType];
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${entityType}-template.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <Modal
      title={`Import ${entityType.charAt(0).toUpperCase() + entityType.slice(1)} from CSV`}
      isOpen={isOpen}
      onClose={handleClose}
    >
      <div className="space-y-6">
        {/* Instructions */}
        <div className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)]/50 p-4">
          <h4 className="mb-2 text-sm font-semibold text-[var(--brand-surface-contrast)]">
            CSV Import Instructions
          </h4>
          <ul className="space-y-1 text-xs text-[var(--brand-muted)]">
            <li>• Your CSV file must have a header row with column names</li>
            <li>• Required columns: email, fullName, password</li>
            {acceptedColumns && acceptedColumns.length > 0 && (
              <li>• Accepted columns: {acceptedColumns.join(', ')}</li>
            )}
            <li>• Passwords must be at least 8 characters long</li>
            <li>• Maximum file size: 10MB</li>
          </ul>
        </div>

        {/* File Selection */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-[var(--brand-surface-contrast)]">
            Select CSV File
          </label>
          <div className="flex gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
              id="csv-file-input"
            />
            <label
              htmlFor="csv-file-input"
              className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[var(--brand-border)] bg-[var(--brand-surface)]/50 p-6 transition-colors hover:border-[var(--brand-primary)]"
            >
              {file ? (
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-[var(--brand-primary)]" />
                  <span className="text-sm text-[var(--brand-surface-contrast)]">{file.name}</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-8 w-8 text-[var(--brand-muted)]" />
                  <span className="text-sm text-[var(--brand-muted)]">
                    Click to select or drag and drop
                  </span>
                </div>
              )}
            </label>
            <Button
              variant="outline"
              onClick={handleDownloadTemplate}
              className="shrink-0"
            >
              Download Template
            </Button>
          </div>
        </div>

        {/* Import Results */}
        {result && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span className="font-semibold text-[var(--brand-surface-contrast)]">
                  {result.success} imported successfully
                </span>
              </div>
              {result.failed > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  <span className="font-semibold text-red-500">{result.failed} failed</span>
                </div>
              )}
            </div>

            {result.errors.length > 0 && (
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-red-500/20 bg-red-500/10 p-3">
                <h5 className="text-xs font-semibold text-red-500">Errors:</h5>
                {result.errors.map((error, idx) => (
                  <div key={idx} className="text-xs text-red-400">
                    Row {error.row}: {error.message}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={isUploading}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={!file || isUploading} loading={isUploading}>
            Import {file ? `(${file.name})` : ''}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default CSVImportModal;

