/**
 * Shared Error Handling Utilities
 * Centralized error message extraction to avoid duplication
 * 
 * DRY: All error handling should use these utilities
 */

/**
 * Extract error message from unknown error type
 * @param error - Error object of unknown type
 * @returns Error message string
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return String(error);
}

/**
 * Extract error message with fallback
 * @param error - Error object of unknown type
 * @param fallback - Fallback message if error cannot be extracted
 * @returns Error message string
 */
export function getErrorMessageWithFallback(error: unknown, fallback: string): string {
  const message = getErrorMessage(error);
  return message || fallback;
}

