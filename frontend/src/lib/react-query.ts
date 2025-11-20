import { QueryClient } from '@tanstack/react-query';

// Create a client with default options
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes (formerly cacheTime)
      retry: (failureCount, error) => {
        // Don't retry if error is marked to suppress (expected errors)
        if ((error as Error & { suppressLog?: boolean })?.suppressLog) {
          return false;
        }
        // Retry once for unexpected errors
        return failureCount < 1;
      },
      refetchOnWindowFocus: false
    },
    mutations: {
      retry: 0
    }
  }
});
