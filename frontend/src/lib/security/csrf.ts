/**
 * CSRF protection for frontend
 */

import { getCsrfToken } from './tokenSecurity';

// RequestInit is a built-in type from the DOM lib, available in TypeScript

/**
 * Get CSRF token from cookie and add to request headers
 */
export function getCsrfHeader(): Record<string, string> {
  const token = getCsrfToken();
  if (!token) {
    return {};
  }
  return {
    'x-csrf-token': token,
  };
}

/**
 * Enhanced fetch with CSRF protection
 */
export async function fetchWithCsrf(
  url: string,
  // eslint-disable-next-line no-undef
  options: RequestInit = {}
): Promise<Response> {
  const csrfHeaders = getCsrfHeader();

  // eslint-disable-next-line no-undef
  const enhancedOptions: RequestInit = {
    ...options,
    headers: {
      ...csrfHeaders,
      ...options.headers,
      'Content-Type': 'application/json',
    },
    credentials: 'include', // Include cookies for CSRF token
  };

  return fetch(url, enhancedOptions);
}
