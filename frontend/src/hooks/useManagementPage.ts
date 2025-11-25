/**
 * Shared hook for management pages (Teachers, Students, HODs)
 * Consolidates duplicate patterns across management pages
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useFilters, type BaseFilters } from './useFilters';
import { useBulkOperations } from './useBulkOperations';

interface UseManagementPageOptions<T extends BaseFilters, TData, TRecord> {
  defaultFilters: T;
  loadDataFn: () => Promise<TData[]>;
  loadAdditionalData?: () => Promise<unknown[]>;
  filterFn: (item: TRecord, filters: T) => boolean;
  deleteFn?: (id: string) => Promise<void>;
  onDataLoaded?: (data: TData[]) => TRecord[];
  onDeleteSuccess?: () => void;
}

export function useManagementPage<T extends BaseFilters, TData, TRecord extends { id: string }>(
  options: UseManagementPageOptions<T, TData, TRecord>
) {
  const {
    defaultFilters,
    loadDataFn,
    loadAdditionalData,
    filterFn,
    deleteFn,
    onDataLoaded,
    onDeleteSuccess,
  } = options;

  const [data, setData] = useState<TData[]>([]);
  const [additionalData, setAdditionalData] = useState<unknown[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [mainResult, additionalResult] = await Promise.allSettled([
        loadDataFn(),
        loadAdditionalData ? loadAdditionalData() : Promise.resolve([]),
      ]);

      if (mainResult.status === 'fulfilled') {
        setData(mainResult.value);
      } else {
        throw new Error((mainResult.reason as Error).message || 'Failed to load data');
      }

      if (additionalResult.status === 'fulfilled') {
        setAdditionalData(additionalResult.value);
      }
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [loadDataFn, loadAdditionalData]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Transform data if needed
  const records = useMemo(() => {
    if (onDataLoaded) {
      return onDataLoaded(data) as TRecord[];
    }
    return data as unknown as TRecord[];
  }, [data, onDataLoaded]);

  // Use filters hook - cast filterFn to match useFilters signature
  const { filters, filteredData, updateFilter, resetFilters, hasActiveFilters, setFilters } =
    useFilters(
      defaultFilters,
      filterFn as (item: unknown, filters: T) => boolean,
      records as unknown[]
    );

  // Use bulk operations hook
  const bulkOps = useBulkOperations({
    onDelete: deleteFn
      ? async (ids: string[]) => {
          await Promise.all(ids.map((id) => deleteFn(id)));
          await loadData();
          onDeleteSuccess?.();
        }
      : undefined,
    onSuccess: () => {
      void loadData();
    },
    confirmMessage: (count) => `Delete ${count} item(s)?`,
    successMessage: (count) => `${count} item(s) deleted successfully`,
  });

  return {
    data: records,
    filteredData,
    additionalData,
    loading,
    error,
    filters,
    updateFilter,
    resetFilters,
    hasActiveFilters,
    setFilters,
    loadData,
    ...bulkOps,
  };
}
