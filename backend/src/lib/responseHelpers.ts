/**
 * Standardized API Response Helpers
 * Ensures all endpoints return consistent { success, message, data } format
 * 
 * CONSOLIDATED: This is the canonical file for error and success response helpers.
 * 
 * MERGED FROM: backend/src/lib/apiErrors.ts
 * - apiErrors.ts used 'status: error|success' format (incompatible)
 * - responseHelpers.ts uses 'success: boolean' format (canonical, used in 15+ files)
 * - apiErrors.ts ApiSuccessResponse interface was simpler than responseHelpers createPaginatedSuccessResponse
 * - DECISION: Keep responseHelpers.ts format, apiErrors.ts marked for removal
 * 
 * STATUS: ✅ COMPLETE - Canonical file ready
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

