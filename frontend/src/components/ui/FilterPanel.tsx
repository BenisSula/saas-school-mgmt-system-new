/**
 * Reusable Filter Panel Component
 * Consolidates duplicate filter section patterns across pages
 */
import type { ReactNode } from 'react';
import { Card } from './Card';

export interface FilterPanelProps {
  title?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Standardized filter panel container
 * Consolidates duplicate filter wrapper patterns
 */
export function FilterPanel({
  title,
  children,
  className = ''
}: FilterPanelProps) {
  return (
    <Card padding="md" className={className}>
      {title && (
        <h2 className="mb-4 text-lg font-semibold text-[var(--brand-surface-contrast)]">
          {title}
        </h2>
      )}
      {children}
    </Card>
  );
}

export default FilterPanel;

