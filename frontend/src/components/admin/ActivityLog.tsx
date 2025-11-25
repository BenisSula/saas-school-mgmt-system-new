import { Activity, Clock, User } from 'lucide-react';
import { useActivityLogs, type ActivityLogFilters } from '../../hooks/queries/useActivityLogs';
import { DashboardSkeleton } from '../ui/DashboardSkeleton';
import { StatusBanner } from '../ui/StatusBanner';

export interface ActivityLogProps {
  entityType?: 'teacher' | 'student' | 'hod' | 'user';
  entityId?: string;
  limit?: number;
  showTitle?: boolean;
}

export function ActivityLog({
  entityType,
  entityId,
  limit = 10,
  showTitle = true,
}: ActivityLogProps) {
  const filters: ActivityLogFilters = {
    ...(entityType && { entityType }),
    ...(entityId && { entityId }),
    limit,
  };

  const { data: logs = [], isLoading, error } = useActivityLogs(filters);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <StatusBanner
        status="error"
        message={error instanceof Error ? error.message : 'Failed to load activity logs'}
      />
    );
  }

  if (logs.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)]/50 p-6 text-center">
        <Activity className="mx-auto h-8 w-8 text-[var(--brand-muted)]" />
        <p className="mt-2 text-sm text-[var(--brand-muted)]">No activity logs found</p>
      </div>
    );
  }

  const formatAction = (action: string) => {
    return action
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-4">
      {showTitle && (
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-[var(--brand-primary)]" />
          <h3 className="text-lg font-semibold text-[var(--brand-surface-contrast)]">
            Recent Activity
          </h3>
        </div>
      )}

      <div className="space-y-2">
        {logs.map((log) => (
          <div
            key={log.id}
            className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)]/50 p-4 transition-colors hover:bg-[var(--brand-surface)]/80"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <div className="rounded-full bg-[var(--brand-primary)]/20 p-1.5">
                    <Activity className="h-3.5 w-3.5 text-[var(--brand-primary)]" />
                  </div>
                  <span className="font-semibold text-[var(--brand-surface-contrast)]">
                    {formatAction(log.action)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-[var(--brand-muted)]">{log.description}</p>
                {log.userEmail && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-[var(--brand-muted)]">
                    <User className="h-3 w-3" />
                    <span>{log.userEmail}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 text-xs text-[var(--brand-muted)]">
                <Clock className="h-3 w-3" />
                <time dateTime={log.timestamp}>{formatTime(log.timestamp)}</time>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ActivityLog;
