import { AuditLogs, type AuditLogEntry } from '../AuditLogs';

interface AuditLogsSectionProps {
  logs: AuditLogEntry[];
  loading?: boolean;
  onRefresh?: () => void;
  emptyMessage?: string;
  title?: string;
  description?: string;
}

export function AuditLogsSection({
  logs,
  loading = false,
  onRefresh,
  emptyMessage = 'No audit logs available',
  title,
  description
}: AuditLogsSectionProps) {
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
      <AuditLogs logs={logs} loading={loading} onRefresh={onRefresh} emptyMessage={emptyMessage} />
    </div>
  );
}

