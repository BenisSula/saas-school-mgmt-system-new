/**
 * Search React Query hooks
 */

import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

export function useSearch(
  query: string,
  options?: { limit?: number; types?: ('student' | 'teacher' | 'class' | 'subject')[] }
) {
  return useQuery({
    queryKey: ['search', query, options],
    queryFn: () => api.search(query, options),
    enabled: query.trim().length >= 2, // Only search if query is at least 2 characters
    staleTime: 30000, // Cache for 30 seconds
  });
}
