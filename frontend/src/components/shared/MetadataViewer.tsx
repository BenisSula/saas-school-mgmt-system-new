/**
 * Reusable component for displaying metadata/JSON data
 */

import { FileText } from 'lucide-react';

export interface MetadataViewerProps {
  metadata: Record<string, unknown> | null | undefined;
  title?: string;
  maxHeight?: string;
  showRaw?: boolean;
  className?: string;
}

export function MetadataViewer({
  metadata,
  title = 'Metadata',
  maxHeight = 'max-h-64',
  showRaw = true,
  className = '',
}: MetadataViewerProps) {
  if (!metadata || Object.keys(metadata).length === 0) {
    return null;
  }

  return (
    <div
      className={`rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface-secondary)] p-4 ${className}`}
    >
      <div className="flex items-center gap-2 mb-3">
        <FileText className="h-4 w-4 text-[var(--brand-muted)]" />
        <div className="text-xs font-medium text-[var(--brand-text-secondary)]">{title}</div>
      </div>

      {showRaw ? (
        <div
          className={`overflow-auto ${maxHeight} bg-[var(--brand-surface)] p-3 rounded border border-[var(--brand-border)]`}
        >
          <pre className="text-xs text-[var(--brand-text-primary)]">
            {JSON.stringify(metadata, null, 2)}
          </pre>
        </div>
      ) : (
        <div className="space-y-2">
          {Object.entries(metadata).map(([key, value]) => (
            <div key={key} className="flex items-start gap-2">
              <span className="text-xs font-medium text-[var(--brand-text-secondary)] min-w-[100px]">
                {key}:
              </span>
              <span className="text-xs text-[var(--brand-text-primary)] flex-1">
                {typeof value === 'object' ? (
                  <code className="text-[var(--brand-muted)]">{JSON.stringify(value)}</code>
                ) : (
                  String(value)
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
