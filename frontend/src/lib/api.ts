import { getCsrfHeader } from './security/csrf';
import {
  storeRefreshToken,
  getRefreshToken,
  storeTenantId,
  getTenantId,
  clearAllTokens,
  isValidTokenFormat
} from './security/tokenSecurity';
// import { sanitizeForDisplay } from './sanitize';
import { extractPaginatedData, type PaginatedResponse } from './api/pagination';

// ============================================================================
// API Base URL Resolution & Validation
// ============================================================================

/**
 * Configuration constants for API base URL resolution
 */
const API_CONFIG = {
  DEFAULT_DEV_PROXY_PATH: '/api',
  SUPPORTED_PROTOCOLS: ['http:', 'https:'] as const,
  DOCKER_SERVICE_HOSTNAMES: ['backend', 'api', 'api-server'] as const
} as const;

/**
 * Strips trailing slash from URL string
 */
function stripTrailingSlash(input: string): string {
  return input.endsWith('/') ? input.slice(0, -1) : input;
}

/**
 * Checks if a string is an absolute HTTP/HTTPS URL
 */
function isAbsoluteHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

/**
 * Trims whitespace and removes surrounding quotes from environment variable values
 */
function trimAndUnquote(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/**
 * Normalizes a URL string, ensuring it's properly formatted
 */
function normaliseBaseUrl(raw: string): string {
  try {
    const url = new URL(raw);
    return stripTrailingSlash(url.toString());
  } catch {
    // If URL parsing fails, return cleaned string
    return stripTrailingSlash(raw);
  }
}

/**
 * Gets a safe window.location.origin with fallback
 * Handles cases where window.location.origin might be invalid or unavailable
 */
function getSafeWindowOrigin(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const origin = window.location.origin;
    // Validate origin is a proper URL
    if (origin && (origin.startsWith('http://') || origin.startsWith('https://'))) {
      return origin;
    }
    // Fallback: construct from protocol, hostname, and port
    const { protocol, hostname, port } = window.location;
    if (protocol && hostname) {
      const constructed = port ? `${protocol}//${hostname}:${port}` : `${protocol}//${hostname}`;
      if (isAbsoluteHttpUrl(constructed)) {
        return constructed;
      }
    }
  } catch (error) {
    console.warn('[API] Failed to get window.location.origin:', error);
  }

  return null;
}

/**
 * Validates that an environment variable value is non-empty and properly formatted
 */
function validateEnvValue(value: string | undefined, varName: string): string | null {
  if (!value) {
    return null;
  }

  const cleaned = trimAndUnquote(value);
  if (!cleaned || cleaned.length === 0) {
    console.warn(`[API] ${varName} is empty or whitespace-only`);
    return null;
  }

  return cleaned;
}

/**
 * Detects and warns about Docker service hostnames that won't work from browser
 */
function detectDockerHostname(url: string): boolean {
  const lowerUrl = url.toLowerCase();
  return API_CONFIG.DOCKER_SERVICE_HOSTNAMES.some((hostname) =>
    lowerUrl.includes(`//${hostname}:`)
  );
}

/**
 * Resolves the API base URL from environment variables with proper validation
 * 
 * Strategy:
 * 1. Check VITE_API_BASE_URL (or VITE_API_URL for backward compatibility)
 * 2. If relative path (/api) - use as-is for Vite proxy
 * 3. If absolute URL - validate and use
 * 4. In dev mode: fallback to /api proxy path
 * 5. In production: require explicit configuration
 */
function resolveApiBaseUrl(): string {
  // Step 1: Get environment variable value
  const envValue = validateEnvValue(
    import.meta.env.VITE_API_BASE_URL ?? import.meta.env.VITE_API_URL,
    'VITE_API_BASE_URL'
  );

  // Step 2: Handle relative paths (for Vite proxy)
  if (envValue && envValue.startsWith('/')) {
    const normalized = stripTrailingSlash(envValue);
    if (import.meta.env.DEV) {
      console.log(`[API] Using relative proxy path: ${normalized}`);
    }
    return normalized;
  }

  // Step 3: Handle absolute URLs
  if (envValue) {
    // Warn about Docker service hostnames (won't work from browser)
    if (detectDockerHostname(envValue)) {
      console.warn(
        `[API] WARNING: VITE_API_BASE_URL contains Docker service hostname (${envValue}). ` +
          `This won't work from browser. Use relative path '/api' or 'http://localhost:PORT' instead.`
      );
    }

    try {
      const normalized = normaliseBaseUrl(envValue);
      if (isAbsoluteHttpUrl(normalized)) {
        if (import.meta.env.DEV) {
          console.log(`[API] Using absolute URL: ${normalized}`);
        }
        return normalized;
      }
      console.warn(`[API] Invalid absolute URL format: ${envValue}`);
    } catch (error) {
      console.error(`[API] Failed to normalize URL: ${envValue}`, error);
    }
  }

  // Step 4: Development fallback
  if (import.meta.env.DEV) {
    console.log(`[API] No VITE_API_BASE_URL set, using default dev proxy: ${API_CONFIG.DEFAULT_DEV_PROXY_PATH}`);
    return API_CONFIG.DEFAULT_DEV_PROXY_PATH;
  }

  // Step 5: Production requires explicit configuration
  const errorMsg = envValue
    ? `Invalid VITE_API_BASE_URL: "${envValue}". Must be absolute URL (http://...) or relative path (/api).`
    : 'Missing VITE_API_BASE_URL. Required in production. Set to absolute URL or relative path (/api).';
  throw new Error(errorMsg);
}

/**
 * Validates the resolved API_BASE_URL at runtime
 */
