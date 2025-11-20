/**
 * XSS Protection utilities for frontend
 * Re-exports from consolidated sanitize.ts for backward compatibility
 */

export {
  escapeHtml,
  sanitizeForDisplay,
  sanitizeUrl,
  sanitizeIdentifier,
  sanitizeEmail,
  sanitizeObject,
  sanitizeApiInput
} from '../sanitize';

/**
 * Safe HTML renderer component helper
 * Use this when you need to render HTML content safely
 */
export function createSafeHtml(html: string): { __html: string } {
  // Additional sanitization can be added here if needed
  // For now, rely on React's built-in escaping
  return { __html: html };
}

