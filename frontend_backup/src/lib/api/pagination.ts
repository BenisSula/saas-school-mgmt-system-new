/**
 * Pagination response handling utilities
 * Consolidates pagination response parsing across API calls
 */

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    limit: number;
    offset: number;
    total?: number;
    page?: number;
    totalPages?: number;
  };
}

/**
 * Extract data from paginated response or return array directly
 * Handles both paginated and non-paginated responses for backward compatibility
 */
export function extractPaginatedData<T>(response: PaginatedResponse<T> | T[]): T[] {
  if (Array.isArray(response)) {
    return response;
  }
  if (response && typeof response === 'object' && 'data' in response) {
    return response.data;
  }
  return [];
}

/**
 * Check if response is paginated
 */
export function isPaginatedResponse<T>(response: unknown): response is PaginatedResponse<T> {
  return (
    typeof response === 'object' &&
    response !== null &&
    'data' in response &&
    'pagination' in response &&
    Array.isArray((response as PaginatedResponse<T>).data)
  );
}
