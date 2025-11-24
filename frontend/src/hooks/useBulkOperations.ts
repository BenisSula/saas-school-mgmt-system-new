import { useState, useCallback } from 'react';
import { toast } from 'sonner';

interface UseBulkOperationsOptions {
  onDelete?: (ids: string[]) => Promise<void>;
  onSuccess?: () => void;
  confirmMessage?: (count: number) => string;
  successMessage?: (count: number) => string;
}

export function useBulkOperations(options: UseBulkOperationsOptions = {}) {
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState<boolean>(false);

  const toggleRowSelection = useCallback((id: string) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleAllSelection = useCallback((allIds: string[]) => {
    setSelectedRows((prev) => {
      if (prev.size === allIds.length) {
        return new Set();
      }
      return new Set(allIds);
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedRows(new Set());
  }, []);

  const handleBulkDelete = useCallback(async () => {
    if (selectedRows.size === 0) {
      toast.error('Please select items to delete');
      return;
    }

    const confirmMsg = options.confirmMessage
      ? options.confirmMessage(selectedRows.size)
      : `Delete ${selectedRows.size} item(s)?`;
    if (!window.confirm(confirmMsg)) {
      return;
    }

    if (!options.onDelete) {
      toast.error('Delete operation not configured');
      return;
    }

    setProcessing(true);
    try {
      await options.onDelete(Array.from(selectedRows));
      const successMsg = options.successMessage
        ? options.successMessage(selectedRows.size)
        : `${selectedRows.size} item(s) deleted`;
      toast.success(successMsg);
      setSelectedRows(new Set());
      options.onSuccess?.();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setProcessing(false);
    }
  }, [selectedRows, options]);

  return {
    selectedRows,
    processing,
    toggleRowSelection,
    toggleAllSelection,
    clearSelection,
    handleBulkDelete,
    setSelectedRows,
  };
}