function validateResolvedBaseUrl(baseUrl: string): void {
  // Must be relative path or absolute URL
  if (!baseUrl.startsWith('/') && !isAbsoluteHttpUrl(baseUrl)) {
    const errorMsg = `Invalid API_BASE_URL format: "${baseUrl}". Expected absolute URL (http://...) or relative path (/api).`;
    console.error(`[API] ${errorMsg}`);
    throw new Error(errorMsg);
  }

  // Additional validation for absolute URLs
  if (isAbsoluteHttpUrl(baseUrl)) {
    try {
      const url = new URL(baseUrl);
      if (!API_CONFIG.SUPPORTED_PROTOCOLS.includes(url.protocol as any)) {
        throw new Error(`Unsupported protocol: ${url.protocol}. Only http: and https: are supported.`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[API] Invalid absolute URL: ${baseUrl}`, errorMsg);
      throw new Error(`Invalid API_BASE_URL: ${errorMsg}`);
    }
  }
}

// Resolve and validate API base URL
let API_BASE_URL: string;
try {
  API_BASE_URL = resolveApiBaseUrl();
  validateResolvedBaseUrl(API_BASE_URL);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error('[API] CRITICAL: API_BASE_URL resolution failed:', message);
  throw error;
}

// Development logging
if (import.meta.env.DEV) {
  console.group('[API] Configuration');
  console.log('API_BASE_URL:', API_BASE_URL);
  const windowOrigin = getSafeWindowOrigin();
  if (windowOrigin) {
    console.log('Window Origin:', windowOrigin);
  } else {
    console.warn('Window Origin: Unable to determine (may be SSR context)');
  }
  if (typeof window !== 'undefined') {
    console.log('Window Href:', window.location.href);
  }
  console.groupEnd();
}

/**
 * Safely joins a path with the API base URL, guaranteeing a valid absolute URL when needed
 * 
 * @param path - API endpoint path (e.g., '/auth/login')
 * @param base - Base URL (relative '/api' or absolute 'http://...')
 * @returns Resolved URL string
 * @throws Error if URL construction fails
 */
function safeJoinUrl(path: string, base: string): string {
  // Validate inputs
  if (!path || typeof path !== 'string') {
    throw new Error(`Invalid path: ${String(path)}. Expected non-empty string.`);
  }
  if (!base || typeof base !== 'string') {
    throw new Error(`Invalid API_BASE_URL: ${String(base)}. Expected non-empty string.`);
  }

  // If path is already absolute, use it as-is (shouldn't happen in normal flow)
  if (isAbsoluteHttpUrl(path)) {
    console.warn(`[API] Path is already absolute: ${path}. Using as-is.`);
    return path;
  }

  // Normalize path: ensure it starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  // Case 1: Base is relative path (e.g., '/api') - use for Vite proxy
  if (base.startsWith('/')) {
    // Combine relative paths: /api + /auth/login = /api/auth/login
    const combined = `${base}${normalizedPath}`;
    // Validate no double slashes (except after protocol)
    return combined.replace(/([^:]\/)\/+/g, '$1');
  }

  // Case 2: Base is absolute URL - construct absolute URL
  if (isAbsoluteHttpUrl(base)) {
    try {
      // Parse base URL to ensure it's valid
      const baseUrl = new URL(base);
      
      // Ensure path starts with / for proper resolution
      const resolvedUrl = new URL(normalizedPath, baseUrl);
      
      // Return as string, stripping trailing slash if present
      return stripTrailingSlash(resolvedUrl.toString());
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const windowOrigin = getSafeWindowOrigin();
      throw new Error(
        `Failed to construct absolute URL with base "${base}" and path "${path}": ${errorMsg}. ` +
          `Window origin: ${windowOrigin || 'N/A'}. ` +
          `Please check VITE_API_BASE_URL configuration.`
      );
    }
  }

  // Case 3: Invalid base format
  throw new Error(
    `Invalid API_BASE_URL format: "${base}". ` +
      `Expected absolute URL (http://...) or relative path starting with / (e.g., /api).`
  );
}
// Keys are kept in tokenSecurity; avoid unused local duplicates
// const REFRESH_STORAGE_KEY = 'saas-school.refreshToken';
// const TENANT_STORAGE_KEY = 'saas-school.tenantId';

let accessToken: string | null = null;
let refreshToken: string | null = null;
let tenantId: string | null = null;
let refreshTimeout: ReturnType<typeof setTimeout> | null = null;

type UnauthorizedHandler = () => void;
type RefreshHandler = (auth: AuthResponse) => void;

let onUnauthorized: UnauthorizedHandler | null = null;
let onRefresh: RefreshHandler | null = null;

export type Role = 'student' | 'teacher' | 'hod' | 'admin' | 'superadmin';
export type UserStatus = 'pending' | 'active' | 'suspended' | 'rejected';

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  tenantId: string | null;
  isVerified: boolean;
  status: UserStatus;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  user: AuthUser;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  role: Role;
  tenantId?: string;
  tenantName?: string;
  profile?: {
    // Common fields
    fullName?: string;
    gender?: 'male' | 'female' | 'other';
    address?: string;
    // Student-specific fields
    dateOfBirth?: string;
    parentGuardianName?: string;
    parentGuardianContact?: string;
    studentId?: string;
    classId?: string;
    // Teacher-specific fields
    phone?: string;
    qualifications?: string;
    yearsOfExperience?: number;
    subjects?: string[];
    teacherId?: string;
  };
}

type FetchOptions = Omit<globalThis.RequestInit, 'headers'> & {
  headers?: Record<string, string>;
  responseType?: 'json' | 'blob';
};

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
 * Extracts error information from API response
 * Returns both message and structured error data
 */
async function extractError(
  response: Response
): Promise<{ message: string; error?: ApiErrorResponse }> {
  try {
    const payload = await response.json();

    // Check for standardized error format
    if (payload?.status === 'error' && typeof payload?.message === 'string') {
      return {
        message: payload.message,
        error: payload as ApiErrorResponse
      };
    }

    // Fallback to legacy format
    if (typeof payload?.message === 'string') {
      return { message: payload.message };
    }
    if (typeof payload?.error === 'string') {
      return { message: payload.error };
    }

    // In dev mode, include more details if available
    if (import.meta.env.DEV && payload?.stack) {
      console.error('[api] Error response:', payload);
    }
  } catch {
    // If JSON parsing fails, try to get text
    try {
      const text = await response.text();
      if (text) {
        return { message: text };
      }
    } catch {
      // ignore
    }
  }
  // For 404 responses, provide a more helpful error message
  if (response.status === 404) {
    return { message: `Resource not found: ${response.url || 'Unknown endpoint'}` };
  }
  return { message: response.statusText || 'Request failed' };
}

export function setAuthHandlers(handlers: {
  onUnauthorized?: UnauthorizedHandler | null;
  onRefresh?: RefreshHandler | null;
}) {
  onUnauthorized = handlers.onUnauthorized ?? null;
  onRefresh = handlers.onRefresh ?? null;
}

function persistSession(tokens: { refresh: string | null; tenant: string | null }) {
  if (typeof window === 'undefined') return;

  // Use secure token storage for refresh token
  if (tokens.refresh) {
    if (isValidTokenFormat(tokens.refresh)) {
      storeRefreshToken(tokens.refresh);
    } else {
      console.warn('[api] Invalid refresh token format, not storing');
    }
  } else {
    storeRefreshToken(null);
  }

  // Tenant ID is non-sensitive, can use localStorage
  if (tokens.tenant) {
    storeTenantId(tokens.tenant);
  } else {
    storeTenantId(null);
  }
}

const TENANT_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

function isValidTenantId(id: string | null | undefined): id is string {
  return Boolean(id && id.trim() !== '' && TENANT_ID_PATTERN.test(id));
}

function parseDuration(input: string): number {
  if (!input) return 0;
  const numeric = Number(input);
  if (!Number.isNaN(numeric)) {
    return numeric;
  }
  const match = input.match(/^(\d+)([smhd])$/);
  if (!match) {
    return 0;
  }
  const value = Number(match[1]);
  const unit = match[2];
  switch (unit) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      return 0;
  }
}

function clearRefreshTimer() {
  if (refreshTimeout) {
    clearTimeout(refreshTimeout);
    refreshTimeout = null;
  }
}

function scheduleTokenRefresh(expiresIn: string) {
  clearRefreshTimer();
  const duration = parseDuration(expiresIn);
  if (!duration || duration < 0) {
    return;
  }
  const refreshDelay = Math.max(duration - 60_000, duration * 0.75);
  refreshTimeout = setTimeout(() => {
    authApi.refresh().catch(() => {
      /* errors handled in refresh */
    });
  }, refreshDelay);
}

export function initialiseSession(auth: AuthResponse, persist: boolean = true) {
  accessToken = auth.accessToken;
  refreshToken = auth.refreshToken;
  const resolvedTenant = auth.user.tenantId;
  tenantId = resolvedTenant && isValidTenantId(resolvedTenant) ? resolvedTenant : null;
  if (persist) {
    persistSession({ refresh: refreshToken, tenant: tenantId });
  }
  scheduleTokenRefresh(auth.expiresIn);
}

export function clearSession() {
  accessToken = null;
  refreshToken = null;
  tenantId = null;
  clearRefreshTimer();
  persistSession({ refresh: null, tenant: null });
  clearAllTokens(); // Clear all secure tokens
}

export function hydrateFromStorage(): { refreshToken: string | null; tenantId: string | null } {
  if (typeof window === 'undefined') {
    return { refreshToken: null, tenantId: null };
  }

  // Get refresh token from secure storage
  const storedRefresh = getRefreshToken();
  refreshToken = storedRefresh;

  // Get tenant ID from localStorage (non-sensitive)
  const storedTenant = getTenantId();
  const safeTenant = storedTenant && isValidTenantId(storedTenant) ? storedTenant : null;
  tenantId = safeTenant;

  if (storedTenant && !isValidTenantId(storedTenant)) {
    storeTenantId(null);
  }

  return { refreshToken: storedRefresh, tenantId: safeTenant };
}

export function setTenant(nextTenant: string | null) {
  if (nextTenant && !isValidTenantId(nextTenant)) {
    throw new Error('Invalid tenant identifier');
  }
  tenantId = nextTenant;
  persistSession({ refresh: refreshToken, tenant: tenantId });
}

async function performRefresh(): Promise<AuthResponse | null> {
  if (!refreshToken) {
    return null;
  }
  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(tenantId ? { 'x-tenant-id': tenantId } : {})
      },
      body: JSON.stringify({ refreshToken })
    });

    if (!response.ok) {
      const message = await extractError(response);
      console.warn('[api] refresh token failed', message);
      clearSession();
      onUnauthorized?.();
      return null;
    }

    const auth = (await response.json()) as AuthResponse;
    initialiseSession(auth);
    onRefresh?.(auth);
    scheduleTokenRefresh(auth.expiresIn);
    return auth;
  } catch (error) {
    console.error('[api] refresh token error', (error as Error).message);
    clearSession();
    onUnauthorized?.();
    return null;
  }
}

