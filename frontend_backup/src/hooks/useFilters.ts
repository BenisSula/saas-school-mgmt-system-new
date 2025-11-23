import { useState, useMemo, useCallback } from 'react';

export interface BaseFilters {
  search: string;
  [key: string]: string | number | boolean | undefined;
}

export function useFilters<T extends BaseFilters>(
  defaultFilters: T,
  filterFn: (item: unknown, filters: T) => boolean,
  data: unknown[]
) {
  const [filters, setFilters] = useState<T>(defaultFilters);

  const filteredData = useMemo(() => {
    return data.filter((item) => filterFn(item, filters));
  }, [data, filters, filterFn]);

  const updateFilter = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(defaultFilters);
  }, [defaultFilters]);

  const hasActiveFilters = useMemo(() => {
    return Object.keys(filters).some((key) => {
      const value = filters[key as keyof T];
      if (key === 'search') return value !== '';
      if (typeof value === 'string') return value !== 'all' && value !== '';
      return value !== undefined && value !== null;
    });
  }, [filters]);

  return {
    filters,
    filteredData,
    updateFilter,
    resetFilters,
    hasActiveFilters,
    setFilters
  };
}
