import { getStatusBadgeClass, formatStatus } from '../../lib/utils/status';

export interface StatusBadgeProps {
  status: string | null | undefined;
  className?: string;
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const badgeClass = getStatusBadgeClass(status || '');
  const formattedStatus = formatStatus(status);

  return (
    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${badgeClass} ${className}`}>
      {formattedStatus}
    </span>
  );
}