async function apiFetch<T>(path: string, options: FetchOptions = {}, retry = true): Promise<T> {
  const { responseType = 'json', ...rest } = options;
  const headers: Record<string, string> = {
    ...(tenantId ? { 'x-tenant-id': tenantId } : {}),
    ...(rest.body ? { 'Content-Type': 'application/json' } : {}),
    ...getCsrfHeader(), // Add CSRF token to all requests
    ...rest.headers
  };

  if (accessToken && !headers.Authorization) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  // Validate API_BASE_URL before attempting to use it
  if (!API_BASE_URL || typeof API_BASE_URL !== 'string') {
    const errorMsg = `API_BASE_URL is invalid: ${String(API_BASE_URL)}. Please check your environment configuration.`;
    console.error('[apiFetch]', errorMsg);
    throw new Error(errorMsg);
  }

  // Allow relative paths (for Vite proxy) or absolute URLs
  if (!API_BASE_URL.startsWith('/') && !isAbsoluteHttpUrl(API_BASE_URL)) {
    const errorMsg = `API_BASE_URL is invalid: "${API_BASE_URL}". Expected http:// or https:// URL, or relative path like /api.`;
    console.error('[apiFetch]', errorMsg);
    console.error(
      '[apiFetch] Current window.location:',
      typeof window !== 'undefined' ? window.location.href : 'N/A'
    );
    throw new Error(errorMsg);
  }

  // Build request URL with validation
  let requestUrl: string;
  try {
    requestUrl = safeJoinUrl(path, API_BASE_URL);
  } catch (urlError) {
    const errorMsg = urlError instanceof Error ? urlError.message : String(urlError);
    const windowOrigin = getSafeWindowOrigin();
    console.error('[apiFetch] URL construction failed:', {
      path,
      API_BASE_URL,
      error: errorMsg,
      windowOrigin: windowOrigin || 'N/A',
      windowHref: typeof window !== 'undefined' ? window.location.href : 'N/A'
    });
    throw new Error(`Failed to construct API URL: ${errorMsg}`);
  }

  // Auto-recovery handler for network failures
  const attemptFetch = async (url: string, attemptNumber: number = 1): Promise<Response> => {
    try {
      const response = await fetch(url, {
        ...rest,
        headers,
        credentials: 'include' // Include cookies for CSRF token
      });
      return response;
    } catch (fetchError) {
      const errorMsg = fetchError instanceof Error ? fetchError.message : String(fetchError);
      const isNetworkError =
        errorMsg.includes('Failed to fetch') ||
        errorMsg.includes('NetworkError') ||
        errorMsg.includes('ERR_') ||
        errorMsg.includes('ERR_NAME_NOT_RESOLVED') ||
        errorMsg.includes('ERR_CONNECTION_REFUSED') ||
        errorMsg.includes('ERR_NETWORK_CHANGED');

      // Log network errors for debugging
      if (isNetworkError && import.meta.env.DEV) {
        console.warn(`[apiFetch] Network error (attempt ${attemptNumber}):`, {
          url,
          error: errorMsg,
          API_BASE_URL,
          suggestion: 'Check if backend server is running and accessible'
        });
      }

      // Auto-recovery: If using Docker hostname and first attempt fails, try localhost
      if (attemptNumber === 1 && isNetworkError && detectDockerHostname(url)) {
        const localhostUrl = url.replace(/\/\/backend:/g, '//127.0.0.1:');
        if (localhostUrl !== url) {
          console.warn(
            `[apiFetch] Retrying with localhost fallback: ${localhostUrl} (original: ${url})`
          );
          return attemptFetch(localhostUrl, 2);
        }
      }

      // Throw user-friendly error
      if (isNetworkError) {
        const suggestion = import.meta.env.DEV
          ? `Ensure backend is running on ${API_BASE_URL.startsWith('/') ? 'port configured in Vite proxy' : API_BASE_URL}`
          : 'Check network connection and server status';
        throw new Error(
          `Unable to connect to API server at ${API_BASE_URL}. ${suggestion}. ` +
            `Original error: ${errorMsg}`
        );
      }

      // Re-throw non-network errors
      throw fetchError;
    }
  };

  // Execute fetch with auto-recovery
  let response: Response;
  try {
    response = await attemptFetch(requestUrl);
  } catch (error) {
    // Final error handling - log and re-throw
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[apiFetch] Request failed after retries:', {
      path,
      requestUrl,
      API_BASE_URL,
      error: errorMsg
    });
    throw error;
  }

  if (response.status === 401 && retry && refreshToken) {
    const refreshed = await performRefresh();
    if (refreshed?.accessToken) {
      return apiFetch<T>(path, options, false);
    }
  }

  if (!response.ok) {
    const errorInfo = await extractError(response);
    const error = new Error(errorInfo.message) as Error & { apiError?: ApiErrorResponse; suppressLog?: boolean };
    // Attach structured error data for field-level error handling
    if (errorInfo.error) {
      error.apiError = errorInfo.error;
    }
    
    // Mark expected errors to suppress logging
    // These are handled gracefully by components
    const isPublicEndpoint = path.includes('/configuration/branding') || 
                             path.includes('/schools/top');
    const isListEndpoint = (path === '/teachers' || path === '/students');
    const isExpectedError = 
      (response.status === 401 && isPublicEndpoint) || // Public endpoints that require auth
      (response.status === 500 && isPublicEndpoint) || // Server errors on public endpoints
      (response.status === 400 && isListEndpoint); // Validation errors on list endpoints (should be fixed by backend)
    
    if (isExpectedError) {
      // Mark error to suppress React Query logging
      error.suppressLog = true;
    } else if (response.status === 401 && !isPublicEndpoint && import.meta.env.DEV) {
      // Log warnings for unexpected 401s only in dev
      console.warn(`[API] Authentication required for ${path}`);
    } else if (response.status === 400 && import.meta.env.DEV && !isListEndpoint) {
      // Log 400 errors in dev for debugging (except list endpoints which are expected)
      console.warn(`[API] Bad request: ${path}`, errorInfo);
    }
    
    throw error;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  if (responseType === 'blob') {
    return (await response.blob()) as T;
  }

  return (await response.json()) as T;
}

