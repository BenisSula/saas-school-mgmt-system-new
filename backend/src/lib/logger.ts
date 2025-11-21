/**
 * Centralized logging utility
 * Provides consistent logging format across the application
 */

interface LogPayload {
  [key: string]: unknown;
}

function formatPayload(payload?: LogPayload): LogPayload | undefined {
  if (!payload) {
    return undefined;
  }
  try {
    return JSON.parse(JSON.stringify(payload));
  } catch {
    return payload;
  }
}

/**
 * Format log message with optional context prefix
 */
function formatMessage(message: string, context?: string): string {
  return context ? `[${context}] ${message}` : message;
}

export const logger = {
  /**
   * Log informational message
   */
  info(payload: LogPayload | string, message?: string, context?: string) {
    if (typeof payload === 'string') {
      console.info(formatMessage(payload, message as string | undefined));
    } else {
      console.info(formatMessage(message || 'Info', context), formatPayload(payload));
    }
  },

  /**
   * Log warning message
   */
  warn(payload: LogPayload | string, message?: string, context?: string) {
    if (typeof payload === 'string') {
      console.warn(formatMessage(payload, message as string | undefined));
    } else {
      console.warn(formatMessage(message || 'Warning', context), formatPayload(payload));
    }
  },

  /**
   * Log error message
   */
  error(payload: LogPayload | string, message?: string, context?: string) {
    if (typeof payload === 'string') {
      console.error(formatMessage(payload, message as string | undefined));
    } else {
      console.error(formatMessage(message || 'Error', context), formatPayload(payload));
    }
  },

  /**
   * Log debug message (maps to info in production)
   */
  debug(payload: LogPayload | string, message?: string, context?: string) {
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true') {
      if (typeof payload === 'string') {
        console.debug(formatMessage(payload, message as string | undefined));
      } else {
        console.debug(formatMessage(message || 'Debug', context), formatPayload(payload));
      }
    }
  }
};
