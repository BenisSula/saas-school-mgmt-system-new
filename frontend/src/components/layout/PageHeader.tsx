/**
 * Reusable Page Header Component
 * Consolidates duplicate header patterns across pages
 */
import type { ReactNode } from 'react';

export interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/**
 * Standardized page header with title, description, and optional action button
 * Consolidates duplicate header patterns
 */
export function PageHeader({
  title,
  description,
  action,
  className = ''
}: PageHeaderProps) {
  return (
    <header className={`flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between ${className}`}>
      <div>
        <h1 className="text-2xl font-semibold text-[var(--brand-surface-contrast)]">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-[var(--brand-muted)]">{description}</p>
        )}
      </div>
      {action && <div className="sm:w-auto">{action}</div>}
    </header>
  );
}

export default PageHeader;

