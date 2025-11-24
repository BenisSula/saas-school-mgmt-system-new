/**
 * API Response Utilities
 * DRY: Centralizes response unwrapping logic used across hooks
 */

/**
 * Unwraps API response, handling both wrapped and unwrapped formats
 * @param response - API response that may be wrapped in { data: ... } or direct
 * @returns Unwrapped data
 */
export function unwrapApiResponse<T>(response: T | { data?: T } | undefined): T | undefined {
  if (!response) return undefined;
  // Check if response has a 'data' property (wrapped format)
  if (typeof response === 'object' && 'data' in response && response.data !== undefined) {
    return response.data as T;
  }
  // Otherwise return as-is (unwrapped format)
  return response as T;
}
