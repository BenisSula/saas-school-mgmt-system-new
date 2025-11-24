/**
 * Shared component for displaying metadata fields
 */

import { Info } from 'lucide-react';
import { formatMetadataReason, formatNotificationStatus } from '../../../utils/formatters';

export interface MetadataCellProps {
  metadata?: Record<string, unknown> | null;
  showReason?: boolean;
  showNotification?: boolean;
}

export function MetadataCell({
  metadata,
  showReason = true,
  showNotification = false,
}: MetadataCellProps) {
  if (!metadata || Object.keys(metadata).length === 0) {
    return <span className="text-[var(--brand-text-secondary)] text-sm">—</span>;
  }

  const reason = showReason ? formatMetadataReason(metadata) : null;
  const notification = showNotification ? formatNotificationStatus(metadata) : null;

  if (!reason && !notification) {
    return <span className="text-[var(--brand-text-secondary)] text-sm">—</span>;
  }

  return (
    <div className="flex flex-col gap-1">
      {reason && reason !== '—' && (
        <div className="flex items-center gap-1 text-sm text-[var(--brand-text-secondary)]">
          <Info className="h-3 w-3 text-[var(--brand-muted)]" />
          <span className="truncate max-w-xs" title={reason}>
            {reason}
          </span>
        </div>
      )}
      {notification && notification !== '—' && (
        <div className="text-xs text-[var(--brand-muted)]">Notification: {notification}</div>
      )}
    </div>
  );
}
