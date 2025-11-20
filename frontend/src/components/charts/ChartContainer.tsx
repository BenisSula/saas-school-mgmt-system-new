/**
 * Reusable Chart Container Component
 * Consolidates duplicate wrapper div patterns around charts
 */
import type { ReactNode } from 'react';

export interface ChartContainerProps {
  children: ReactNode;
  className?: string;
  padding?: 'sm' | 'md' | 'lg';
}

/**
 * Standardized container for charts
 * Provides consistent styling and spacing
 */
export function ChartContainer({
  children,
  className = '',
  padding = 'md'
}: ChartContainerProps) {
  const paddingClasses = {
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8'
  };

  return (
    <div
      className={`rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 shadow-sm ${paddingClasses[padding]} ${className}`}
    >
      {children}
    </div>
  );
}

export default ChartContainer;

