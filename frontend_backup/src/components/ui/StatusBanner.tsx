import React from 'react';

export type StatusBannerStatus = 'info' | 'success' | 'error';

export interface StatusBannerProps {
  status: StatusBannerStatus;
  message: string;
  onDismiss?: () => void;
}

const STATUS_STYLES: Record<StatusBannerStatus, string> = {
  info: 'border border-[var(--brand-border)] bg-[color:rgba(15,23,42,0.6)] text-[var(--brand-surface-contrast)]',
  success: 'border border-emerald-500 bg-emerald-500/10 text-emerald-100',
  error: 'border border-red-500 bg-red-500/10 text-red-100'
};

const StatusBannerComponent = ({ status, message, onDismiss }: StatusBannerProps) => {
  const baseClasses =
    'flex items-start justify-between gap-4 rounded-md px-4 py-3 text-sm backdrop-blur transition-colors duration-200';
  const statusClasses = STATUS_STYLES[status];

  return (
    <div role="status" aria-live="polite" className={`${baseClasses} ${statusClasses}`}>
      <span>{message}</span>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss message"
          className="rounded-md px-2 py-1 text-xs font-medium text-inherit transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
        >
          Close
        </button>
      ) : null}
    </div>
  );
};

export const StatusBanner = React.memo(StatusBannerComponent);
StatusBanner.displayName = 'StatusBanner';

export default StatusBanner;
