import { useCallback, useState } from 'react';
import { toast } from 'sonner';

interface UseDataLoaderOptions {
  onSuccess?: () => void;
  showSuccessToast?: boolean;
  successMessage?: string;
}

export function useDataLoader<T>(loadFn: () => Promise<T>, options: UseDataLoaderOptions = {}) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await loadFn();
      setData(result);
      if (options.showSuccessToast && options.successMessage) {
        toast.success(options.successMessage);
      }
      options.onSuccess?.();
      return result;
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      toast.error(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [loadFn, options]);

  return { data, loading, error, loadData, setData, setError };
}