// ------------------------
// Configuration Endpoints
// ------------------------

export interface BrandingConfig {
  logo_url?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  theme_flags?: Record<string, boolean> | null;
  typography?: Record<string, unknown> | null;
  navigation?: Record<string, unknown> | null;
}

export interface AcademicTerm {
  id: string;
  name: string;
  starts_on: string;
  ends_on: string;
}

export interface SchoolClass {
  id: string;
  name: string;
  description?: string | null;
}

export interface AttendanceAggregate {
  attendance_date: string;
  class_id: string | null;
  status: string;
  count: number;
}

export interface GradeAggregate {
  subject: string;
  grade: string;
  count: number;
  average_score: number;
}

export interface FeeAggregate {
  status: string;
  invoice_count: number;
  total_amount: number;
  total_paid: number;
}

export interface TenantUser {
  id: string;
  email: string;
  role: Role;
  is_verified: boolean;
  created_at: string;
  status?: UserStatus;
  additional_roles?: Array<{ role: string; metadata?: Record<string, unknown> }>;
  pending_profile_data?: Record<string, unknown> | null; // Profile data for pending users (available for admin review)
}

export interface AttendanceHistoryItem {
  id: string;
  student_id: string;
  class_id: string | null;
  status: 'present' | 'absent' | 'late';
  attendance_date: string;
  marked_by: string;
  recorded_at: string;
}

export interface AttendanceSummary {
  present: number;
  total: number;
  percentage: number;
}

export interface AttendanceHistoryResponse {
  history: AttendanceHistoryItem[];
  summary: AttendanceSummary;
}

export interface AttendanceMark {
  studentId: string;
  classId?: string;
  status: 'present' | 'absent' | 'late';
  markedBy: string;
  date: string;
  metadata?: Record<string, unknown>;
}

export interface ClassAttendanceSnapshot {
  status: 'present' | 'absent' | 'late';
  count: number;
}

export interface GradeEntryInput {
  studentId: string;
  subject: string;
  score: number;
  remarks?: string;
  classId?: string;
}

export interface StudentResult {
  student_id: string;
  exam_id: string;
  overall_score: number;
  grade: string;
  remarks?: string | null;
  breakdown: Array<{
    subject: string;
    score: number;
    grade: string;
  }>;
}

export interface Invoice {
  id: string;
  student_id: string;
  due_date: string;
  total_amount: number;
  amount_paid: number;
  status: string;
  description?: string | null;
  currency?: string | null;
  created_at?: string;
  items?: Array<{ description: string; amount: number }>;
  payments?: Array<{ amount: number; status: string; received_at: string }>;
  student_name?: string;
  admission_number?: string;
}

export interface ExamSummary {
  id: string;
  name: string;
  description?: string | null;
  examDate?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  classes: number;
  sessions: number;
}

export interface GradeScale {
  min_score: number;
  max_score: number;
  grade: string;
  remark: string | null;
}

export interface TeacherProfile {
  id: string;
  name: string;
  email: string;
  subjects: string[];
  assigned_classes: string[];
  qualifications?: string;
  yearsOfExperience?: number;
  created_at?: string;
  updated_at?: string;
}

// Backend returns snake_case with JSON strings, transform to frontend format
function transformTeacher(backendTeacher: {
  id: string;
  name: string;
  email: string;
  subjects: string | string[];
  assigned_classes: string | string[];
  qualifications?: string | null;
  years_of_experience?: number | null;
  created_at?: string;
  updated_at?: string;
}): TeacherProfile {
  return {
    id: backendTeacher.id,
    name: backendTeacher.name,
    email: backendTeacher.email,
    subjects: Array.isArray(backendTeacher.subjects)
      ? backendTeacher.subjects
      : typeof backendTeacher.subjects === 'string'
        ? JSON.parse(backendTeacher.subjects || '[]')
        : [],
    assigned_classes: Array.isArray(backendTeacher.assigned_classes)
      ? backendTeacher.assigned_classes
      : typeof backendTeacher.assigned_classes === 'string'
        ? JSON.parse(backendTeacher.assigned_classes || '[]')
        : [],
    qualifications: backendTeacher.qualifications ?? undefined,
    yearsOfExperience: backendTeacher.years_of_experience ?? undefined,
    created_at: backendTeacher.created_at,
    updated_at: backendTeacher.updated_at
  };
}

export interface StudentRecord {
  id: string;
  first_name: string;
  last_name: string;
  class_id: string | null;
  class_uuid?: string | null;
  admission_number: string | null;
  date_of_birth?: string | null;
  enrollment_date?: string | null;
  parent_contacts?: Array<{ name: string; relationship: string; phone: string }> | string | null;
  created_at?: string;
  updated_at?: string;
}

// Backend returns snake_case with JSON strings, transform to frontend format
function transformStudent(backendStudent: {
  id: string;
  first_name: string;
  last_name: string;
  class_id: string | null;
  class_uuid?: string | null;
  admission_number: string | null;
  date_of_birth?: string | null;
  enrollment_date?: string | null;
  parent_contacts?: string | Array<{ name: string; relationship: string; phone: string }> | null;
  created_at?: string;
  updated_at?: string;
}): StudentRecord {
  let parentContacts: Array<{ name: string; relationship: string; phone: string }> | null = null;
  if (backendStudent.parent_contacts) {
    if (Array.isArray(backendStudent.parent_contacts)) {
      parentContacts = backendStudent.parent_contacts;
    } else if (typeof backendStudent.parent_contacts === 'string') {
      try {
        parentContacts = JSON.parse(backendStudent.parent_contacts || '[]');
      } catch {
        parentContacts = [];
      }
    }
  }

  return {
    id: backendStudent.id,
    first_name: backendStudent.first_name,
    last_name: backendStudent.last_name,
    class_id: backendStudent.class_id,
    class_uuid: backendStudent.class_uuid,
    admission_number: backendStudent.admission_number,
    date_of_birth: backendStudent.date_of_birth,
    enrollment_date: backendStudent.enrollment_date,
    parent_contacts: parentContacts,
    created_at: backendStudent.created_at,
    updated_at: backendStudent.updated_at
  };
}

export interface Subject {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
}

export interface ClassSubject {
  class_id: string;
  subject_id: string;
  name: string;
  code: string | null;
}

export interface AdminTeacherAssignment {
  id: string;
  teacher_id: string;
  teacher_name: string;
  class_id: string;
  class_name: string;
  subject_id: string;
  subject_name: string;
  is_class_teacher: boolean;
  metadata?: Record<string, unknown>;
}

export interface TeacherAssignmentSummary {
  assignmentId: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string | null;
  isClassTeacher: boolean;
  metadata: Record<string, unknown>;
}

