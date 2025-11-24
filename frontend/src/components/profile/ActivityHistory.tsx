export interface ActivityItem {
  id: string;
  action: string;
  description: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

interface ActivityHistoryProps {
  activities: ActivityItem[];
  emptyMessage?: string;
}

export function ActivityHistory({
  activities,
  emptyMessage = 'No activity history available',
}: ActivityHistoryProps) {
  if (activities.length === 0) {
    return <p className="text-sm text-[var(--brand-muted)]">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-3">
      {activities.map((activity) => (
        <div
          key={activity.id}
          className="rounded-lg border border-[var(--brand-border)]/60 bg-slate-950/40 p-4"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-[var(--brand-surface-contrast)]">
                {activity.action}
              </p>
              <p className="mt-1 text-xs text-[var(--brand-muted)]">{activity.description}</p>
              {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                <div className="mt-2 text-xs text-[var(--brand-muted)]">
                  {Object.entries(activity.metadata).map(([key, value]) => (
                    <span key={key} className="mr-3">
                      <span className="font-medium">{key}:</span> {String(value)}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <time className="text-xs text-[var(--brand-muted)] whitespace-nowrap">
              {new Date(activity.timestamp).toLocaleString()}
            </time>
          </div>
        </div>
      ))}
    </div>
  );
}
