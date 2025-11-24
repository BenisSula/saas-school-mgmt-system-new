/**
 * Shared modal component for displaying full audit log details
 */

import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { formatDate, formatRequestId, formatUserAgent } from '../../../utils/formatters';
import { TagsCell } from './TagsCell';
import { FileText, Calendar, User, MapPin, Monitor, Tag, Code } from 'lucide-react';
import type { AuditLogEntry } from '../../../lib/api';

export interface AuditDetailsModalProps {
  log: AuditLogEntry | null;
  isOpen: boolean;
  onClose: () => void;
}

export function AuditDetailsModal({ log, isOpen, onClose }: AuditDetailsModalProps) {
  if (!log) return null;

  const details = log.details || {};

  return (
    <Modal
      title="Audit Log Details"
      isOpen={isOpen}
      onClose={onClose}
      footer={
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="space-y-4">
        {/* Basic Info */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex items-start gap-2">
            <Calendar className="h-4 w-4 text-[var(--brand-muted)] mt-0.5" />
            <div>
              <div className="text-xs text-[var(--brand-text-secondary)]">Timestamp</div>
              <div className="text-sm font-medium text-[var(--brand-text-primary)]">
                {formatDate(log.createdAt || log.timestamp)}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <FileText className="h-4 w-4 text-[var(--brand-muted)] mt-0.5" />
            <div>
              <div className="text-xs text-[var(--brand-text-secondary)]">Action</div>
              <div className="text-sm font-medium text-[var(--brand-text-primary)]">
                {log.action || '—'}
              </div>
            </div>
          </div>

          {log.userEmail && (
            <div className="flex items-start gap-2">
              <User className="h-4 w-4 text-[var(--brand-muted)] mt-0.5" />
              <div>
                <div className="text-xs text-[var(--brand-text-secondary)]">User</div>
                <div className="text-sm font-medium text-[var(--brand-text-primary)]">
                  {log.userEmail}
                </div>
                {log.userId && (
                  <div className="text-xs text-[var(--brand-muted)] font-mono">
                    {log.userId.slice(0, 8)}...
                  </div>
                )}
              </div>
            </div>
          )}

          {log.ipAddress && (
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-[var(--brand-muted)] mt-0.5" />
              <div>
                <div className="text-xs text-[var(--brand-text-secondary)]">IP Address</div>
                <div className="text-sm font-medium text-[var(--brand-text-primary)] font-mono">
                  {log.ipAddress}
                </div>
              </div>
            </div>
          )}

          {log.userAgent && (
            <div className="flex items-start gap-2">
              <Monitor className="h-4 w-4 text-[var(--brand-muted)] mt-0.5" />
              <div>
                <div className="text-xs text-[var(--brand-text-secondary)]">User Agent</div>
                <div className="text-sm text-[var(--brand-text-primary)] break-all">
                  {formatUserAgent(log.userAgent, 100)}
                </div>
              </div>
            </div>
          )}

          {log.requestId && (
            <div className="flex items-start gap-2">
              <Code className="h-4 w-4 text-[var(--brand-muted)] mt-0.5" />
              <div>
                <div className="text-xs text-[var(--brand-text-secondary)]">Request ID</div>
                <div className="text-sm font-medium text-[var(--brand-text-primary)] font-mono">
                  {formatRequestId(log.requestId)}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Resource Info */}
        {(log.resourceType || log.resourceId) && (
          <div className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface-secondary)] p-4">
            <div className="text-xs font-medium text-[var(--brand-text-secondary)] mb-2">
              Resource
            </div>
            <div className="space-y-1">
              {log.resourceType && (
                <div className="text-sm text-[var(--brand-text-primary)]">
                  Type: <span className="font-medium">{log.resourceType}</span>
                </div>
              )}
              {log.resourceId && (
                <div className="text-sm text-[var(--brand-text-primary)] font-mono">
                  ID: {log.resourceId}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tags */}
        {log.tags && log.tags.length > 0 && (
          <div className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface-secondary)] p-4">
            <div className="flex items-center gap-2 mb-2">
              <Tag className="h-4 w-4 text-[var(--brand-muted)]" />
              <div className="text-xs font-medium text-[var(--brand-text-secondary)]">Tags</div>
            </div>
            <TagsCell tags={log.tags} maxDisplay={10} />
          </div>
        )}

        {/* Details */}
        {Object.keys(details).length > 0 && (
          <div className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface-secondary)] p-4">
            <div className="text-xs font-medium text-[var(--brand-text-secondary)] mb-2">
              Details
            </div>
            <pre className="text-xs text-[var(--brand-text-primary)] overflow-auto max-h-64 bg-[var(--brand-surface)] p-3 rounded border border-[var(--brand-border)]">
              {JSON.stringify(details, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </Modal>
  );
}
