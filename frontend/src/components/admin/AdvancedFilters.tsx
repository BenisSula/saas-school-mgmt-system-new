import { useState } from 'react';
import { X, Filter, Search } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Collapsible } from '../ui/Collapsible';

export interface AdvancedFilterField {
  key: string;
  label: string;
  type: 'text' | 'select' | 'date' | 'dateRange';
  options?: Array<{ label: string; value: string }>;
  placeholder?: string;
}

export interface AdvancedFiltersProps {
  fields: AdvancedFilterField[];
  filters: Record<string, string | undefined>;
  onFiltersChange: (filters: Record<string, string | undefined>) => void;
  onReset: () => void;
  defaultSearchKey?: string;
  searchPlaceholder?: string;
}

export function AdvancedFilters({
  fields,
  filters,
  onFiltersChange,
  onReset,
  defaultSearchKey = 'search',
  searchPlaceholder = 'Search...',
}: AdvancedFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [localFilters, setLocalFilters] = useState<Record<string, string | undefined>>(filters);

  const hasActiveFilters = Object.values(filters).some((value) => value && value !== '');

  const handleFilterChange = (key: string, value: string) => {
    const newFilters = { ...localFilters, [key]: value || undefined };
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const handleApply = () => {
    onFiltersChange(localFilters);
  };

  const handleReset = () => {
    const emptyFilters = fields.reduce((acc, field) => ({ ...acc, [field.key]: undefined }), {
      [defaultSearchKey]: undefined,
    });
    setLocalFilters(emptyFilters);
    onFiltersChange(emptyFilters);
    onReset();
  };

  const renderField = (field: AdvancedFilterField) => {
    switch (field.type) {
      case 'text':
        return (
          <Input
            key={field.key}
            label={field.label}
            value={localFilters[field.key] || ''}
            onChange={(e) => handleFilterChange(field.key, e.target.value)}
            placeholder={field.placeholder}
          />
        );
      case 'select':
        return (
          <Select
            key={field.key}
            label={field.label}
            value={localFilters[field.key] || ''}
            onChange={(e) => handleFilterChange(field.key, e.target.value)}
            options={field.options || []}
          />
        );
      case 'date':
        return (
          <div key={field.key} className="space-y-2">
            <label className="block text-sm font-semibold text-[var(--brand-surface-contrast)]">
              {field.label}
            </label>
            <input
              type="date"
              value={localFilters[field.key] || ''}
              onChange={(e) => handleFilterChange(field.key, e.target.value)}
              className="block w-full rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] px-3 py-2 text-sm text-[var(--brand-surface-contrast)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
            />
          </div>
        );
      case 'dateRange':
        return (
          <div key={field.key} className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-[var(--brand-surface-contrast)]">
                {field.label} (From)
              </label>
              <input
                type="date"
                value={localFilters[`${field.key}_from`] || ''}
                onChange={(e) => handleFilterChange(`${field.key}_from`, e.target.value)}
                className="block w-full rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] px-3 py-2 text-sm text-[var(--brand-surface-contrast)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-[var(--brand-surface-contrast)]">
                {field.label} (To)
              </label>
              <input
                type="date"
                value={localFilters[`${field.key}_to`] || ''}
                onChange={(e) => handleFilterChange(`${field.key}_to`, e.target.value)}
                className="block w-full rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] px-3 py-2 text-sm text-[var(--brand-surface-contrast)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
              />
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Quick Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--brand-muted)]" />
        <Input
          value={localFilters[defaultSearchKey] || ''}
          onChange={(e) => handleFilterChange(defaultSearchKey, e.target.value)}
          placeholder={searchPlaceholder}
          className="pl-10"
        />
      </div>

      {/* Advanced Filters Toggle */}
      <Collapsible
        isOpen={isOpen}
        onToggle={() => setIsOpen(!isOpen)}
        trigger={
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setIsOpen(!isOpen)}>
            <Filter className="h-4 w-4" />
            Advanced Filters
            {hasActiveFilters && (
              <span className="ml-1 rounded-full bg-[var(--brand-primary)] px-2 py-0.5 text-xs text-white">
                {Object.values(filters).filter((v) => v && v !== '').length}
              </span>
            )}
          </Button>
        }
      >
        <div className="mt-4 space-y-4 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)]/50 p-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {fields.map((field) => renderField(field))}
          </div>

          <div className="flex justify-end gap-2">
            {hasActiveFilters && (
              <Button variant="outline" size="sm" onClick={handleReset}>
                <X className="h-4 w-4" />
                Reset Filters
              </Button>
            )}
            <Button size="sm" onClick={handleApply}>
              Apply Filters
            </Button>
          </div>
        </div>
      </Collapsible>
    </div>
  );
}

export default AdvancedFilters;
