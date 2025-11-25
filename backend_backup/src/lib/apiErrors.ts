/**
 * Standardized API error response format
 */
export interface ApiErrorResponse {
  status: 'error';
  message: string;
  field?: string;
  code?: string;
}

/**
 * Creates a standardized error response
 */
export function createErrorResponse(
  message: string,
  field?: string,
  code?: string
): ApiErrorResponse {
  return {
    status: 'error',
    message,
    ...(field ? { field } : {}),
    ...(code ? { code } : {})
  };
}

/**
 * Creates a success response wrapper (optional, for consistency)
 */
export interface ApiSuccessResponse<T> {
  status: 'success';
  data: T;
}

export function createSuccessResponse<T>(data: T): ApiSuccessResponse<T> {
  return {
    status: 'success',
    data
  };
}

