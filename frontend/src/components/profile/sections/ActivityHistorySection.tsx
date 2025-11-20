import { ActivityHistory, type ActivityItem } from '../ActivityHistory';

interface ActivityHistorySectionProps {
  activities: ActivityItem[];
  emptyMessage?: string;
  title?: string;
  description?: string;
}

export function ActivityHistorySection({
  activities,
  emptyMessage = 'No activity history available',
  title,
  description
}: ActivityHistorySectionProps) {
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
      <ActivityHistory activities={activities} emptyMessage={emptyMessage} />
    </div>
  );
}

