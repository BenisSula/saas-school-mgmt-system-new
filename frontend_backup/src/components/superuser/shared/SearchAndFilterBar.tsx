import { Input } from '../../ui/Input';
import { Select } from '../../ui/Select';
import { Button } from '../../ui/Button';
import { Search, X } from 'lucide-react';

export interface SearchAndFilterBarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters?: Array<{
    label: string;
    value: string;
    options: Array<{ label: string; value: string }>;
    onChange: (value: string) => void;
  }>;
  onClearFilters?: () => void;
  className?: string;
}

export function SearchAndFilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search...',
  filters = [],
  onClearFilters,
  className = ''
}: SearchAndFilterBarProps) {
  const hasActiveFilters = searchValue || filters.some((f) => f.value && f.value !== 'all');

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="grid gap-4 sm:grid-cols-12">
        <div className="sm:col-span-12 md:col-span-6 lg:col-span-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--brand-muted)]" />
            <Input
              type="text"
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        {filters.map((filter, index) => (
          <div key={index} className="sm:col-span-6 md:col-span-3 lg:col-span-2">
            <Select
              label={filter.label}
              value={filter.value}
              onChange={(e) => filter.onChange(e.target.value)}
              options={filter.options}
            />
          </div>
        ))}
        {hasActiveFilters && onClearFilters && (
          <div className="sm:col-span-12 md:col-span-3 lg:col-span-2 flex items-end">
            <Button
              variant="outline"
              size="sm"
              onClick={onClearFilters}
              leftIcon={<X className="h-4 w-4" />}
            >
              Clear
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

