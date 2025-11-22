/**
 * Standardized API Response Helpers
 * Ensures all endpoints return consistent { success, message, data } format
 */

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  data?: never;
  field?: string;
  code?: string;
}

/**
 * Creates a successful API response
 */
export function createSuccessResponse<T>(
  data: T,
  message: string = 'Operation completed successfully'
): ApiResponse<T> {
  return {
    success: true,
    message,
    data
  };
}

/**
 * Creates an error API response
 */
export function createErrorResponse(
  message: string,
  field?: string,
  code?: string
): ApiErrorResponse {
  return {
    success: false,
    message,
    ...(field && { field }),
    ...(code && { code })
  };
}

/**
 * Wraps paginated response in standardized format
 */
export function createPaginatedSuccessResponse<T>(
  data: T[],
  pagination: {
    limit: number;
    offset: number;
    total?: number;
    page?: number;
    totalPages?: number;
  },
  message: string = 'Data retrieved successfully'
): ApiResponse<{
  items: T[];
  pagination: typeof pagination;
}> {
  return {
    success: true,
    message,
    data: {
      items: data,
      pagination
    }
  };
}

