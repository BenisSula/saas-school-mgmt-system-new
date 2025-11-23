import { useState } from 'react';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { Input } from '../ui/Input';
import type { AuditLogEntry } from '../../lib/api';

// AuditLogEntry is now exported from api.ts

interface AuditLogsProps {
  logs: AuditLogEntry[];
  loading?: boolean;
  onRefresh?: () => void;
  emptyMessage?: string;
}

export function AuditLogs({
  logs,
  loading = false,
  onRefresh,
  emptyMessage = 'No audit logs available'
}: AuditLogsProps) {
  const [filter, setFilter] = useState<{ action: string; dateFrom: string; dateTo: string }>({
    action: 'all',
    dateFrom: '',
    dateTo: ''
  });

  const filteredLogs = logs.filter((log) => {
    if (filter.action !== 'all' && log.action !== filter.action) return false;
    if (filter.dateFrom && log.timestamp && log.timestamp < filter.dateFrom) return false;
    if (filter.dateTo && log.timestamp && log.timestamp > filter.dateTo) return false;
    return true;
  });

  const uniqueActions = Array.from(new Set(logs.map((log) => log.action)));

  if (logs.length === 0) {
    return <p className="text-sm text-[var(--brand-muted)]">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="grid gap-4 md:grid-cols-4">
        <Select
          label="Action"
          value={filter.action}
          onChange={(e) => setFilter((f) => ({ ...f, action: e.target.value }))}
          options={[
            { label: 'All actions', value: 'all' },
            ...uniqueActions.map((action) => ({ label: action, value: action }))
          ]}
        />
        <Input
          label="From date"
          type="date"
          value={filter.dateFrom}
          onChange={(e) => setFilter((f) => ({ ...f, dateFrom: e.target.value }))}
        />
        <Input
          label="To date"
          type="date"
          value={filter.dateTo}
          onChange={(e) => setFilter((f) => ({ ...f, dateTo: e.target.value }))}
        />
        <div className="flex items-end">
          {onRefresh && (
            <Button size="sm" variant="outline" onClick={onRefresh} disabled={loading}>
              Refresh
            </Button>
          )}
        </div>
      </div>

      {/* Logs */}
      <div className="space-y-2">
        {filteredLogs.length === 0 ? (
          <p className="text-sm text-[var(--brand-muted)]">No logs match the current filters</p>
        ) : (
          filteredLogs.map((log) => (
            <div
              key={log.id}
              className="rounded-lg border border-[var(--brand-border)]/60 bg-slate-950/40 p-3 text-xs"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[var(--brand-surface-contrast)]">
                      {log.action}
                    </span>
                    <span className="text-[var(--brand-muted)]">•</span>
                    <span className="text-[var(--brand-muted)]">{log.entityType}</span>
                    {log.userEmail && (
                      <>
                        <span className="text-[var(--brand-muted)]">•</span>
                        <span className="text-[var(--brand-muted)]">{log.userEmail}</span>
                      </>
                    )}
                  </div>
                  {log.details && Object.keys(log.details).length > 0 && (
                    <div className="mt-1 text-[var(--brand-muted)]">
                      {JSON.stringify(log.details, null, 2)}
                    </div>
                  )}
                  {log.ipAddress && (
                    <div className="mt-1 text-[var(--brand-muted)]">IP: {log.ipAddress}</div>
                  )}
                </div>
                <time className="text-[var(--brand-muted)] whitespace-nowrap">
                  {(() => {
                    const ts = log.timestamp || log.createdAt;
                    if (!ts) return 'N/A';
                    if (typeof ts === 'string') return new Date(ts).toLocaleString();
                    if (ts instanceof Date) return ts.toLocaleString();
                    return 'N/A';
                  })()}
                </time>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
