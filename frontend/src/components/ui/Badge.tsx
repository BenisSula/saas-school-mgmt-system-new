import { memo, type ReactNode } from 'react';

export interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'outline' | 'success' | 'warning' | 'error' | 'info';
  className?: string;
}

function BadgeComponent({ children, variant = 'default', className = '' }: BadgeProps) {
  const variantClasses = {
    default:
      'bg-[var(--brand-surface-secondary)] text-[var(--brand-text-primary)] border border-[var(--brand-border)]',
    outline: 'bg-transparent text-[var(--brand-text-primary)] border border-[var(--brand-border)]',
    success: 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20',
    warning: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20',
    error: 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20',
    info: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20',
  };

  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

export const Badge = memo(BadgeComponent);