export interface StudentSubject {
  student_id: string;
  subject_id: string;
  name: string;
  code: string | null;
}

export interface TermReportRequest {
  studentId: string;
  termId: string;
  includeBreakdown?: boolean;
}

export interface SubjectPayload {
  name: string;
  code?: string | null;
  description?: string | null;
}

export interface PromoteStudentPayload {
  toClassId: string;
  notes?: string;
}

export interface TeacherOverview {
  teacher: {
    id: string;
    name: string;
    email: string | null;
  };
  summary: {
    totalClasses: number;
    totalSubjects: number;
    classTeacherRoles: number;
    pendingDropRequests: number;
  };
  assignments: TeacherAssignmentSummary[];
}

export interface TeacherClassSummary {
  id: string;
  name: string;
  isClassTeacher: boolean;
  subjects: Array<{
    id: string;
    name: string;
    code: string | null;
    assignmentId: string;
  }>;
}

export interface TeacherClassRosterEntry {
  id: string;
  first_name: string;
  last_name: string;
  admission_number: string | null;
  parent_contacts: unknown[];
  class_id: string | null;
}

export interface TeacherClassReport {
  class: {
    id: string;
    name: string;
  };
  studentCount: number;
  attendance: {
    present: number;
    absent: number;
    late: number;
    total: number;
    percentage: number;
  };
  grades: Array<{
    subject: string;
    entries: number;
    average: number;
  }>;
  fees: {
    billed: number;
    paid: number;
    outstanding: number;
  };
  generatedAt: string;
}

export interface TeacherMessage {
  id: string;
  title: string;
  body: string;
  classId: string | null;
  className: string | null;
  timestamp: string;
  status: string;
}

export interface TeacherProfileDetail {
  id: string;
  name: string;
  email: string | null;
  subjects: string[];
  classes: Array<{
    id: string;
    name: string;
    subjects: string[];
    isClassTeacher: boolean;
  }>;
}

export interface StudentSubjectSummary {
  subjectId: string;
  name: string;
  code: string | null;
  dropRequested: boolean;
  dropStatus: 'pending' | 'approved' | 'rejected' | 'none';
  dropRequestedAt: string | null;
}

export interface StudentExamSummary {
  examId: string;
  name: string;
  examDate: string | null;
  averageScore: number | null;
  subjectCount: number;
}

export interface StudentProfileDetail {
  id: string;
  firstName: string;
  lastName: string;
  classId: string | null;
  className: string | null;
  admissionNumber: string | null;
  parentContacts: unknown[];
  subjects: StudentSubjectSummary[];
}

export interface StudentMessage {
  id: string;
  title: string;
  body: string;
  className: string | null;
  status: 'unread' | 'read' | 'info';
  sentAt: string;
}

export interface StudentTermSummary {
  id: string;
  name: string;
  startsOn: string | null;
  endsOn: string | null;
}

export interface StudentTermReportRecord {
  id: string;
  termId: string | null;
  generatedAt: string;
  summary: unknown;
}

export interface TopSchool {
  id: string;
  name: string;
  logo_url: string | null;
  metric_label: string | null;
  metric_value: number | null;
  case_study_url?: string | null;
}

export type SubscriptionTier = 'free' | 'trial' | 'paid';
export type TenantLifecycleStatus = 'active' | 'suspended' | 'deleted';

export interface PlatformOverview {
  totals: {
    schools: number;
    activeSchools: number;
    suspendedSchools: number;
    users: number;
    pendingUsers: number;
  };
  roleDistribution: {
    admins: number;
    superadmins: number;
    hods: number;
    teachers: number;
    students: number;
  };
  subscriptionBreakdown: Record<SubscriptionTier, number>;
  revenue: {
    total: number;
    byTenant: Array<{ tenantId: string; amount: number }>;
  };
  recentSchools: Array<{
    id: string;
    name: string;
    status: TenantLifecycleStatus;
    subscriptionType: SubscriptionTier;
    createdAt: string;
  }>;
}

export interface PlatformSchool {
  id: string;
  name: string;
  schoolId: string | null;
  address: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  registrationCode: string | null;
  domain: string | null;
  schemaName: string;
  status: TenantLifecycleStatus;
  subscriptionType: SubscriptionTier;
  billingEmail: string | null;
  createdAt: string;
  userCount: number;
}

export interface PlatformUserSummary {
  id: string;
  email: string;
  username: string | null;
  fullName: string | null;
  role: Role;
  tenantId: string | null;
  tenantName: string | null;
  schoolId: string | null;
  schoolName: string | null;
  registrationCode: string | null;
  isVerified: boolean;
  status: UserStatus | null;
  auditLogEnabled: boolean;
  isTeachingStaff: boolean;
  createdAt: string;
  gender: string | null;
  dateOfBirth: string | null;
  enrollmentDate: string | null;
  metadata: Record<string, unknown> | null;
}

export interface CreateSchoolPayload {
  name: string;
  address: string;
  contactPhone: string;
  contactEmail: string;
  registrationCode: string;
  domain?: string | null;
  subscriptionType?: SubscriptionTier;
  billingEmail?: string | null;
}

export type UpdateSchoolPayload = Partial<
  Pick<
    CreateSchoolPayload,
    | 'name'
    | 'address'
    | 'contactPhone'
    | 'contactEmail'
    | 'registrationCode'
    | 'domain'
    | 'subscriptionType'
    | 'billingEmail'
  >
> & { status?: TenantLifecycleStatus };

export interface CreateSchoolAdminPayload {
  email: string;
  password: string;
  username: string;
  fullName: string;
  phone?: string | null;
}

function buildQuery(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, value);
    }
  });
  const queryString = search.toString();
  return queryString ? `?${queryString}` : '';
}

export const authApi = {
  async login(payload: LoginPayload): Promise<AuthResponse> {
    const response = await apiFetch<AuthResponse>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify(payload)
      },
      false
    );
    // Don't initialize session here - let AuthContext handle it after status check
    // This prevents double initialization and allows proper status validation
    return response;
  },
  async register(payload: RegisterPayload): Promise<AuthResponse> {
    const response = await apiFetch<AuthResponse>(
      '/auth/signup',
      {
        method: 'POST',
        body: JSON.stringify(payload)
      },
      false
    );
    // Don't initialize session here - let AuthContext handle it after status check
    // This prevents double initialization and allows proper status validation
    return response;
  },
  async refresh(): Promise<AuthResponse | null> {
    return performRefresh();
  }
};

export interface TenantLookupResult {
  id: string;
  name: string;
  domain: string | null;
  registrationCode: string | null;
}

export interface TenantLookupResponse {
  results?: TenantLookupResult[];
  count?: number;
  id?: string;
  name?: string;
  domain?: string | null;
  registrationCode?: string | null;
}

