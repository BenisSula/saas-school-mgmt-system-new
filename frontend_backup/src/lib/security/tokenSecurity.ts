/**
 * Secure token storage and handling
 */

const REFRESH_TOKEN_KEY = 'saas-school.refreshToken';
const TENANT_ID_KEY = 'saas-school.tenantId';
const CSRF_TOKEN_KEY = 'saas-school.csrfToken';

/**
 * Secure storage using sessionStorage (more secure than localStorage)
 * Tokens are cleared when browser session ends
 */
export function setSecureToken(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    // Use sessionStorage for better security (cleared on tab close)
    window.sessionStorage.setItem(key, value);
  } catch (error) {
    console.error(`[tokenSecurity] Failed to set token ${key}:`, error);
  }
}

export function getSecureToken(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage.getItem(key);
  } catch (error) {
    console.error(`[tokenSecurity] Failed to get token ${key}:`, error);
    return null;
  }
}

export function removeSecureToken(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(key);
    // Also clear from localStorage if it exists (migration)
    window.localStorage.removeItem(key);
  } catch (error) {
    console.error(`[tokenSecurity] Failed to remove token ${key}:`, error);
  }
}

/**
 * Store refresh token securely
 */
export function storeRefreshToken(token: string | null): void {
  if (token) {
    setSecureToken(REFRESH_TOKEN_KEY, token);
  } else {
    removeSecureToken(REFRESH_TOKEN_KEY);
  }
}

/**
 * Get refresh token
 */
export function getRefreshToken(): string | null {
  return getSecureToken(REFRESH_TOKEN_KEY);
}

/**
 * Store tenant ID (non-sensitive, can use localStorage)
 */
export function storeTenantId(tenantId: string | null): void {
  if (typeof window === 'undefined') return;
  if (tenantId) {
    window.localStorage.setItem(TENANT_ID_KEY, tenantId);
  } else {
    window.localStorage.removeItem(TENANT_ID_KEY);
  }
}

/**
 * Get tenant ID
 */
export function getTenantId(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TENANT_ID_KEY);
}

/**
 * CSRF token management
 */
export function getCsrfToken(): string | null {
  // CSRF token is stored in httpOnly cookie by backend
  // We need to read it from the cookie
  if (typeof document === 'undefined') return null;

  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'csrf-token') {
      return decodeURIComponent(value);
    }
  }
  return null;
}

/**
 * Clear all tokens (logout)
 */
export function clearAllTokens(): void {
  removeSecureToken(REFRESH_TOKEN_KEY);
  removeSecureToken(CSRF_TOKEN_KEY);
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(TENANT_ID_KEY);
  }
}

/**
 * Validate token format (basic check)
 */
export function isValidTokenFormat(token: string): boolean {
  if (!token || typeof token !== 'string') {
    return false;
  }

  // JWT tokens have 3 parts separated by dots
  const parts = token.split('.');
  if (parts.length !== 3) {
    return false;
  }

  // Each part should be base64url encoded
  try {
    parts.forEach((part) => {
      // Base64url characters: A-Z, a-z, 0-9, -, _
      if (!/^[A-Za-z0-9_-]+$/.test(part)) {
        throw new Error('Invalid token format');
      }
    });
    return true;
  } catch {
    return false;
  }
}
