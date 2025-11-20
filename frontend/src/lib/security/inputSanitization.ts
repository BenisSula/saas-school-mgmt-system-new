/**
 * Enhanced input sanitization for frontend
 */

/**
 * Escape HTML to prevent XSS attacks
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Sanitize user input for display
 */
export function sanitizeForDisplay(input: unknown): string {
  if (input == null) {
    return '';
  }

  if (typeof input !== 'string') {
    return String(input);
  }

  // Remove null bytes
  let sanitized = input.replace(/\0/g, '');

  // Escape HTML
  sanitized = escapeHtml(sanitized);

  // Trim and limit length
  sanitized = sanitized.trim().slice(0, 10000);

  return sanitized;
}

/**
 * Sanitize URL to prevent XSS via href attributes
 */
export function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Only allow http, https, and mailto protocols
    if (!['http:', 'https:', 'mailto:'].includes(parsed.protocol)) {
      return '#';
    }
    return parsed.toString();
  } catch {
    // Invalid URL, return safe default
    return '#';
  }
}

/**
 * Sanitize identifier (for IDs, slugs, etc.)
 */
export function sanitizeIdentifier(input: string): string {
  return input.replace(/[^a-zA-Z0-9-_]/g, '').slice(0, 100);
}

/**
 * Validate and sanitize email
 */
export function sanitizeEmail(email: string): string {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const trimmed = email.trim().toLowerCase();

  if (!emailRegex.test(trimmed)) {
    throw new Error('Invalid email format');
  }

  return trimmed.slice(0, 255);
}

/**
 * Sanitize object recursively
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const sanitized = { ...obj };

  for (const key in sanitized) {
    if (typeof sanitized[key] === 'string') {
      sanitized[key] = sanitizeForDisplay(sanitized[key] as string) as T[Extract<keyof T, string>];
    } else if (
      typeof sanitized[key] === 'object' &&
      sanitized[key] !== null &&
      !Array.isArray(sanitized[key])
    ) {
      sanitized[key] = sanitizeObject(sanitized[key] as Record<string, unknown>) as T[Extract<
        keyof T,
        string
      >];
    } else if (Array.isArray(sanitized[key])) {
      sanitized[key] = (sanitized[key] as unknown[]).map((item) =>
        typeof item === 'string'
          ? sanitizeForDisplay(item)
          : typeof item === 'object' && item !== null
            ? sanitizeObject(item as Record<string, unknown>)
            : item
      ) as T[Extract<keyof T, string>];
    }
  }

  return sanitized;
}