export const api = {
  // Public tenant lookup for registration
  lookupTenant: (params: { code?: string; name?: string; domain?: string }) => {
    const queryParams = new URLSearchParams();
    if (params.code) queryParams.append('code', params.code);
    if (params.name) queryParams.append('name', params.name);
    if (params.domain) queryParams.append('domain', params.domain);
    return apiFetch<TenantLookupResult | TenantLookupResponse>(
      `/auth/lookup-tenant?${queryParams.toString()}`,
      {},
      false // Don't retry on lookup failures
    );
  },
  // List schools for dropdown/autocomplete
  listSchools: (params?: { recent?: boolean; limit?: number; offset?: number }) => {
    const queryParams = new URLSearchParams();
    if (params?.recent !== undefined) queryParams.append('recent', String(params.recent));
    if (params?.limit) queryParams.append('limit', String(params.limit));
    if (params?.offset) queryParams.append('offset', String(params.offset));
    return apiFetch<{
      schools: TenantLookupResult[];
      count: number;
      total?: number;
      type: 'recent' | 'all';
    }>(
      `/auth/list-schools?${queryParams.toString()}`,
      {},
      false // Don't retry on lookup failures
    );
  },
  // Tenant Status
  getTenantStatus: (tenantId: string) =>
    apiFetch<{
      status: 'pending' | 'preparing' | 'ready' | 'failed';
      error?: string;
      startedAt?: string;
      completedAt?: string;
    }>(`/tenant-status/${tenantId}`, {}, false), // Don't retry on status checks

  // Configuration
  getBranding: () => apiFetch<BrandingConfig | null>('/configuration/branding'),
  updateBranding: (payload: Partial<BrandingConfig>) =>
    apiFetch<BrandingConfig>('/configuration/branding', {
      method: 'PUT',
      body: JSON.stringify(payload)
    }),
  listTerms: () => apiFetch<AcademicTerm[]>('/configuration/terms'),
  createTerm: (payload: { name: string; startsOn: string; endsOn: string }) =>
    apiFetch<AcademicTerm>('/configuration/terms', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  updateTerm: (id: string, payload: { name: string; startsOn: string; endsOn: string }) =>
    apiFetch<AcademicTerm>(`/configuration/terms/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    }),
  deleteTerm: (id: string) =>
    apiFetch<void>(`/configuration/terms/${id}`, {
      method: 'DELETE'
    }),
  listClasses: () => apiFetch<SchoolClass[]>('/configuration/classes'),
  createClass: (payload: { name: string; description?: string }) =>
    apiFetch<SchoolClass>('/configuration/classes', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  updateClass: (id: string, payload: { name: string; description?: string }) =>
    apiFetch<SchoolClass>(`/configuration/classes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    }),
  deleteClass: (id: string) =>
    apiFetch<void>(`/configuration/classes/${id}`, {
      method: 'DELETE'
    }),

  // Reports & summaries
  getAttendanceReport: (params: { from?: string; to?: string; classId?: string }) =>
    apiFetch<AttendanceAggregate[]>(
      `/reports/attendance${buildQuery({
        from: params.from,
        to: params.to,
        class_id: params.classId
      })}`
    ),
  getAttendanceAggregate: (filters?: { from?: string; to?: string; classId?: string }) =>
    apiFetch<AttendanceAggregate[]>(
      `/reports/attendance${buildQuery({
        from: filters?.from,
        to: filters?.to,
        class_id: filters?.classId
      })}`
    ),
  getGradeReport: (examId: string) =>
    apiFetch<GradeAggregate[]>(`/reports/grades${buildQuery({ exam_id: examId })}`),
  getFeeReport: (status?: string) =>
    apiFetch<FeeAggregate[]>(`/reports/fees${buildQuery({ status })}`),

  // Attendance
  getStudentAttendance: (studentId: string, filters?: { from?: string; to?: string }) =>
    apiFetch<AttendanceHistoryResponse>(
      `/attendance/${studentId}${buildQuery({ from: filters?.from, to: filters?.to })}`
    ),
  markAttendance: (records: AttendanceMark[]) =>
    apiFetch<void>('/attendance/mark', {
      method: 'POST',
      body: JSON.stringify({ records })
    }),
  getClassAttendanceSnapshot: (classId: string, date: string) =>
    apiFetch<ClassAttendanceSnapshot[]>(
      `/attendance/report/class${buildQuery({ class_id: classId, date })}`
    ),

  // Grades & exams
  listExams: () => apiFetch<ExamSummary[]>('/exams'),
  getGradeScales: () => apiFetch<GradeScale[]>('/exams/grade-scales'),
  createExam: (payload: { name: string; description?: string; examDate?: string }) =>
    apiFetch<ExamSummary>('/exams', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  deleteExam: (examId: string) =>
    apiFetch<void>(`/exams/${examId}`, {
      method: 'DELETE'
    }),
  bulkUpsertGrades: (examId: string, entries: GradeEntryInput[]) =>
    apiFetch<{ saved: number }>('/grades/bulk', {
      method: 'POST',
      body: JSON.stringify({ examId, entries })
    }),
  getStudentResult: (studentId: string, examId: string) =>
    apiFetch<StudentResult>(`/results/${studentId}${buildQuery({ exam_id: examId })}`),

  // Invoices
  listInvoices: (filters?: { studentId?: string; status?: string }) =>
    apiFetch<Invoice[]>(
      `/invoices${buildQuery({ studentId: filters?.studentId, status: filters?.status })}`
    ),
  createInvoice: (payload: {
    studentId: string;
    dueDate: string;
    items: Array<{ description: string; amount: number }>;
    metadata?: Record<string, unknown>;
  }) =>
    apiFetch<Invoice>('/invoices', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  getStudentInvoices: (studentId: string) => apiFetch<Invoice[]>(`/invoices/${studentId}`),

  student: {
    listSubjects: () => apiFetch<StudentSubjectSummary[]>('/student/subjects'),
    requestSubjectDrop: (subjectId: string, reason?: string) =>
      apiFetch<{ status: 'pending' | 'approved' | 'rejected' | 'none' }>(
        `/student/subjects/${subjectId}/drop`,
        {
          method: 'POST',
          body: JSON.stringify(reason ? { reason } : {}),
          headers: { 'Content-Type': 'application/json' }
        }
      ),
    listExamSummaries: () => apiFetch<StudentExamSummary[]>('/student/results/exams'),
    getLatestExamId: () => apiFetch<{ examId: string | null }>('/student/results/latest-exam-id'),
    getProfile: () => apiFetch<StudentProfileDetail>('/student/profile'),
    updateProfile: (payload: {
      firstName?: string;
      lastName?: string;
      parentContacts?: unknown[];
    }) =>
      apiFetch<StudentProfileDetail>('/student/profile', {
        method: 'PATCH',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' }
      }),
    requestPromotion: (payload: { targetClassId: string; notes?: string }) =>
      apiFetch<{ status: 'pending' }>('/student/promotion-requests', {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' }
      }),
    listMessages: () => apiFetch<StudentMessage[]>('/student/messages'),
    listTerms: () => apiFetch<StudentTermSummary[]>('/student/terms'),
    listReports: () => apiFetch<StudentTermReportRecord[]>('/student/reports'),
    generateTermReport: (termId: string) =>
      apiFetch<{ reportId: string }>('/student/reports', {
        method: 'POST',
        body: JSON.stringify({ termId }),
        headers: { 'Content-Type': 'application/json' }
      }),
    downloadTermReport: (reportId: string) =>
      apiFetch<Blob>(`/student/reports/${reportId}/pdf`, {
        responseType: 'blob'
      }),
    getClassRoster: () => apiFetch<TeacherClassRosterEntry[]>('/student/roster'),
    markMessageAsRead: (messageId: string) =>
      apiFetch<void>(`/student/messages/${messageId}/read`, {
        method: 'PATCH'
      })
  },

  // RBAC
  listUsers: async () => {
    const response = await apiFetch<PaginatedResponse<TenantUser> | TenantUser[]>('/users');
    return extractPaginatedData(response);
  },
  listTeachers: async () => {
    const response = await apiFetch<PaginatedResponse<TeacherProfile> | TeacherProfile[]>(
      '/teachers'
    );
    const teachers = extractPaginatedData(response);
    return teachers.map(transformTeacher);
  },
  getTeacher: async (id: string) => {
    const teacher = await apiFetch<TeacherProfile>(`/teachers/${id}`);
    return transformTeacher(teacher);
  },
  updateTeacher: (
    id: string,
    payload: {
      name?: string;
      email?: string;
      subjects?: string[];
      assignedClasses?: string[];
      qualifications?: string;
      yearsOfExperience?: number;
    }
  ) =>
    apiFetch<TeacherProfile>(`/teachers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    }).then(transformTeacher),
  deleteTeacher: (id: string) =>
    apiFetch<void>(`/teachers/${id}`, {
      method: 'DELETE'
    }),
  listStudents: async () => {
    const response = await apiFetch<PaginatedResponse<StudentRecord> | StudentRecord[]>(
      '/students'
    );
    const students = extractPaginatedData(response);
    return students.map(transformStudent);
  },
  getStudent: async (id: string) => {
    const student = await apiFetch<StudentRecord>(`/students/${id}`);
    return transformStudent(student);
  },
  updateStudent: (
    id: string,
    payload: {
      firstName?: string;
      lastName?: string;
      dateOfBirth?: string;
      enrollmentDate?: string;
      classId?: string;
      admissionNumber?: string;
      parentContacts?: Array<{ name: string; relationship: string; phone: string }>;
    }
  ) =>
    apiFetch<StudentRecord>(`/students/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    }).then(transformStudent),
  deleteStudent: (id: string) =>
    apiFetch<void>(`/students/${id}`, {
      method: 'DELETE'
    }),
  getSchool: () =>
    apiFetch<{ id: string; name: string; address: Record<string, unknown> } | null>('/school'),
  updateUserRole: (userId: string, role: Role) =>
    apiFetch<TenantUser>(`/users/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role })
    }),
  listPendingUsers: () => apiFetch<TenantUser[]>('/users?status=pending'),
  approveUser: (userId: string) =>
    apiFetch<TenantUser>(`/users/${userId}/approve`, {
      method: 'PATCH'
    }),
  rejectUser: (userId: string, reason?: string) =>
    apiFetch<TenantUser>(`/users/${userId}/reject`, {
      method: 'PATCH',
      body: JSON.stringify({ reason })
    }),
  bulkApproveUsers: (userIds: string[]) =>
    apiFetch<{
      success: boolean;
      processed: number;
      successful: number;
      failed: number;
      results: Array<{ userId: string; success: boolean; error?: string }>;
    }>('/users/bulk-approve', {
      method: 'POST',
      body: JSON.stringify({ userIds })
    }),
  bulkRejectUsers: (userIds: string[]) =>
    apiFetch<{
      success: boolean;
      processed: number;
      successful: number;
      failed: number;
      results: Array<{ userId: string; success: boolean; error?: string }>;
    }>('/users/bulk-reject', {
      method: 'POST',
      body: JSON.stringify({ userIds })
    }),
  updateUserPassword: (userId: string, password: string) =>
    apiFetch<{ success: boolean; message: string }>(`/users/${userId}/password`, {
      method: 'PATCH',
      body: JSON.stringify({ password })
    }),
  // Admin user registration
  registerUser: (payload: {
    email: string;
    password: string;
    role: 'student' | 'teacher' | 'hod';
    fullName: string;
    gender?: 'male' | 'female' | 'other';
    address?: string;
    // Student fields
    dateOfBirth?: string;
    parentGuardianName?: string;
    parentGuardianContact?: string;
    studentId?: string;
    classId?: string;
    // Teacher/HOD fields
    phone?: string;
    qualifications?: string;
    yearsOfExperience?: number;
    subjects?: string[];
    teacherId?: string;
    // HOD fields
    departmentId?: string;
  }) =>
    apiFetch<{ userId: string; profileId: string; email: string; role: Role; status: 'active' }>(
      '/users/register',
      {
        method: 'POST',
        body: JSON.stringify(payload)
      }
    ),
  // Departments
  listDepartments: () => apiFetch<Array<{ id: string; name: string; slug: string; contact_email?: string; contact_phone?: string }>>('/departments'),
  // Credentials
  downloadCredentialPDF: (data: {
    email: string;
    password: string;
    fullName: string;
    role: string;
    schoolName?: string;
  }) =>
    apiFetch<{ base64: string }>('/credentials/pdf', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  sendCredentialEmail: (data: {
    email: string;
    password: string;
    fullName: string;
    role: string;
  }) =>
    apiFetch<{ success: boolean; message: string }>('/credentials/email', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  getTopSchools: (limit = 5) => apiFetch<TopSchool[]>(`/schools/top?limit=${limit}`),
  superuser: {
    getOverview: () => apiFetch<PlatformOverview>('/superuser/overview'),
    listSchools: () => apiFetch<PlatformSchool[]>('/superuser/schools'),
    createSchool: (payload: CreateSchoolPayload) =>
      apiFetch<{ id: string; schemaName: string }>('/superuser/schools', {
        method: 'POST',
        body: JSON.stringify(payload)
      }),
    updateSchool: (id: string, payload: UpdateSchoolPayload) =>
      apiFetch<PlatformSchool>(`/superuser/schools/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      }),
    deleteSchool: (id: string) =>
      apiFetch<void>(`/superuser/schools/${id}`, {
        method: 'DELETE'
      }),
    createSchoolAdmin: (id: string, payload: CreateSchoolAdminPayload) =>
      apiFetch<{
        id: string;
        email: string;
        role: 'admin';
        tenant_id: string;
        created_at: string;
        username: string | null;
        full_name: string | null;
      }>(`/superuser/schools/${id}/admins`, {
        method: 'POST',
        body: JSON.stringify(payload)
      }),
    listUsers: () => apiFetch<PlatformUserSummary[]>('/superuser/users'),
    updateUserStatus: (userId: string, status: UserStatus) =>
      apiFetch<PlatformUserSummary>(`/superuser/users/${userId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      }),
    getTenantAnalytics: (tenantId: string) =>
      apiFetch<{
        tenantId: string;
        name: string;
        createdAt: Date;
        userCount: number;
        teacherCount: number;
        studentCount: number;
        classCount: number;
        recentActivity: {
          attendanceRecords: number;
          exams: number;
        };
      }>(`/superuser/analytics/tenant/${tenantId}`),
    getUsage: (tenantId?: string) => {
      const params = tenantId ? `?tenantId=${tenantId}` : '';
      return apiFetch<{
        tenantId?: string;
        activeUsers?: number;
        storageUsed?: number;
        apiCalls?: number;
        lastActivity?: string;
        totalActiveUsers?: number;
        totalStorage?: number;
        totalApiCalls?: number;
      }>(`/superuser/usage${params}`);
    },
    generateReport: (type: 'audit' | 'users' | 'revenue' | 'activity') =>
      apiFetch<{ id: string; downloadUrl?: string }>('/superuser/reports', {
        method: 'POST',
        body: JSON.stringify({ type })
      }),
    updateSettings: (settings: {
      globalBranding: {
        platformName: string;
        defaultLogoUrl: string | null;
        defaultPrimaryColor: string;
      };
      authentication: {
        requireEmailVerification: boolean;
        allowSelfRegistration: boolean;
        sessionTimeoutMinutes: number;
      };
      features: {
        enableAuditLogging: boolean;
        enableNotifications: boolean;
        enableHighContrastMode: boolean;
      };
      integrations: {
        paymentProcessor: string;
        emailProvider: string;
        smsProvider: string | null;
      };
    }) =>
      apiFetch<{ success: boolean }>('/superuser/settings', {
        method: 'PUT',
        body: JSON.stringify(settings)
      })
  },
  admin: {
    listSubjects: () => apiFetch<Subject[]>('/admin/subjects'),
    createSubject: (payload: SubjectPayload) =>
      apiFetch<Subject>('/admin/subjects', {
        method: 'POST',
        body: JSON.stringify(payload)
      }),
    updateSubject: (id: string, payload: SubjectPayload) =>
      apiFetch<Subject>(`/admin/subjects/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      }),
    deleteSubject: (id: string) =>
      apiFetch<void>(`/admin/subjects/${id}`, {
        method: 'DELETE'
      }),
    getClassSubjects: (classId: string) =>
      apiFetch<ClassSubject[]>(`/admin/classes/${classId}/subjects`),
    setClassSubjects: (classId: string, subjectIds: string[]) =>
      apiFetch<ClassSubject[]>(`/admin/classes/${classId}/subjects`, {
        method: 'POST',
        body: JSON.stringify({ subjectIds })
      }),
    listTeacherAssignments: () => apiFetch<AdminTeacherAssignment[]>('/admin/teacher-assignments'),
    assignTeacher: (
      teacherId: string,
      payload: {
        classId: string;
        subjectId: string;
        isClassTeacher?: boolean;
        metadata?: Record<string, unknown>;
      }
    ) =>
      apiFetch<AdminTeacherAssignment>(`/admin/teachers/${teacherId}/assignments`, {
        method: 'POST',
        body: JSON.stringify(payload)
      }),
    removeTeacherAssignment: (assignmentId: string) =>
      apiFetch<void>(`/admin/teacher-assignments/${assignmentId}`, {
        method: 'DELETE'
      }),
    getStudentSubjects: (studentId: string) =>
      apiFetch<StudentSubject[]>(`/admin/students/${studentId}/subjects`),
    setStudentSubjects: (studentId: string, subjectIds: string[]) =>
      apiFetch<StudentSubject[]>(`/admin/students/${studentId}/subjects`, {
        method: 'POST',
        body: JSON.stringify({ subjectIds })
      }),
    promoteStudent: (studentId: string, payload: PromoteStudentPayload) =>
      apiFetch(`/admin/students/${studentId}/promote`, {
        method: 'POST',
        body: JSON.stringify(payload)
      }),
    exportTermReport: (payload: TermReportRequest) =>
      apiFetch<Blob>('/admin/reports/term', {
        method: 'POST',
        body: JSON.stringify(payload),
        responseType: 'blob'
      }),
    fetchReportPdf: (reportId: string) =>
      apiFetch<Blob>(`/admin/reports/term/${reportId}/pdf`, {
        responseType: 'blob'
      })
  },
  teacher: {
    getOverview: () => apiFetch<TeacherOverview>('/teacher/overview'),
    listClasses: () => apiFetch<TeacherClassSummary[]>('/teacher/classes'),
    getClassRoster: (classId: string) =>
      apiFetch<TeacherClassRosterEntry[]>(`/teacher/classes/${classId}/roster`),
    dropSubject: (assignmentId: string) =>
      apiFetch<TeacherAssignmentSummary>(`/teacher/assignments/${assignmentId}/drop`, {
        method: 'POST'
      }),
    getClassReport: (classId: string) =>
      apiFetch<TeacherClassReport>(`/teacher/reports/class/${classId}`),
    downloadClassReportPdf: (classId: string) =>
      apiFetch<Blob>(`/teacher/reports/class/${classId}/pdf`, {
        responseType: 'blob'
      }),
    getMessages: () => apiFetch<TeacherMessage[]>('/teacher/messages'),
    getProfile: () => apiFetch<TeacherProfileDetail>('/teacher/profile')
  },
  // Audit and activity endpoints
  getActivityHistory: (userId?: string) => {
    const params = userId ? `?userId=${userId}` : '';
    return apiFetch<
      Array<{
        id: string;
        action: string;
        description: string;
        timestamp: string;
        metadata: Record<string, unknown>;
      }>
    >(`/audit/activity${params}`);
  },
  getAuditLogs: (
    userId?: string,
    filters?: {
      entityType?: string;
      from?: string;
      to?: string;
      limit?: number;
    }
  ) => {
    const searchParams = new URLSearchParams();
    if (userId) searchParams.set('userId', userId);
    if (filters?.entityType) searchParams.set('entityType', filters.entityType);
    if (filters?.from) searchParams.set('from', filters.from);
    if (filters?.to) searchParams.set('to', filters.to);
    if (filters?.limit) searchParams.set('limit', String(filters.limit));
    const params = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return apiFetch<AuditLogEntry[]>(`/audit/logs${params}`);
  },
  // Search
  search: (
    query: string,
    options?: { limit?: number; types?: ('student' | 'teacher' | 'class' | 'subject')[] }
  ) => {
    const searchParams = new URLSearchParams();
    searchParams.set('q', query);
    if (options?.limit) searchParams.set('limit', String(options.limit));
    if (options?.types) searchParams.set('types', options.types.join(','));
    return apiFetch<{
      results: Array<{
        type: 'student' | 'teacher' | 'class' | 'subject';
        id: string;
        title: string;
        subtitle?: string;
        metadata?: Record<string, unknown>;
      }>;
    }>(`/search?${searchParams.toString()}`);
  },
  // Notifications
  notifications: {
    list: (limit?: number) => {
      const params = limit ? `?limit=${limit}` : '';
      return apiFetch<{
        notifications: Array<{
          id: string;
          userId: string;
          title: string;
          message: string;
          type: 'info' | 'success' | 'warning' | 'error';
          read: boolean;
          createdAt: string;
          metadata?: Record<string, unknown>;
        }>;
      }>(`/notifications${params}`);
    },
    markAsRead: (notificationId: string) =>
      apiFetch<void>(`/notifications/${notificationId}/read`, {
        method: 'POST'
      }),
    markAllAsRead: () =>
      apiFetch<{ marked: number }>('/notifications/read-all', {
        method: 'POST'
      })
  },
  // Department Analytics
  getDepartmentAnalytics: (departmentId?: string) => {
    const params = departmentId ? `?department_id=${departmentId}` : '';
    return apiFetch<{
      departmentId?: string;
      totalTeachers: number;
      totalStudents: number;
      averageClassSize: number;
    }>(`/reports/department-analytics${params}`);
  },
  getUserGrowthTrends: (days: number = 30) =>
    apiFetch<Array<{
      date: string;
      student: number;
      teacher: number;
      admin: number;
      hod: number;
      total: number;
    }>>(`/reports/user-growth${buildQuery({ days: String(days) })}`),
  getTeachersPerDepartment: () =>
    apiFetch<Array<{
      department: string;
      count: number;
    }>>('/reports/teachers-per-department'),
  getStudentsPerClass: () =>
    apiFetch<Array<{
      className: string;
      count: number;
    }>>('/reports/students-per-class')
};

export interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  userId: string | null;
  userEmail: string | null;
  timestamp: string;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
}
