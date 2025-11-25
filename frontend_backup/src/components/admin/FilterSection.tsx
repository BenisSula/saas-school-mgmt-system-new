import type { ReactNode } from 'react';
import { Button } from '../ui/Button';

interface FilterSectionProps {
  children: ReactNode;
  resultCount: number;
  totalCount: number;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}

export function FilterSection({
  children,
  resultCount,
  totalCount,
  hasActiveFilters,
  onClearFilters
}: FilterSectionProps) {
  return (
    <section
      className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-4 shadow-sm"
      aria-label="Filters"
    >
      {children}
      <div className="mt-4 flex items-center justify-between text-sm text-[var(--brand-muted)]">
        <span>
          Showing {resultCount} of {totalCount} items
        </span>
        {hasActiveFilters && (
          <Button size="sm" variant="ghost" onClick={onClearFilters}>
            Clear filters
          </Button>
        )}
      </div>
    </section>
  );
}
