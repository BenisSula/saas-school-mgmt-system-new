import { getCsrfHeader } from './security/csrf';
import {
  storeRefreshToken,
  getRefreshToken,
  storeTenantId,
  getTenantId,
  clearAllTokens,
  isValidTokenFormat
} from './security/tokenSecurity';
// import { sanitizeForDisplay } from './security/inputSanitization';
import { extractPaginatedData, type PaginatedResponse } from './api/pagination';

function stripTrailingSlash(input: string): string {
  return input.endsWith('/') ? input.slice(0, -1) : input;
}

function isAbsoluteHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

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

// Removed unused function safeWindowOrigin

function normaliseBaseUrl(raw: string): string {
  try {
    const url = new URL(raw);
    return stripTrailingSlash(url.toString());
  } catch {
    return stripTrailingSlash(raw);
  }
}

function resolveApiBaseUrl(): string {
  // Check for explicit VITE_API_BASE_URL first (even in dev mode)
  const explicitRaw = (import.meta.env.VITE_API_BASE_URL ?? import.meta.env.VITE_API_URL) as
    | string
    | undefined;

  if (explicitRaw) {
    const cleaned = trimAndUnquote(explicitRaw);
    if (cleaned) {
      // Relative base like "/api" - keep it relative so Vite proxy can handle it
      if (cleaned.startsWith('/')) {
        // In development, Vite proxy handles /api -> backend
        // Don't convert to absolute URL - let browser use relative path
        return stripTrailingSlash(cleaned);
      }
      // Absolute URL provided - use it
      const normalised = stripTrailingSlash(normaliseBaseUrl(cleaned));
      if (isAbsoluteHttpUrl(normalised)) {
        return normalised;
      }
    }
  }

  // Fallback: In dev mode, use relative /api path (Vite proxy will handle it)
  if (import.meta.env.DEV) {
    return '/api';
  }

  // Production: require explicit configuration
  if (!explicitRaw) {
    throw new Error('Missing or invalid VITE_API_BASE_URL: <empty> — see docs/.env.example');
  }

  const cleaned = trimAndUnquote(explicitRaw);
  if (!cleaned) {
    throw new Error('Missing or invalid VITE_API_BASE_URL: <whitespace> — see docs/.env.example');
  }

  // Absolute or host-only; require http/https
  const normalised = stripTrailingSlash(normaliseBaseUrl(cleaned));
  if (!isAbsoluteHttpUrl(normalised)) {
    throw new Error(
      `Missing or invalid VITE_API_BASE_URL: ${explicitRaw} — must start with http:// or https:// (or be a relative path like /api).`
    );
  }
  return normalised;
}

let API_BASE_URL: string;
try {
  API_BASE_URL = resolveApiBaseUrl();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error('[SUMANO][API_BASE_URL] RESOLUTION FAILED:', message);
  throw error;
}

// Validate API_BASE_URL - allow relative paths (for Vite proxy) or absolute URLs
if (!API_BASE_URL.startsWith('/') && !isAbsoluteHttpUrl(API_BASE_URL)) {
  const errorMsg = `[SUMANO][API_BASE_URL] CRITICAL: Resolved to invalid base: "${API_BASE_URL}". Expected http:// or https:// URL, or relative path like /api.`;
  console.error(errorMsg);
  throw new Error(errorMsg);
}

if (import.meta.env.DEV) {
  console.log('[SUMANO][API_BASE_URL]', API_BASE_URL);
  // Validate window context
  if (typeof window !== 'undefined') {
    console.log('[SUMANO][WINDOW_ORIGIN]', window.location.origin);
    console.log('[SUMANO][WINDOW_HREF]', window.location.href);
  }
}

function safeJoinUrl(path: string, base: string): string {
  // If path is already absolute, use it as-is
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  // Ensure base is never empty or invalid
  if (!base || typeof base !== 'string') {
    throw new Error(`Invalid API_BASE_URL: ${String(base)}. Expected a non-empty string.`);
  }

  // Base is relative path (e.g., /api) - use as-is for Vite proxy
  if (base.startsWith('/')) {
    // Ensure path starts with / for proper resolution
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    // Combine relative paths: /api + /auth/login = /api/auth/login
    return `${base}${normalizedPath}`;
  }

  // Base is already absolute http(s)
  if (isAbsoluteHttpUrl(base)) {
    try {
      // Ensure base ends with / for proper URL resolution
      const normalizedBase = base.endsWith('/') ? base : `${base}/`;
      // Ensure path starts with / for proper resolution
      const normalizedPath = path.startsWith('/') ? path : `/${path}`;
      return new URL(normalizedPath, normalizedBase).toString();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to construct URL with base "${base}" and path "${path}": ${errorMsg}. ` +
          `Please check VITE_API_BASE_URL or restart the dev server. ` +
          `Current window.location.origin: ${typeof window !== 'undefined' ? window.location.origin : 'N/A'}.`
      );
    }
  }

  // Fallback: Base is relative but doesn't start with / - shouldn't happen
  throw new Error(
    `Invalid API_BASE_URL: "${base}". Expected absolute URL (http://...) or relative path starting with / (e.g., /api).`
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
  additional_roles?: Array<{ role: string; granted_at?: string; granted_by?: string; metadata?: Record<string, unknown> }>;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  mustChangePassword?: boolean; // Flag indicating user must change password after login
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
 * Standardized API response format
 */
export interface StandardizedApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
}

/**
 * Extract data from standardized API response
 * Handles both new standardized format and legacy format for backward compatibility
 */
export function extractApiData<T>(response: StandardizedApiResponse<T> | T): T {
  if (response && typeof response === 'object' && 'success' in response && 'data' in response) {
    const stdResponse = response as StandardizedApiResponse<T>;
    if (stdResponse.success) {
      // Handle null/undefined data (e.g., for delete operations)
      if (stdResponse.data === undefined && stdResponse.data !== null) {
        // If data is explicitly undefined (not null), it might be missing
        // For delete operations, we return undefined as T
        return undefined as T;
      }
      return stdResponse.data as T;
    }
    // If success is false, throw an error
    if (!stdResponse.success) {
      throw new Error(stdResponse.message || 'API request failed');
    }
  }
  // Legacy format - return as-is
  return response as T;
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

    // Handle Zod validation errors with user-friendly formatting
    if (payload?.errors && Array.isArray(payload.errors) && payload.errors.length > 0) {
      const formattedErrors = payload.errors.map((e: { message: string; path: string[] }) => {
        const field = e.path.join(' ');
        const fieldLabel = field
          .replace(/([A-Z])/g, ' $1')
          .replace(/^./, (str) => str.toUpperCase())
          .trim();
        return `${fieldLabel}: ${e.message}`;
      });
      return {
        message: payload.message || formattedErrors.join('; '),
        error: payload as ApiErrorResponse
      };
    }

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
      // Only log non-401 errors (401 is expected when refresh token is expired/invalid)
      if (response.status !== 401) {
        console.warn('[api] refresh token failed', message);
      }
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

  let response: Response;
  try {
    // Build a safe absolute URL and avoid accidental double slashes
    let requestUrl: string;
    try {
      requestUrl = safeJoinUrl(path, API_BASE_URL);
    } catch (urlError) {
      const errorMsg = urlError instanceof Error ? urlError.message : String(urlError);
      console.error('[apiFetch] URL construction failed:', {
        path,
        API_BASE_URL,
        error: errorMsg,
        windowOrigin: typeof window !== 'undefined' ? window.location.origin : 'N/A',
        windowHref: typeof window !== 'undefined' ? window.location.href : 'N/A'
      });
      throw new Error(`Failed to construct API URL: ${errorMsg}`);
    }
    // Pre-rewrite docker service hostname for host browser in dev
    if (import.meta.env.DEV && requestUrl.includes('//backend:')) {
      requestUrl = requestUrl.replace('//backend:', '//127.0.0.1:');
    }
    response = await fetch(requestUrl, {
      ...rest,
      headers,
      credentials: 'include' // Include cookies for CSRF token
    });
  } catch (error) {
    // Fallback retry: if dev build points to a Docker service hostname that isn't resolvable
    // from the host browser (e.g., http://backend:3001), retry once with 127.0.0.1
    try {
      const reqUrl = safeJoinUrl(path, API_BASE_URL);
      if (reqUrl.includes('//backend:')) {
        const fallbackUrl = reqUrl.replace('//backend:', '//127.0.0.1:');
        response = await fetch(fallbackUrl, {
          ...rest,
          headers,
          credentials: 'include'
        });
      } else {
        throw error;
      }
    } catch (retryError) {
      const retryMsg = retryError instanceof Error ? retryError.message : String(retryError);
      if (
        retryMsg.includes('Failed to fetch') ||
        retryMsg.includes('NetworkError') ||
        retryMsg.includes('ERR_') ||
        retryMsg.includes('ERR_NAME_NOT_RESOLVED')
      ) {
        throw new Error(
          `Unable to connect to the server at ${API_BASE_URL}. Please ensure the backend server is running and accessible.`
        );
      }
      throw new Error(`Network request failed: ${retryMsg}`);
    }
  }

  if (response.status === 401 && retry && refreshToken) {
    const refreshed = await performRefresh();
    if (refreshed?.accessToken) {
      return apiFetch<T>(path, options, false);
    }
  }

  if (!response.ok) {
    const errorInfo = await extractError(response);
    const error = new Error(errorInfo.message) as Error & { apiError?: ApiErrorResponse };
    // Attach structured error data for field-level error handling
    if (errorInfo.error) {
      error.apiError = errorInfo.error;
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
  additional_roles?: Array<{ role: string; granted_at?: string; granted_by?: string; metadata?: Record<string, unknown> }>;
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
  created_at?: string;
  updated_at?: string;
}

export interface TeacherClassInfo {
  id: string;
  name: string;
  studentCount: number;
}

export interface TeacherStudent {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  class_id?: string | null;
  class_uuid?: string | null;
  admission_number?: string | null;
}

// Billing Types
export interface Subscription {
  id: string;
  tenant_id: string;
  stripe_subscription_id?: string;
  stripe_customer_id?: string;
  plan_id: string;
  plan_name?: string;
  status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'unpaid';
  billing_cycle?: 'monthly' | 'yearly';
  billing_interval?: 'month' | 'year';
  amount?: number;
  price_cents?: number;
  currency?: string;
  current_period_start?: string;
  current_period_end?: string;
  trial_end?: string;
  cancel_at_period_end?: boolean;
  canceled_at?: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface BillingInvoice {
  id: string;
  tenant_id: string;
  subscription_id?: string;
  stripe_invoice_id?: string;
  invoice_number: string;
  amount?: number;
  amount_cents?: number;
  currency?: string;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  due_date?: string;
  paid_at?: string;
  pdf_url?: string;
  hosted_invoice_url?: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface BillingPayment {
  id: string;
  tenant_id: string;
  invoice_id?: string;
  user_id?: string;
  stripe_payment_intent_id?: string;
  stripe_charge_id?: string;
  amount?: number;
  amount_cents?: number;
  currency?: string;
  status: 'pending' | 'succeeded' | 'failed' | 'refunded' | 'canceled';
  provider?: string;
  provider_payment_id?: string;
  payment_method?: string;
  failure_reason?: string;
  metadata?: Record<string, unknown>;
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
  enrollment_status?: 'active' | 'graduated' | 'transferred' | 'suspended' | 'withdrawn';
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

function buildQuery(params?: Record<string, string | number | boolean | string[] | undefined>): string {
  if (!params) return '';
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      if (Array.isArray(value)) {
        value.forEach(v => search.append(key, String(v)));
      } else {
        search.set(key, String(value));
      }
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
  },
  async changePassword(payload: { currentPassword: string; newPassword: string }): Promise<void> {
    await apiFetch<void>(
      '/auth/change-password',
      {
        method: 'POST',
        body: JSON.stringify(payload)
      },
      true
    );
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
      }),
    // Phase 7: Dashboard
    getDashboard: () => apiFetch<{
      attendance: {
        summary: { present: number; total: number; percentage: number };
        recent: Array<{ date: string; status: string }>;
      };
      grades: {
        recent: Array<{
          subject: string;
          score: number;
          grade: string | null;
          exam: string | null;
          date: string;
        }>;
        summary: { average: number; totalSubjects: number };
      };
      classSchedule: Array<{ day: string; time: string; subject: string; teacher: string }>;
      resources: Array<{
        id: string;
        title: string;
        description: string | null;
        file_url: string;
        file_type: string;
        created_at: string;
      }>;
      announcements: Array<{
        id: string;
        message: string;
        teacher_name: string | null;
        created_at: string;
      }>;
      upcomingTasks: Array<{ id: string; title: string; dueDate: string; subject: string }>;
    }>('/students/me/dashboard'),
    // Phase 7: Announcements
    getAnnouncements: (classId: string) =>
      apiFetch<Array<{
        id: string;
        tenant_id: string;
        class_id: string;
        teacher_id: string;
        message: string;
        attachments: Array<{ filename: string; url: string }> | null;
        created_at: string;
        teacher_name?: string;
      }>>(`/students/announcements?classId=${classId}`),
    // Phase 7: Resources
    getResources: (classId: string) =>
      apiFetch<Array<{
        id: string;
        tenant_id: string;
        teacher_id: string;
        class_id: string;
        title: string;
        description: string | null;
        file_url: string;
        file_type: string;
        size: number;
        created_at: string;
      }>>(`/students/resources?classId=${classId}`),
    // Phase 7: Attendance (already exists but ensure it's accessible)
    getAttendance: (params?: { from?: string; to?: string }) => {
      const queryParams = new URLSearchParams();
      if (params?.from) queryParams.append('from', params.from);
      if (params?.to) queryParams.append('to', params.to);
      const queryString = queryParams.toString();
      return apiFetch<{
        history: Array<{
          id: string;
          student_id: string;
          class_id: string;
          status: string;
          attendance_date: string;
        }>;
        summary: { present: number; total: number; percentage: number };
      }>(`/students/attendance${queryString ? `?${queryString}` : ''}`);
    },
    // Phase 7: Grades
    getGrades: (params?: { term?: string }) => {
      const queryParams = new URLSearchParams();
      if (params?.term) queryParams.append('term', params.term);
      const queryString = queryParams.toString();
      return apiFetch<Array<{
        id: string;
        student_id: string;
        class_id: string;
        subject_id: string | null;
        exam_id: string | null;
        score: number;
        grade: string | null;
        remarks: string | null;
        subject_name: string | null;
        exam_name: string | null;
        class_name: string | null;
        created_at: string;
      }>>(`/students/grades${queryString ? `?${queryString}` : ''}`);
    }
  },

  // RBAC
  listUsers: async () => {
    const response = await apiFetch<PaginatedResponse<TenantUser> | TenantUser[]>('/users');
    return extractPaginatedData(response);
  },
  listTeachers: async () => {
    const response = await apiFetch<StandardizedApiResponse<PaginatedResponse<TeacherProfile>> | PaginatedResponse<TeacherProfile> | TeacherProfile[]>(
      '/teachers'
    );
    // Handle standardized response
    let teachers: TeacherProfile[];
    if (response && typeof response === 'object' && 'success' in response && 'data' in response) {
      const stdResponse = response as StandardizedApiResponse<PaginatedResponse<TeacherProfile>>;
      if (stdResponse.success && stdResponse.data) {
        teachers = extractPaginatedData(stdResponse.data);
      } else {
        throw new Error(stdResponse.message || 'Failed to fetch teachers');
      }
    } else {
      // Legacy format
      teachers = extractPaginatedData(response as PaginatedResponse<TeacherProfile> | TeacherProfile[]);
    }
    return teachers.map(transformTeacher);
  },
  createTeacher: async (payload: {
    name: string;
    email: string;
    subjects?: string[];
    assignedClasses?: string[];
  }) => {
    const response = await apiFetch<StandardizedApiResponse<TeacherProfile> | TeacherProfile>('/teachers', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return transformTeacher(extractApiData(response));
  },
  getTeacher: async (id: string) => {
    const response = await apiFetch<StandardizedApiResponse<TeacherProfile> | TeacherProfile>(`/teachers/${id}`);
    const teacher = extractApiData(response);
    return transformTeacher(teacher);
  },
  updateTeacher: (
    id: string,
    payload: { name?: string; email?: string; subjects?: string[]; assignedClasses?: string[] }
  ) =>
    apiFetch<StandardizedApiResponse<TeacherProfile> | TeacherProfile>(`/teachers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    }).then((response) => transformTeacher(extractApiData(response))),
  deleteTeacher: async (id: string) => {
    const response = await apiFetch<StandardizedApiResponse<null> | void>(`/teachers/${id}`, {
      method: 'DELETE'
    });
    // For delete operations, we don't need the data, just verify success
    if (response && typeof response === 'object' && 'success' in response) {
      const stdResponse = response as StandardizedApiResponse<null>;
      if (!stdResponse.success) {
        throw new Error(stdResponse.message || 'Failed to delete teacher');
      }
    }
    return;
  },
  listStudents: async (filters?: { classId?: string; enrollmentStatus?: string; search?: string }) => {
    const params = buildQuery(filters);
    const response = await apiFetch<StandardizedApiResponse<PaginatedResponse<StudentRecord>> | PaginatedResponse<StudentRecord> | StudentRecord[]>(`/students${params}`);
    // Handle standardized response
    let students: StudentRecord[];
    if (response && typeof response === 'object' && 'success' in response && 'data' in response) {
      const stdResponse = response as StandardizedApiResponse<PaginatedResponse<StudentRecord>>;
      if (stdResponse.success && stdResponse.data) {
        // Check if data has items (new paginated format) or is direct array
        if ('items' in stdResponse.data && Array.isArray(stdResponse.data.items)) {
          students = stdResponse.data.items;
        } else {
          students = extractPaginatedData(stdResponse.data);
        }
      } else {
        throw new Error(stdResponse.message || 'Failed to fetch students');
      }
    } else {
      // Legacy format
      students = extractPaginatedData(response as PaginatedResponse<StudentRecord> | StudentRecord[]);
    }
    return students.map(transformStudent);
  },
  createStudent: async (payload: {
    firstName: string;
    lastName: string;
    dateOfBirth?: string;
    classId?: string;
    admissionNumber?: string;
    parentContacts?: Array<{ name: string; relationship: string; phone: string }>;
  }) => {
    const response = await apiFetch<StandardizedApiResponse<StudentRecord> | StudentRecord>('/students', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return transformStudent(extractApiData(response));
  },
  getStudent: async (id: string) => {
    const response = await apiFetch<StandardizedApiResponse<StudentRecord> | StudentRecord>(`/students/${id}`);
    const student = extractApiData(response);
    return transformStudent(student);
  },
  updateStudent: (
    id: string,
    payload: {
      firstName?: string;
      lastName?: string;
      dateOfBirth?: string;
      classId?: string;
      admissionNumber?: string;
      parentContacts?: Array<{ name: string; relationship: string; phone: string }>;
    }
  ) =>
    apiFetch<StandardizedApiResponse<StudentRecord> | StudentRecord>(`/students/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    }).then((response) => transformStudent(extractApiData(response))),
  deleteStudent: async (id: string) => {
    const response = await apiFetch<StandardizedApiResponse<null> | void>(`/students/${id}`, {
      method: 'DELETE'
    });
    // For delete operations, we don't need the data, just verify success
    if (response && typeof response === 'object' && 'success' in response) {
      const stdResponse = response as StandardizedApiResponse<null>;
      if (!stdResponse.success) {
        throw new Error(stdResponse.message || 'Failed to delete student');
      }
    }
    return;
  },
  requestClassChange: (studentId: string, payload: { targetClassId: string; reason?: string }) =>
    apiFetch<{
      success: boolean;
      message: string;
      data?: {
        id: string;
        student_id: string;
        current_class_id: string | null;
        requested_class_id: string;
        status: 'pending' | 'approved' | 'rejected';
        reason?: string;
        created_at: string;
      };
    }>(`/students/${studentId}/class-change-request`, {
      method: 'POST',
      body: JSON.stringify(payload)
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
  // Admin user registration
  registerUser: (payload: {
    email: string;
    password: string;
    role: 'student' | 'teacher';
    fullName: string;
    gender?: 'male' | 'female' | 'other';
    address?: string;
    // Student fields
    dateOfBirth?: string;
    parentGuardianName?: string;
    parentGuardianContact?: string;
    studentId?: string;
    classId?: string;
    // Teacher fields
    phone?: string;
    qualifications?: string;
    yearsOfExperience?: number;
    subjects?: string[];
    teacherId?: string;
  }) =>
    apiFetch<{ userId: string; profileId: string; email: string; role: Role; status: 'active' }>(
      '/users/register',
      {
        method: 'POST',
        body: JSON.stringify(payload)
      }
    ),
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
    getSubscriptionTierConfigs: () =>
      apiFetch<Array<{
        id: string;
        tier: SubscriptionTier;
        name: string;
        description: string | null;
        monthlyPrice: number;
        yearlyPrice: number;
        maxUsers: number | null;
        maxStudents: number | null;
        maxTeachers: number | null;
        maxStorageGb: number | null;
        features: Record<string, unknown>;
        limits: Record<string, unknown>;
        isActive: boolean;
        createdAt: string;
        updatedAt: string;
      }>>('/superuser/subscriptions/tiers/config'),
    updateSubscriptionTierConfigs: (configs: Array<{
      tier: SubscriptionTier;
      config: {
        name?: string;
        description?: string;
        monthlyPrice?: number;
        yearlyPrice?: number;
        maxUsers?: number | null;
        maxStudents?: number | null;
        maxTeachers?: number | null;
        maxStorageGb?: number | null;
        features?: Record<string, unknown>;
        limits?: Record<string, unknown>;
        isActive?: boolean;
      };
    }>) =>
      apiFetch<Array<{
        id: string;
        tier: SubscriptionTier;
        name: string;
        description: string | null;
        monthlyPrice: number;
        yearlyPrice: number;
        maxUsers: number | null;
        maxStudents: number | null;
        maxTeachers: number | null;
        maxStorageGb: number | null;
        features: Record<string, unknown>;
        limits: Record<string, unknown>;
        isActive: boolean;
        createdAt: string;
        updatedAt: string;
      }>>('/superuser/subscriptions/tiers/config', {
        method: 'PUT',
        body: JSON.stringify({ configs })
      }),
    // Alias for subscription tiers endpoint (matches requirement)
    updateSubscriptionTiers: (configs: Array<{
      tier: SubscriptionTier;
      config: {
        name?: string;
        description?: string;
        monthlyPrice?: number;
        yearlyPrice?: number;
        maxUsers?: number | null;
        maxStudents?: number | null;
        maxTeachers?: number | null;
        maxStorageGb?: number | null;
        features?: Record<string, unknown>;
        limits?: Record<string, unknown>;
        isActive?: boolean;
      };
    }>) =>
      apiFetch<Array<{
        id: string;
        tier: SubscriptionTier;
        name: string;
        description: string | null;
        monthlyPrice: number;
        yearlyPrice: number;
        maxUsers: number | null;
        maxStudents: number | null;
        maxTeachers: number | null;
        maxStorageGb: number | null;
        features: Record<string, unknown>;
        limits: Record<string, unknown>;
        isActive: boolean;
        createdAt: string;
        updatedAt: string;
      }>>('/superuser/subscription-tiers', {
        method: 'PUT',
        body: JSON.stringify({ configs })
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
      }),
    // Subscriptions
    createSubscription: (payload: {
      tenantId: string;
      tier: 'free' | 'trial' | 'paid';
      status?: 'active' | 'suspended' | 'cancelled' | 'expired';
      billingPeriod?: 'monthly' | 'yearly' | 'quarterly' | 'annually';
      currentPeriodStart?: string;
      currentPeriodEnd?: string;
      trialEndDate?: string;
      customLimits?: Record<string, unknown>;
    }) =>
      apiFetch<{
        id: string;
        tenantId: string;
        tier: 'free' | 'trial' | 'paid';
        status: 'active' | 'suspended' | 'cancelled' | 'expired';
        billingPeriod: 'monthly' | 'yearly' | 'quarterly' | 'annually' | null;
        currentPeriodStart: Date | null;
        currentPeriodEnd: Date | null;
        trialEndDate: Date | null;
        customLimits: Record<string, unknown>;
        createdAt: Date;
        updatedAt: Date;
      }>('/superuser/subscriptions', {
        method: 'POST',
        body: JSON.stringify(payload)
      }),
    listSubscriptions: (filters?: {
      tier?: 'free' | 'trial' | 'paid';
      status?: 'active' | 'suspended' | 'cancelled' | 'expired';
      tenantId?: string;
    }) => {
      const params = buildQuery(filters);
      return apiFetch<Array<{
        id: string;
        tenantId: string;
        tier: 'free' | 'trial' | 'paid';
        status: 'active' | 'suspended' | 'cancelled' | 'expired';
        billingPeriod: 'monthly' | 'yearly' | 'quarterly' | 'annually' | null;
        currentPeriodStart: Date | null;
        currentPeriodEnd: Date | null;
        trialEndDate: Date | null;
        customLimits: Record<string, unknown>;
        createdAt: Date;
        updatedAt: Date;
      }>>(`/superuser/subscriptions${params}`);
    },
    getSubscription: (id: string) =>
      apiFetch<{
        id: string;
        tenantId: string;
        tier: 'free' | 'trial' | 'paid';
        status: 'active' | 'suspended' | 'cancelled' | 'expired';
        billingPeriod: 'monthly' | 'yearly' | 'quarterly' | 'annually' | null;
        currentPeriodStart: Date | null;
        currentPeriodEnd: Date | null;
        trialEndDate: Date | null;
        customLimits: Record<string, unknown>;
        createdAt: Date;
        updatedAt: Date;
      }>(`/superuser/subscriptions/${id}`),
    getSubscriptionByTenant: (tenantId: string) =>
      apiFetch<{
        id: string;
        tenantId: string;
        tier: 'free' | 'trial' | 'paid';
        status: 'active' | 'suspended' | 'cancelled' | 'expired';
        billingPeriod: 'monthly' | 'yearly' | 'quarterly' | 'annually' | null;
        currentPeriodStart: Date | null;
        currentPeriodEnd: Date | null;
        trialEndDate: Date | null;
        customLimits: Record<string, unknown>;
        createdAt: Date;
        updatedAt: Date;
      }>(`/superuser/subscriptions/tenant/${tenantId}`),
    updateSubscription: (id: string, payload: {
      tier?: 'free' | 'trial' | 'paid';
      status?: 'active' | 'suspended' | 'cancelled' | 'expired';
      billingPeriod?: 'monthly' | 'yearly' | 'quarterly' | 'annually';
      currentPeriodStart?: string;
      currentPeriodEnd?: string;
      trialEndDate?: string;
      customLimits?: Record<string, unknown>;
    }) =>
      apiFetch<{
        id: string;
        tenantId: string;
        tier: 'free' | 'trial' | 'paid';
        status: 'active' | 'suspended' | 'cancelled' | 'expired';
        billingPeriod: 'monthly' | 'yearly' | 'quarterly' | 'annually' | null;
        currentPeriodStart: Date | null;
        currentPeriodEnd: Date | null;
        trialEndDate: Date | null;
        customLimits: Record<string, unknown>;
        createdAt: Date;
        updatedAt: Date;
      }>(`/superuser/subscriptions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      }),
    suspendSubscription: (id: string, reason?: string) =>
      apiFetch<{
        id: string;
        tenantId: string;
        tier: 'free' | 'trial' | 'paid';
        status: 'active' | 'suspended' | 'cancelled' | 'expired';
        billingPeriod: 'monthly' | 'yearly' | 'quarterly' | 'annually' | null;
        currentPeriodStart: Date | null;
        currentPeriodEnd: Date | null;
        trialEndDate: Date | null;
        customLimits: Record<string, unknown>;
        createdAt: Date;
        updatedAt: Date;
      }>(`/superuser/subscriptions/${id}/suspend`, {
        method: 'POST',
        body: JSON.stringify({ reason })
      }),
    cancelSubscription: (id: string, reason?: string) =>
      apiFetch<{
        id: string;
        tenantId: string;
        tier: 'free' | 'trial' | 'paid';
        status: 'active' | 'suspended' | 'cancelled' | 'expired';
        billingPeriod: 'monthly' | 'yearly' | 'quarterly' | 'annually' | null;
        currentPeriodStart: Date | null;
        currentPeriodEnd: Date | null;
        trialEndDate: Date | null;
        customLimits: Record<string, unknown>;
        createdAt: Date;
        updatedAt: Date;
      }>(`/superuser/subscriptions/${id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason })
      }),
    getSubscriptionHistory: (id: string, limit?: number) => {
      const params = limit ? `?limit=${limit}` : '';
      return apiFetch<Array<{
        id: string;
        subscriptionId: string;
        changedBy: string | null;
        changeType: string;
        oldValue: Record<string, unknown> | null;
        newValue: Record<string, unknown> | null;
        reason: string | null;
        changedAt: Date;
      }>>(`/superuser/subscriptions/${id}/history${params}`);
    },
    // Overrides
    createOverride: (payload: {
      overrideType: 'user_status' | 'tenant_status' | 'subscription_limit' | 'feature_access' | 'quota_override' | 'rate_limit' | 'other';
      targetId: string;
      action: string;
      reason: string;
      expiresAt?: string;
      metadata?: Record<string, unknown>;
    }) =>
      apiFetch<{
        id: string;
        overrideType: string;
        targetId: string;
        action: string;
        reason: string;
        createdBy: string;
        expiresAt: Date | null;
        metadata: Record<string, unknown>;
        isActive: boolean;
        createdAt: Date;
        revokedAt: Date | null;
        revokedBy: string | null;
      }>('/superuser/overrides', {
        method: 'POST',
        body: JSON.stringify(payload)
      }),
    listOverrides: (filters?: {
      overrideType?: string;
      targetId?: string;
      isActive?: boolean;
      createdBy?: string;
    }) => {
      const params = buildQuery(filters);
      return apiFetch<Array<{
        id: string;
        overrideType: string;
        targetId: string;
        action: string;
        reason: string;
        createdBy: string;
        expiresAt: Date | null;
        metadata: Record<string, unknown>;
        isActive: boolean;
        createdAt: Date;
        revokedAt: Date | null;
        revokedBy: string | null;
      }>>(`/superuser/overrides${params}`);
    },
    getOverride: (id: string) =>
      apiFetch<{
        id: string;
        overrideType: string;
        targetId: string;
        action: string;
        reason: string;
        createdBy: string;
        expiresAt: Date | null;
        metadata: Record<string, unknown>;
        isActive: boolean;
        createdAt: Date;
        revokedAt: Date | null;
        revokedBy: string | null;
      }>(`/superuser/overrides/${id}`),
    getActiveOverridesForTarget: (overrideType: string, targetId: string) =>
      apiFetch<Array<{
        id: string;
        overrideType: string;
        targetId: string;
        action: string;
        reason: string;
        createdBy: string;
        expiresAt: Date | null;
        metadata: Record<string, unknown>;
        isActive: boolean;
        createdAt: Date;
        revokedAt: Date | null;
        revokedBy: string | null;
      }>>(`/superuser/overrides/target/${overrideType}/${targetId}`),
    revokeOverride: (id: string, reason?: string) =>
      apiFetch<{
        id: string;
        overrideType: string;
        targetId: string;
        action: string;
        reason: string;
        createdBy: string;
        expiresAt: Date | null;
        metadata: Record<string, unknown>;
        isActive: boolean;
        createdAt: Date;
        revokedAt: Date | null;
        revokedBy: string | null;
      }>(`/superuser/overrides/${id}/revoke`, {
        method: 'POST',
        body: JSON.stringify({ reason })
      }),
    // Permission Overrides
    grantPermissionOverride: (payload: {
      userId: string;
      permission: string;
      reason?: string;
      expiresAt?: string;
    }) =>
      apiFetch<{
        id: string;
        userId: string;
        permission: string;
        granted: boolean;
        grantedBy: string;
        reason: string | null;
        expiresAt: Date | null;
        createdAt: Date;
      }>('/superuser/permission-overrides/grant', {
        method: 'POST',
        body: JSON.stringify(payload)
      }),
    revokePermissionOverride: (payload: {
      userId: string;
      permission: string;
      reason?: string;
    }) =>
      apiFetch<void>('/superuser/permission-overrides/revoke', {
        method: 'POST',
        body: JSON.stringify(payload)
      }),
    listPermissionOverrides: (filters?: {
      userId?: string;
      permission?: string;
      grantedBy?: string;
    }) => {
      const params = buildQuery(filters);
      return apiFetch<Array<{
        id: string;
        userId: string;
        permission: string;
        granted: boolean;
        grantedBy: string;
        reason: string | null;
        expiresAt: Date | null;
        createdAt: Date;
      }>>(`/superuser/permission-overrides${params}`);
    },
    getPermissionOverridesForUser: (userId: string) =>
      apiFetch<Array<{
        id: string;
        userId: string;
        permission: string;
        granted: boolean;
        grantedBy: string;
        reason: string | null;
        expiresAt: Date | null;
        createdAt: Date;
      }>>(`/superuser/permission-overrides/user/${userId}`),
    // Session Management
    getLoginHistory: (userId: string, filters?: {
      tenantId?: string | null;
      startDate?: string;
      endDate?: string;
      isActive?: boolean;
      limit?: number;
      offset?: number;
    }) => {
      const queryParams: Record<string, string | number | boolean | string[] | undefined> = {};
      if (filters) {
        if (filters.tenantId !== undefined) queryParams.tenantId = filters.tenantId || undefined;
        if (filters.startDate !== undefined) queryParams.startDate = filters.startDate;
        if (filters.endDate !== undefined) queryParams.endDate = filters.endDate;
        if (filters.isActive !== undefined) queryParams.isActive = filters.isActive;
        if (filters.limit !== undefined) queryParams.limit = filters.limit;
        if (filters.offset !== undefined) queryParams.offset = filters.offset;
      }
      const params = buildQuery(queryParams);
      return apiFetch<{ sessions: UserSession[]; total: number }>(
        `/superuser/users/${userId}/login-history${params}`
      );
    },
    getSessions: (userId: string) =>
      apiFetch<{ sessions: UserSession[] }>(`/superuser/users/${userId}/sessions`),
    getAllActiveSessions: (filters?: {
      userId?: string;
      tenantId?: string | null;
      limit?: number;
      offset?: number;
    }) => {
      const queryParams: Record<string, string | number | undefined> = {};
      if (filters) {
        if (filters.userId !== undefined) queryParams.userId = filters.userId;
        if (filters.tenantId !== undefined) queryParams.tenantId = filters.tenantId === null ? 'null' : filters.tenantId;
        if (filters.limit !== undefined) queryParams.limit = filters.limit;
        if (filters.offset !== undefined) queryParams.offset = filters.offset;
      }
      const params = buildQuery(queryParams);
      return apiFetch<{ sessions: UserSession[]; total: number }>(
        `/superuser/sessions${params}`
      );
    },
    revokeSession: (userId: string, sessionId: string) =>
      apiFetch<{ message: string }>(`/superuser/users/${userId}/sessions/${sessionId}/revoke`, {
        method: 'POST'
      }),
    revokeAllSessions: (userId: string, exceptSessionId?: string) =>
      apiFetch<{ message: string; revokedCount?: number }>(
        `/superuser/users/${userId}/sessions/revoke-all`,
        {
          method: 'POST',
          body: JSON.stringify({ exceptSessionId })
        }
      ),
    getLoginAttempts: (filters?: {
      email?: string;
      userId?: string;
      tenantId?: string | null;
      success?: boolean;
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    }) => {
      const queryParams: Record<string, string | number | boolean | undefined> = {};
      if (filters) {
        if (filters.email !== undefined) queryParams.email = filters.email;
        if (filters.userId !== undefined) queryParams.userId = filters.userId;
        if (filters.tenantId !== undefined) queryParams.tenantId = filters.tenantId === null ? 'null' : filters.tenantId;
        if (filters.success !== undefined) queryParams.success = filters.success;
        if (filters.startDate !== undefined) queryParams.startDate = filters.startDate;
        if (filters.endDate !== undefined) queryParams.endDate = filters.endDate;
        if (filters.limit !== undefined) queryParams.limit = filters.limit;
        if (filters.offset !== undefined) queryParams.offset = filters.offset;
      }
      const params = buildQuery(queryParams);
      return apiFetch<{ attempts: LoginAttemptRecord[]; total: number }>(
        `/superuser/login-attempts${params}`
      );
    },
    // Password Management
    resetPassword: (userId: string, payload?: { reason?: string }) =>
      apiFetch<{ message: string; temporaryPassword: string }>(
        `/superuser/users/${userId}/reset-password`,
        {
          method: 'POST',
          body: JSON.stringify(payload || {})
        }
      ),
    changePassword: (userId: string, payload: { newPassword: string; reason?: string }) =>
      apiFetch<{ message: string }>(`/superuser/users/${userId}/change-password`, {
        method: 'POST',
        body: JSON.stringify(payload)
      }),
    getPasswordHistory: (userId: string, filters?: {
      tenantId?: string | null;
      changeType?: 'self_reset' | 'admin_reset' | 'admin_change' | 'forced_reset';
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    }) => {
      const queryParams: Record<string, string | number | boolean | string[] | undefined> = {};
      if (filters) {
        if (filters.tenantId !== undefined) queryParams.tenantId = filters.tenantId || undefined;
        if (filters.changeType !== undefined) queryParams.changeType = filters.changeType;
        if (filters.startDate !== undefined) queryParams.startDate = filters.startDate;
        if (filters.endDate !== undefined) queryParams.endDate = filters.endDate;
        if (filters.limit !== undefined) queryParams.limit = filters.limit;
        if (filters.offset !== undefined) queryParams.offset = filters.offset;
      }
      const params = buildQuery(queryParams);
      return apiFetch<{ history: PasswordChangeHistory[]; total: number }>(
        `/superuser/users/${userId}/password-history${params}`
      );
    },
    // Audit Logs
    getPlatformAuditLogs: (filters?: {
      tenantId?: string;
      userId?: string;
      action?: string;
      resourceType?: string;
      resourceId?: string;
      severity?: 'info' | 'warning' | 'error' | 'critical';
      tags?: string[];
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    }) => {
      const queryParams: Record<string, string | number | boolean | string[] | undefined> = {};
      if (filters) {
        if (filters.tenantId !== undefined) queryParams.tenantId = filters.tenantId;
        if (filters.userId !== undefined) queryParams.userId = filters.userId;
        if (filters.action !== undefined) queryParams.action = filters.action;
        if (filters.resourceType !== undefined) queryParams.resourceType = filters.resourceType;
        if (filters.resourceId !== undefined) queryParams.resourceId = filters.resourceId;
        if (filters.severity !== undefined) queryParams.severity = filters.severity;
        if (filters.tags !== undefined && filters.tags.length > 0) {
          // Backend expects comma-separated string, not array
          queryParams.tags = filters.tags.join(',');
        }
        if (filters.startDate !== undefined) queryParams.startDate = filters.startDate;
        if (filters.endDate !== undefined) queryParams.endDate = filters.endDate;
        if (filters.limit !== undefined) queryParams.limit = filters.limit;
        if (filters.offset !== undefined) queryParams.offset = filters.offset;
      }
      const params = buildQuery(queryParams);
      return apiFetch<{ logs: AuditLogEntry[]; total: number }>(
        `/superuser/audit-logs${params}`
      );
    },
    exportPlatformAuditLogs: (filters?: {
      tenantId?: string;
      userId?: string;
      action?: string;
      resourceType?: string;
      resourceId?: string;
      severity?: 'info' | 'warning' | 'error' | 'critical';
      tags?: string[];
      startDate?: string;
      endDate?: string;
      format?: 'csv' | 'json';
    }) => {
      const queryParams: Record<string, string | number | boolean | string[] | undefined> = {
        format: filters?.format || 'json'
      };
      if (filters) {
        if (filters.tenantId !== undefined) queryParams.tenantId = filters.tenantId;
        if (filters.userId !== undefined) queryParams.userId = filters.userId;
        if (filters.action !== undefined) queryParams.action = filters.action;
        if (filters.resourceType !== undefined) queryParams.resourceType = filters.resourceType;
        if (filters.resourceId !== undefined) queryParams.resourceId = filters.resourceId;
        if (filters.severity !== undefined) queryParams.severity = filters.severity;
        if (filters.tags !== undefined && filters.tags.length > 0) {
          // Backend expects comma-separated string, not array
          queryParams.tags = filters.tags.join(',');
        }
        if (filters.startDate !== undefined) queryParams.startDate = filters.startDate;
        if (filters.endDate !== undefined) queryParams.endDate = filters.endDate;
      }
      const params = buildQuery(queryParams);
      return apiFetch<Blob>(`/superuser/audit-logs/export${params}`, {
        responseType: 'blob'
      });
    },
    // Investigation Management
    createCase: (payload: {
      title: string;
      description?: string;
      priority?: 'low' | 'medium' | 'high' | 'critical';
      caseType: 'anomaly' | 'security' | 'compliance' | 'abuse' | 'other';
      relatedUserId?: string;
      relatedTenantId?: string | null;
      assignedTo?: string;
      tags?: string[];
      metadata?: Record<string, unknown>;
    }) =>
      apiFetch<InvestigationCase>(`/superuser/investigations/cases`, {
        method: 'POST',
        body: JSON.stringify(payload)
      }),
    getCases: (filters?: {
      status?: 'open' | 'investigating' | 'resolved' | 'closed';
      priority?: 'low' | 'medium' | 'high' | 'critical';
      caseType?: 'anomaly' | 'security' | 'compliance' | 'abuse' | 'other';
      relatedUserId?: string;
      relatedTenantId?: string | null;
      assignedTo?: string;
      createdBy?: string;
      tags?: string[];
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    }) => {
      const queryParams: Record<string, string | number | undefined> = {};
      if (filters) {
        if (filters.status !== undefined) queryParams.status = filters.status;
        if (filters.priority !== undefined) queryParams.priority = filters.priority;
        if (filters.caseType !== undefined) queryParams.caseType = filters.caseType;
        if (filters.relatedUserId !== undefined) queryParams.relatedUserId = filters.relatedUserId;
        if (filters.relatedTenantId !== undefined) queryParams.relatedTenantId = filters.relatedTenantId === null ? 'null' : filters.relatedTenantId;
        if (filters.assignedTo !== undefined) queryParams.assignedTo = filters.assignedTo;
        if (filters.createdBy !== undefined) queryParams.createdBy = filters.createdBy;
        if (filters.tags !== undefined) queryParams.tags = filters.tags.join(',');
        if (filters.startDate !== undefined) queryParams.startDate = filters.startDate;
        if (filters.endDate !== undefined) queryParams.endDate = filters.endDate;
        if (filters.limit !== undefined) queryParams.limit = filters.limit;
        if (filters.offset !== undefined) queryParams.offset = filters.offset;
      }
      const params = buildQuery(queryParams);
      return apiFetch<{ cases: InvestigationCase[]; total: number }>(`/superuser/investigations/cases${params}`);
    },
    getCase: (caseId: string) =>
      apiFetch<{ case: InvestigationCase; notes: CaseNote[]; evidence: CaseEvidence[] }>(
        `/superuser/investigations/cases/${caseId}`
      ),
    updateCaseStatus: (caseId: string, payload: {
      status: 'open' | 'investigating' | 'resolved' | 'closed';
      resolution?: string;
      resolutionNotes?: string;
    }) =>
      apiFetch<InvestigationCase>(`/superuser/investigations/cases/${caseId}/status`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      }),
    addCaseNote: (caseId: string, payload: {
      note: string;
      noteType?: 'note' | 'finding' | 'evidence' | 'action';
      metadata?: Record<string, unknown>;
    }) =>
      apiFetch<CaseNote>(`/superuser/investigations/cases/${caseId}/notes`, {
        method: 'POST',
        body: JSON.stringify(payload)
      }),
    addCaseEvidence: (caseId: string, payload: {
      evidenceType: 'audit_log' | 'session' | 'login_attempt' | 'password_change' | 'file' | 'other';
      evidenceId: string;
      evidenceSource: string;
      description?: string;
      metadata?: Record<string, unknown>;
    }) =>
      apiFetch<CaseEvidence>(`/superuser/investigations/cases/${caseId}/evidence`, {
        method: 'POST',
        body: JSON.stringify(payload)
      }),
    detectAnomalies: (filters?: {
      userId?: string;
      tenantId?: string | null;
      startDate?: string;
      endDate?: string;
    }) => {
      const queryParams: Record<string, string | undefined> = {};
      if (filters) {
        if (filters.userId !== undefined) queryParams.userId = filters.userId;
        if (filters.tenantId !== undefined) queryParams.tenantId = filters.tenantId === null ? 'null' : filters.tenantId;
        if (filters.startDate !== undefined) queryParams.startDate = filters.startDate;
        if (filters.endDate !== undefined) queryParams.endDate = filters.endDate;
      }
      const params = buildQuery(queryParams);
      return apiFetch<{ anomalies: AnomalyDetectionResult[] }>(`/superuser/investigations/anomalies${params}`);
    },
    getUserActions: (userId: string, filters?: {
      tenantId?: string | null;
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    }) => {
      const queryParams: Record<string, string | number | undefined> = {};
      if (filters) {
        if (filters.tenantId !== undefined) queryParams.tenantId = filters.tenantId === null ? 'null' : filters.tenantId;
        if (filters.startDate !== undefined) queryParams.startDate = filters.startDate;
        if (filters.endDate !== undefined) queryParams.endDate = filters.endDate;
        if (filters.limit !== undefined) queryParams.limit = filters.limit;
        if (filters.offset !== undefined) queryParams.offset = filters.offset;
      }
      const params = buildQuery(queryParams);
      return apiFetch<{ actions: AuditLogEntry[]; total: number }>(`/superuser/investigations/users/${userId}/actions${params}`);
    },
    exportCaseAuditTrail: (caseId: string, format: 'csv' | 'pdf' | 'json' = 'json') => {
      return apiFetch<Blob>(`/superuser/investigations/cases/${caseId}/export?format=${format}`, {
        responseType: 'blob'
      });
    },
    // Maintenance Operations
    runMigrations: (tenantId?: string | null) =>
      apiFetch<{
        success: boolean;
        message: string;
        data: {
          success: boolean;
          migrationsRun: number;
          errors: string[];
          duration: number;
        };
      }>('/superuser/maintenance/run-migrations', {
        method: 'POST',
        body: JSON.stringify({ tenantId: tenantId || null })
      }),
    clearCache: (schoolId: string) =>
      apiFetch<{
        success: boolean;
        message: string;
        data: {
          success: boolean;
          clearedKeys: number;
          errors: string[];
        };
      }>(`/superuser/maintenance/clear-cache/${schoolId}`, {
        method: 'POST'
      }),
    checkSchemaHealth: (tenantId?: string | null) => {
      const params = tenantId ? `?tenantId=${tenantId}` : '';
      return apiFetch<{
        success: boolean;
        data: Array<{
          tenantId: string;
          schemaName: string;
          status: 'healthy' | 'degraded' | 'unhealthy';
          issues: string[];
          tableCount: number;
          lastMigration?: string;
        }>;
        summary: {
          total: number;
          healthy: number;
          degraded: number;
          unhealthy: number;
        };
      }>(`/superuser/maintenance/schema-health${params}`);
    }
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
      payload: { classId: string; subjectId: string; isClassTeacher?: boolean }
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
      }),
    deleteExam: (examId: string) =>
      apiFetch<void>(`/exams/${examId}`, {
        method: 'DELETE'
      }),
    assignHODDepartment: (userId: string, department: string) =>
      apiFetch<{ message: string }>(`/admin/users/${userId}/department`, {
        method: 'PUT',
        body: JSON.stringify({ department })
      }),
    bulkRemoveHODRoles: (userIds: string[]) =>
      apiFetch<{ message: string; removed: number; failed: number }>(`/admin/users/hod/bulk`, {
        method: 'DELETE',
        body: JSON.stringify({ userIds })
      }),
    requestClassChange: (studentId: string, payload: { targetClassId: string; reason?: string }) =>
      apiFetch<{
        id: string;
        student_id: string;
        current_class_id: string | null;
        requested_class_id: string;
        status: 'pending' | 'approved' | 'rejected';
        reason?: string;
        created_at: string;
      }>(`/students/${studentId}/class-change-request`, {
        method: 'POST',
        body: JSON.stringify(payload)
      }),
    // Dashboard
    getDashboard: () => apiFetch<{
      users: {
        teachers: number;
        students: number;
        hods: number;
        activeTeachers: number;
        activeStudents: number;
      };
      departments: number;
      classes: number;
      students: number;
      activity: {
        last7Days: number;
        loginsLast7Days: number;
      };
    }>('/admin/dashboard'),
    // Overview - Aggregated dashboard data
    getOverview: () => apiFetch<{
      school: {
        id: string;
        name: string;
        address: Record<string, unknown> | null;
        createdAt: string;
      } | null;
      totals: {
        users: number;
        teachers: number;
        hods: number;
        students: number;
        admins: number;
        pending: number;
      };
      roleDistribution: Record<string, number>;
      statusDistribution: Record<string, number>;
      activeSessionsCount: number;
      failedLoginAttemptsCount: number;
      recentUsers: Array<{
        id: string;
        email: string;
        role: string;
        status: string | null;
        createdAt: string;
      }>;
      recentTeachers: Array<{
        id: string;
        name: string;
        email: string;
        createdAt: string;
      }>;
      recentStudents: Array<{
        id: string;
        firstName: string;
        lastName: string;
        admissionNumber: string;
        classId: string | null;
        createdAt: string;
      }>;
      classes: Array<{
        id: string;
        name: string;
        level: string | null;
        studentCount?: number;
      }>;
    }>('/admin/overview'),
    // Departments
    listDepartments: (includeCounts?: boolean) => {
      const params = includeCounts === false ? '?includeCounts=false' : '';
      return apiFetch<Array<{
        id: string;
        name: string;
        slug: string;
        contactEmail: string | null;
        contactPhone: string | null;
        hodCount?: number;
        teacherCount?: number;
        createdAt: string;
        updatedAt: string;
      }>>(`/admin/departments${params}`);
    },
    getDepartment: (id: string) => apiFetch<{
      id: string;
      name: string;
      slug: string;
      contactEmail: string | null;
      contactPhone: string | null;
      createdAt: string;
      updatedAt: string;
    }>(`/admin/departments/${id}`),
    createDepartment: (payload: {
      name: string;
      slug?: string;
      contactEmail?: string;
      contactPhone?: string;
      metadata?: Record<string, unknown>;
    }) => apiFetch<{
      id: string;
      name: string;
      slug: string;
      contactEmail: string | null;
      contactPhone: string | null;
      createdAt: string;
      updatedAt: string;
    }>('/admin/departments', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
    updateDepartment: (id: string, payload: Partial<{
      name: string;
      slug?: string;
      contactEmail?: string;
      contactPhone?: string;
      metadata?: Record<string, unknown>;
    }>) => apiFetch<{
      id: string;
      name: string;
      slug: string;
      contactEmail: string | null;
      contactPhone: string | null;
      createdAt: string;
      updatedAt: string;
    }>(`/admin/departments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }),
    deleteDepartment: (id: string) => apiFetch<void>(`/admin/departments/${id}`, {
      method: 'DELETE'
    }),
    assignHODToDepartment: (departmentId: string, userId: string) => apiFetch<{ message: string }>(
      `/admin/departments/${departmentId}/assign-hod`,
      {
        method: 'PATCH',
        body: JSON.stringify({ userId })
      }
    ),
    // Classes
    listClasses: (includeCounts?: boolean) => {
      const params = includeCounts === false ? '?includeCounts=false' : '';
      return apiFetch<Array<{
        id: string;
        name: string;
        description: string | null;
        gradeLevel: string | null;
        section: string | null;
        departmentId: string | null;
        classTeacherId: string | null;
        capacity: number | null;
        academicYear: string | null;
        studentCount?: number;
        teacherName?: string;
        createdAt: string;
        updatedAt: string;
      }>>(`/admin/classes${params}`);
    },
    getClass: (id: string) => apiFetch<{
      id: string;
      name: string;
      description: string | null;
      gradeLevel: string | null;
      section: string | null;
      departmentId: string | null;
      classTeacherId: string | null;
      capacity: number | null;
      academicYear: string | null;
      createdAt: string;
      updatedAt: string;
    }>(`/admin/classes/${id}`),
    createClass: (payload: {
      name: string;
      description?: string;
      gradeLevel?: string;
      section?: string;
      departmentId?: string;
      capacity?: number;
      academicYear?: string;
      metadata?: Record<string, unknown>;
    }) => apiFetch<{
      id: string;
      name: string;
      description: string | null;
      gradeLevel: string | null;
      section: string | null;
      departmentId: string | null;
      classTeacherId: string | null;
      capacity: number | null;
      academicYear: string | null;
      createdAt: string;
      updatedAt: string;
    }>('/admin/classes', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
    updateClass: (id: string, payload: Partial<{
      name: string;
      description?: string;
      gradeLevel?: string;
      section?: string;
      departmentId?: string;
      capacity?: number;
      academicYear?: string;
      metadata?: Record<string, unknown>;
    }>) => apiFetch<{
      id: string;
      name: string;
      description: string | null;
      gradeLevel: string | null;
      section: string | null;
      departmentId: string | null;
      classTeacherId: string | null;
      capacity: number | null;
      academicYear: string | null;
      createdAt: string;
      updatedAt: string;
    }>(`/admin/classes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }),
    deleteClass: (id: string) => apiFetch<void>(`/admin/classes/${id}`, {
      method: 'DELETE'
    }),
    assignClassTeacher: (classId: string, teacherUserId: string) => apiFetch<{ message: string }>(
      `/admin/classes/${classId}/assign-teacher`,
      {
        method: 'PATCH',
        body: JSON.stringify({ teacherUserId })
      }
    ),
    assignStudentsToClass: (classId: string, studentIds: string[]) => apiFetch<{
      assigned: number;
      failed: number;
    }>(`/admin/classes/${classId}/assign-students`, {
      method: 'POST',
      body: JSON.stringify({ studentIds })
    }),
    // User Management
    createHOD: (payload: {
      email: string;
      password: string;
      fullName: string;
      phone?: string;
      departmentId?: string;
      qualifications?: string;
      yearsOfExperience?: number;
      subjects?: string[];
    }) => apiFetch<{
      userId: string;
      profileId: string;
      email: string;
      role: string;
      status: 'active';
    }>('/admin/users/hod/create', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
    createTeacher: (payload: {
      email: string;
      password: string;
      fullName: string;
      phone?: string;
      qualifications?: string;
      yearsOfExperience?: number;
      subjects?: string[];
      teacherId?: string;
    }) => apiFetch<{
      userId: string;
      profileId: string;
      email: string;
      role: string;
      status: 'active';
    }>('/admin/users/teacher/create', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
    createStudent: (payload: {
      email: string;
      password: string;
      fullName: string;
      gender?: 'male' | 'female' | 'other';
      dateOfBirth?: string;
      parentGuardianName?: string;
      parentGuardianContact?: string;
      studentId?: string;
      classId?: string;
    }) => apiFetch<{
      userId: string;
      profileId: string;
      email: string;
      role: string;
      status: 'active';
    }>('/admin/users/student/create', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
    listUsers: (filters?: { role?: string; status?: string }) => {
      const params = new URLSearchParams();
      if (filters?.role) params.append('role', filters.role);
      if (filters?.status) params.append('status', filters.status);
      const query = params.toString();
      return apiFetch<Array<{
        id: string;
        email: string;
        role: string;
        status: string;
        isVerified: boolean;
        createdAt: string;
      }>>(`/admin/users${query ? `?${query}` : ''}`);
    },
    disableUser: (id: string) => apiFetch<{ message: string }>(`/admin/users/${id}/disable`, {
      method: 'PATCH'
    }),
    enableUser: (id: string) => apiFetch<{ message: string }>(`/admin/users/${id}/enable`, {
      method: 'PATCH'
    }),
    // Reports
    getActivityReport: (filters?: {
      startDate?: string;
      endDate?: string;
      userId?: string;
      action?: string;
      limit?: number;
      offset?: number;
    }) => {
      const params = new URLSearchParams();
      if (filters?.startDate) params.append('startDate', filters.startDate);
      if (filters?.endDate) params.append('endDate', filters.endDate);
      if (filters?.userId) params.append('userId', filters.userId);
      if (filters?.action) params.append('action', filters.action);
      if (filters?.limit) params.append('limit', String(filters.limit));
      if (filters?.offset) params.append('offset', String(filters.offset));
      const query = params.toString();
      return apiFetch<{
        logs: Array<{
          id: string;
          userId: string;
          action: string;
          resourceType: string;
          resourceId: string;
          details: Record<string, unknown>;
          createdAt: string;
        }>;
        total: number;
      }>(`/admin/reports/activity${query ? `?${query}` : ''}`);
    },
    getLoginReport: (filters?: {
      startDate?: string;
      endDate?: string;
      userId?: string;
      limit?: number;
      offset?: number;
    }) => {
      const params = new URLSearchParams();
      if (filters?.startDate) params.append('startDate', filters.startDate);
      if (filters?.endDate) params.append('endDate', filters.endDate);
      if (filters?.userId) params.append('userId', filters.userId);
      if (filters?.limit) params.append('limit', String(filters.limit));
      if (filters?.offset) params.append('offset', String(filters.offset));
      const query = params.toString();
      return apiFetch<{
        logins: Array<{
          id: string;
          userId: string;
          ipAddress: string;
          userAgent: string;
          loginAt: string;
          success: boolean;
          failureReason: string | null;
        }>;
        total: number;
      }>(`/admin/reports/logins${query ? `?${query}` : ''}`);
    },
    getPerformanceReport: (filters?: {
      classId?: string;
      subjectId?: string;
      academicYear?: string;
    }) => {
      const params = new URLSearchParams();
      if (filters?.classId) params.append('classId', filters.classId);
      if (filters?.subjectId) params.append('subjectId', filters.subjectId);
      if (filters?.academicYear) params.append('academicYear', filters.academicYear);
      const query = params.toString();
      return apiFetch<{
        classSubjectPerformance: Array<{
          class_name: string;
          subject: string;
          exam_count: number;
          avg_score: number;
          min_score: number;
          max_score: number;
        }>;
        topStudents: Array<{
          student_id: string;
          student_name: string;
          class_name: string;
          exams_taken: number;
          avg_score: number;
        }>;
      }>(`/admin/reports/performance${query ? `?${query}` : ''}`);
    },
    // Notifications
    createAnnouncement: (payload: {
      title: string;
      content: string;
      targetRoles: Array<'admin' | 'hod' | 'teacher' | 'student'>;
      priority?: 'low' | 'normal' | 'high' | 'urgent';
      expiresAt?: string;
    }) => apiFetch<{ id: string }>('/admin/announcements', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
    listAnnouncements: (filters?: {
      limit?: number;
      offset?: number;
      targetRole?: 'admin' | 'hod' | 'teacher' | 'student';
    }) => {
      const params = new URLSearchParams();
      if (filters?.limit) params.append('limit', String(filters.limit));
      if (filters?.offset) params.append('offset', String(filters.offset));
      if (filters?.targetRole) params.append('targetRole', filters.targetRole);
      const query = params.toString();
      return apiFetch<{
        announcements: Array<{
          id: string;
          title: string;
          content: string;
          targetRoles: string[];
          priority: string;
          createdBy: string;
          createdAt: string;
          expiresAt: string | null;
        }>;
        total: number;
      }>(`/admin/announcements${query ? `?${query}` : ''}`);
    }
  },
  // HOD endpoints
  hod: {
    getDashboard: () => apiFetch<{
      department: { id: string; name: string };
      teachers: { total: number; active: number; bySubject: Array<{ subject: string; count: number }> };
      classes: { total: number; byLevel: Array<{ level: string; count: number }> };
      performance: { avgScore: number; totalExams: number; recentActivity: number };
    }>('/hod/dashboard'),
    listTeachers: (filters?: { search?: string; subject?: string }) => {
      const params = new URLSearchParams();
      if (filters?.search) params.append('search', filters.search);
      if (filters?.subject) params.append('subject', filters.subject);
      const query = params.toString();
      return apiFetch<Array<{
        id: string;
        name: string;
        email: string | null;
        subjects: string[];
        classes: string[];
        lastActive: string | null;
        performanceScore?: number;
      }>>(`/hod/teachers${query ? `?${query}` : ''}`);
    },
    getDepartmentReport: (filters?: { term?: string; classId?: string; subjectId?: string }) => {
      const params = new URLSearchParams();
      if (filters?.term) params.append('term', filters.term);
      if (filters?.classId) params.append('classId', filters.classId);
      if (filters?.subjectId) params.append('subjectId', filters.subjectId);
      const query = params.toString();
      return apiFetch<{
        department: { id: string; name: string };
        summary: { teachers: number; classes: number; students: number };
        performance: { avgScore: number; topPerformingClass: string | null; improvementTrend: number };
        activity: { last7Days: number; last30Days: number };
      }>(`/hod/reports/department${query ? `?${query}` : ''}`);
    }
  },
  /**
   * @deprecated Legacy teacher API endpoints.
   * 
   * Migration guide:
   * - getOverview() → Still needed for assignments data. Consider combining with teachers.getMe() in future.
   * - listClasses() → Use teachers.getMyClasses() instead
   * - getClassRoster() → Use teachers.getMyStudents({ classId }) instead
   * - getProfile() → Use teachers.getMe() instead
   * 
   * These methods will be removed in a future version once all consumers are migrated.
   */
  teacher: {
    /** @deprecated Still needed for assignments. Consider migrating to combined endpoint. */
    getOverview: () => apiFetch<TeacherOverview>('/teacher/overview'),
    /** @deprecated Use teachers.getMyClasses() instead */
    listClasses: () => apiFetch<TeacherClassSummary[]>('/teacher/classes'),
    /** @deprecated Use teachers.getMyStudents({ classId }) instead */
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
    /** @deprecated Use teachers.getMe() instead */
    getProfile: () => apiFetch<TeacherProfileDetail>('/teacher/profile')
  },
  teachers: {
    getMe: () => apiFetch<TeacherProfile>('/teachers/me'),
    getMyClasses: () => apiFetch<TeacherClassInfo[]>('/teachers/me/classes'),
    getMyStudents: (params?: { classId?: string; limit?: number; offset?: number }) => {
      const queryParams = new URLSearchParams();
      if (params?.classId) queryParams.append('classId', params.classId);
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.offset) queryParams.append('offset', params.offset.toString());
      const queryString = queryParams.toString();
      return apiFetch<PaginatedResponse<TeacherStudent>>(
        `/teachers/me/students${queryString ? `?${queryString}` : ''}`
      );
    },
    // Phase 7: Attendance
    markAttendance: (records: Array<{
      studentId: string;
      classId: string;
      status: 'present' | 'absent' | 'late';
      date: string;
    }>) => apiFetch<{ success: boolean }>('/teachers/attendance/mark', {
      method: 'POST',
      body: JSON.stringify({ records })
    }),
    getAttendance: (params?: { classId?: string; date?: string; from?: string; to?: string }) => {
      const queryParams = new URLSearchParams();
      if (params?.classId) queryParams.append('classId', params.classId);
      if (params?.date) queryParams.append('date', params.date);
      if (params?.from) queryParams.append('from', params.from);
      if (params?.to) queryParams.append('to', params.to);
      const queryString = queryParams.toString();
      return apiFetch<Array<{
        id: string;
        student_id: string;
        class_id: string;
        status: string;
        attendance_date: string;
        first_name: string;
        last_name: string;
        admission_number: string | null;
      }>>(`/teachers/attendance${queryString ? `?${queryString}` : ''}`);
    },
    bulkMarkAttendance: (records: Array<{
      studentId: string;
      classId: string;
      status: 'present' | 'absent' | 'late';
      date: string;
    }>) => apiFetch<{ success: boolean }>('/teachers/attendance/bulk', {
      method: 'POST',
      body: JSON.stringify({ records })
    }),
    // Phase 7: Grades
    submitGrades: (grades: Array<{
      studentId: string;
      classId: string;
      subjectId?: string;
      examId?: string;
      score: number;
      remarks?: string;
      term?: string;
    }>) => apiFetch<Array<{ id: string; studentId: string; score: number }>>('/teachers/grades/submit', {
      method: 'POST',
      body: JSON.stringify({ grades })
    }),
    updateGrade: (gradeId: string, updates: { score?: number; remarks?: string }) =>
      apiFetch<{ id: string; studentId: string; score: number }>(`/teachers/grades/${gradeId}`, {
        method: 'PUT',
        body: JSON.stringify(updates)
      }),
    getGrades: (params?: { classId?: string; subjectId?: string; examId?: string; term?: string }) => {
      const queryParams = new URLSearchParams();
      if (params?.classId) queryParams.append('classId', params.classId);
      if (params?.subjectId) queryParams.append('subjectId', params.subjectId);
      if (params?.examId) queryParams.append('examId', params.examId);
      if (params?.term) queryParams.append('term', params.term);
      const queryString = queryParams.toString();
      return apiFetch<Array<{
        id: string;
        student_id: string;
        class_id: string;
        subject_id: string | null;
        exam_id: string | null;
        score: number;
        grade: string | null;
        remarks: string | null;
        first_name: string;
        last_name: string;
        admission_number: string | null;
      }>>(`/teachers/grades${queryString ? `?${queryString}` : ''}`);
    },
    // Phase 7: Resources
    uploadResource: (formData: FormData) => apiFetch<{
      id: string;
      tenant_id: string;
      teacher_id: string;
      class_id: string;
      title: string;
      description: string | null;
      file_url: string;
      file_type: string;
      size: number;
      created_at: string;
    }>('/teachers/resources/upload', {
      method: 'POST',
      body: formData
    }),
    getResources: (classId: string) =>
      apiFetch<Array<{
        id: string;
        tenant_id: string;
        teacher_id: string;
        class_id: string;
        title: string;
        description: string | null;
        file_url: string;
        file_type: string;
        size: number;
        created_at: string;
      }>>(`/teachers/resources?classId=${classId}`),
    deleteResource: (resourceId: string) =>
      apiFetch<{ success: boolean }>(`/teachers/resources/${resourceId}`, {
        method: 'DELETE'
      }),
    // Phase 7: Announcements
    postAnnouncement: (announcement: {
      classId: string;
      message: string;
      attachments?: Array<{ filename: string; url: string }>;
    }) => apiFetch<{
      id: string;
      tenant_id: string;
      class_id: string;
      teacher_id: string;
      message: string;
      attachments: Array<{ filename: string; url: string }> | null;
      created_at: string;
    }>('/teachers/announcements', {
      method: 'POST',
      body: JSON.stringify(announcement)
    }),
    // Phase 7: Exports
    exportAttendance: (params: {
      classId: string;
      format?: 'pdf' | 'excel' | 'xlsx';
      date?: string;
      from?: string;
      to?: string;
    }) => {
      const queryParams = new URLSearchParams();
      queryParams.append('classId', params.classId);
      if (params.format) queryParams.append('format', params.format);
      if (params.date) queryParams.append('date', params.date);
      if (params.from) queryParams.append('from', params.from);
      if (params.to) queryParams.append('to', params.to);
      return apiFetch<Blob>(`/teachers/export/attendance?${queryParams.toString()}`, {
        responseType: 'blob'
      });
    },
    exportGrades: (params: {
      classId: string;
      format?: 'pdf' | 'excel' | 'xlsx';
      subjectId?: string;
      examId?: string;
      term?: string;
    }) => {
      const queryParams = new URLSearchParams();
      queryParams.append('classId', params.classId);
      if (params.format) queryParams.append('format', params.format);
      if (params.subjectId) queryParams.append('subjectId', params.subjectId);
      if (params.examId) queryParams.append('examId', params.examId);
      if (params.term) queryParams.append('term', params.term);
      return apiFetch<Blob>(`/teachers/export/grades?${queryParams.toString()}`, {
        responseType: 'blob'
      });
    }
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
  // Advanced Reports
  reports: {
    // Report Definitions
    createReportDefinition: (payload: {
      tenantId?: string;
      name: string;
      description?: string;
      reportType: 'attendance' | 'grades' | 'fees' | 'users' | 'analytics' | 'custom';
      dataSource: string;
      queryTemplate: string;
      parameters?: Record<string, unknown>;
      columns?: Array<{ name: string; type: string; label: string }>;
      filters?: Record<string, unknown>;
      rolePermissions?: string[];
    }) =>
      apiFetch<{ id: string }>('/superuser/reports/definitions', {
        method: 'POST',
        body: JSON.stringify(payload)
      }),
    getReportDefinitions: (tenantId?: string) => {
      const params = tenantId ? `?tenantId=${tenantId}` : '';
      return apiFetch<{ reports: unknown[] }>(`/superuser/reports/definitions${params}`);
    },
    getReportDefinition: (id: string, tenantId?: string) => {
      const params = tenantId ? `?tenantId=${tenantId}` : '';
      return apiFetch<unknown>(`/superuser/reports/definitions/${id}${params}`);
    },
    executeReport: (reportId: string, parameters?: Record<string, unknown>) =>
      apiFetch<{
        executionId: string;
        data: unknown[];
        rowCount: number;
        executionTimeMs: number;
        columns: Array<{ name: string; type: string; label: string }>;
      }>(`/superuser/reports/definitions/${reportId}/execute`, {
        method: 'POST',
        body: JSON.stringify({ parameters })
      }),
    getHistoricalTrend: (reportId: string, days?: number) => {
      const params = days ? `?days=${days}` : '';
      return apiFetch<{ trends: unknown[] }>(`/superuser/reports/definitions/${reportId}/trends${params}`);
    },
    compareWithHistory: (reportId: string, payload: {
      parameters?: Record<string, unknown>;
      comparisonDays?: number;
    }) =>
      apiFetch<{
        current: unknown;
        comparison: unknown;
      }>(`/superuser/reports/definitions/${reportId}/compare`, {
        method: 'POST',
        body: JSON.stringify(payload)
      }),
    // Scheduled Reports
    createScheduledReport: (payload: {
      reportDefinitionId: string;
      name: string;
      scheduleType: 'daily' | 'weekly' | 'monthly' | 'custom';
      scheduleConfig: Record<string, unknown>;
      parameters?: Record<string, unknown>;
      exportFormat: 'csv' | 'pdf' | 'excel' | 'json';
      recipients: string[];
    }) =>
      apiFetch<{ id: string }>('/superuser/reports/scheduled', {
        method: 'POST',
        body: JSON.stringify(payload)
      }),
    getScheduledReports: () =>
      apiFetch<{ scheduledReports: unknown[] }>('/superuser/reports/scheduled'),
    updateScheduledReport: (id: string, updates: {
      name?: string;
      scheduleType?: 'daily' | 'weekly' | 'monthly' | 'custom';
      scheduleConfig?: Record<string, unknown>;
      parameters?: Record<string, unknown>;
      exportFormat?: 'csv' | 'pdf' | 'excel' | 'json';
      recipients?: string[];
      isActive?: boolean;
    }) =>
      apiFetch<unknown>(`/superuser/reports/scheduled/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates)
      }),
    deleteScheduledReport: (id: string) =>
      apiFetch<void>(`/superuser/reports/scheduled/${id}`, {
        method: 'DELETE'
      }),
    // Custom Reports
    createCustomReport: (payload: {
      name: string;
      description?: string;
      baseTemplateId?: string;
      dataSources: string[];
      joins?: Array<{ type: 'inner' | 'left' | 'right' | 'full'; table: string; on: string }>;
      selectedColumns: Array<{ table: string; column: string; alias?: string; aggregate?: 'sum' | 'avg' | 'count' | 'min' | 'max' }>;
      filters?: Array<{ column: string; operator: string; value: unknown }>;
      groupBy?: string[];
      orderBy?: Array<{ column: string; direction: 'ASC' | 'DESC' }>;
      visualizationType?: 'table' | 'bar' | 'line' | 'pie' | 'area';
      rolePermissions?: string[];
      isShared?: boolean;
    }) =>
      apiFetch<{ id: string }>('/superuser/reports/custom', {
        method: 'POST',
        body: JSON.stringify(payload)
      }),
    getCustomReports: () =>
      apiFetch<{ customReports: unknown[] }>('/superuser/reports/custom'),
    executeCustomReport: (id: string) =>
      apiFetch<{
        executionId: string;
        data: unknown[];
        columns: Array<{ name: string; label: string }>;
        rowCount: number;
        executionTimeMs: number;
      }>(`/superuser/reports/custom/${id}/execute`, {
        method: 'POST'
      }),
    updateCustomReport: (id: string, updates: {
      name?: string;
      description?: string;
      selectedColumns?: unknown[];
      filters?: unknown[];
      groupBy?: string[];
      orderBy?: unknown[];
      visualizationType?: 'table' | 'bar' | 'line' | 'pie' | 'area';
      isShared?: boolean;
    }) =>
      apiFetch<unknown>(`/superuser/reports/custom/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates)
      }),
    deleteCustomReport: (id: string) =>
      apiFetch<void>(`/superuser/reports/custom/${id}`, {
        method: 'DELETE'
      }),
    // Exports
    exportReport: (executionId: string, format: 'csv' | 'pdf' | 'excel' | 'json', title?: string) =>
      apiFetch<{ url: string; expiresAt: string }>(`/superuser/reports/executions/${executionId}/export`, {
        method: 'POST',
        body: JSON.stringify({ format, title })
      }),
    sendReportViaEmail: (executionId: string, payload: {
      recipients: string[];
      format?: 'csv' | 'pdf' | 'excel' | 'json';
    }) =>
      apiFetch<{ success: boolean }>(`/superuser/reports/executions/${executionId}/email`, {
        method: 'POST',
        body: JSON.stringify(payload)
      })
  },
  // Support & Communication
  support: {
    // Tickets
    createTicket: (payload: {
      subject: string;
      description: string;
      priority?: 'low' | 'medium' | 'high' | 'urgent';
      category?: 'technical' | 'billing' | 'feature_request' | 'bug' | 'other';
      metadata?: Record<string, unknown>;
    }) =>
      apiFetch<unknown>('/api/support/tickets', {
        method: 'POST',
        body: JSON.stringify(payload)
      }),
    getTickets: (filters?: {
      status?: string;
      priority?: string;
      category?: string;
      createdBy?: string;
      assignedTo?: string;
      limit?: number;
      offset?: number;
    }) =>
      apiFetch<{ tickets: unknown[]; total: number }>(
        `/api/support/tickets${buildQuery(filters)}`
      ),
    getTicket: (id: string, includeComments?: boolean) =>
      apiFetch<unknown>(
        `/api/support/tickets/${id}${buildQuery({ comments: includeComments ? 'true' : undefined })}`
      ),
    updateTicket: (id: string, updates: {
      subject?: string;
      description?: string;
      status?: 'open' | 'in_progress' | 'resolved' | 'closed' | 'pending';
      priority?: 'low' | 'medium' | 'high' | 'urgent';
      category?: 'technical' | 'billing' | 'feature_request' | 'bug' | 'other';
      assignedTo?: string | null;
    }) =>
      apiFetch<unknown>(`/api/support/tickets/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates)
      }),
    addTicketComment: (ticketId: string, payload: {
      content: string;
      isInternal?: boolean;
      attachments?: Array<{ fileName: string; fileUrl: string; fileSize: number; mimeType: string }>;
    }) =>
      apiFetch<unknown>(`/api/support/tickets/${ticketId}/comments`, {
        method: 'POST',
        body: JSON.stringify(payload)
      }),
    getTicketComments: (ticketId: string) =>
      apiFetch<{ comments: unknown[] }>(`/api/support/tickets/${ticketId}/comments`),
    // Announcements
    getAnnouncements: () =>
      apiFetch<{ announcements: unknown[] }>('/api/support/announcements/me'),
    markAnnouncementViewed: (id: string) =>
      apiFetch<{ success: boolean }>(`/api/support/announcements/${id}/view`, {
        method: 'POST'
      }),
    getAllAnnouncements: (filters?: {
      type?: string;
      isActive?: boolean;
      limit?: number;
      offset?: number;
    }) =>
      apiFetch<{ announcements: unknown[]; total: number }>(
        `/api/support/announcements${buildQuery(filters)}`
      ),
    createAnnouncement: (payload: {
      title: string;
      content: string;
      contentHtml?: string;
      type: 'info' | 'warning' | 'success' | 'error' | 'maintenance';
      priority?: 'low' | 'medium' | 'high';
      isPinned?: boolean;
      targetRoles?: string[];
      startDate?: string;
      endDate?: string;
    }) =>
      apiFetch<unknown>('/api/support/announcements', {
        method: 'POST',
        body: JSON.stringify(payload)
      }),
    updateAnnouncement: (id: string, updates: {
      title?: string;
      content?: string;
      contentHtml?: string;
      type?: 'info' | 'warning' | 'success' | 'error' | 'maintenance';
      priority?: 'low' | 'medium' | 'high';
      isPinned?: boolean;
      isActive?: boolean;
      targetRoles?: string[];
      startDate?: string;
      endDate?: string;
    }) =>
      apiFetch<unknown>(`/api/support/announcements/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates)
      }),
    deleteAnnouncement: (id: string) =>
      apiFetch<void>(`/api/support/announcements/${id}`, {
        method: 'DELETE'
      }),
    // Messages
    getMessages: (filters?: {
      isRead?: boolean;
      isArchived?: boolean;
      messageType?: string;
      priority?: string;
      limit?: number;
      offset?: number;
    }) =>
      apiFetch<{ messages: unknown[]; total: number; unreadCount: number }>(
        `/api/support/messages${buildQuery(filters)}`
      ),
    createMessage: (payload: {
      recipientId?: string;
      recipientRole?: string;
      subject: string;
      content: string;
      contentHtml?: string;
      messageType: 'direct' | 'broadcast' | 'system';
      priority?: 'low' | 'normal' | 'high' | 'urgent';
      attachments?: Array<{ fileName: string; fileUrl: string; fileSize: number; mimeType: string }>;
      metadata?: Record<string, unknown>;
    }) =>
      apiFetch<unknown>('/api/support/messages', {
        method: 'POST',
        body: JSON.stringify(payload)
      }),
    markMessageRead: (id: string) =>
      apiFetch<{ success: boolean }>(`/api/support/messages/${id}/read`, {
        method: 'POST'
      }),
    archiveMessage: (id: string) =>
      apiFetch<{ success: boolean }>(`/api/support/messages/${id}/archive`, {
        method: 'POST'
      }),
    getMessageThread: (threadId: string) =>
      apiFetch<unknown>(`/api/support/messages/threads/${threadId}`),
    // Knowledge Base
    getKbCategories: () =>
      apiFetch<{ categories: unknown[] }>('/api/support/knowledge-base/categories'),
    createKbCategory: (payload: {
      parentId?: string;
      name: string;
      slug?: string;
      description?: string;
      displayOrder?: number;
    }) =>
      apiFetch<unknown>('/api/support/knowledge-base/categories', {
        method: 'POST',
        body: JSON.stringify(payload)
      }),
    getKbArticles: (filters?: {
      categoryId?: string;
      published?: boolean;
      featured?: boolean;
      tags?: string[];
      search?: string;
      limit?: number;
      offset?: number;
    }) =>
      apiFetch<{ articles: unknown[]; total: number }>(
        `/api/support/knowledge-base/articles${buildQuery(filters)}`
      ),
    getKbArticle: (slug: string) =>
      apiFetch<unknown>(`/api/support/knowledge-base/articles/${slug}`),
    createKbArticle: (payload: {
      categoryId?: string;
      title: string;
      slug?: string;
      content: string;
      contentHtml?: string;
      summary?: string;
      tags?: string[];
      isPublished?: boolean;
      isFeatured?: boolean;
    }) =>
      apiFetch<unknown>('/api/support/knowledge-base/articles', {
        method: 'POST',
        body: JSON.stringify(payload)
      }),
    updateKbArticle: (id: string, updates: {
      title?: string;
      slug?: string;
      content?: string;
      contentHtml?: string;
      summary?: string;
      tags?: string[];
      categoryId?: string;
      isPublished?: boolean;
      isFeatured?: boolean;
    }) =>
      apiFetch<unknown>(`/api/support/knowledge-base/articles/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates)
      }),
    submitKbFeedback: (articleId: string, payload: {
      feedbackType: 'helpful' | 'not_helpful' | 'comment';
      comment?: string;
    }) =>
      apiFetch<unknown>(`/api/support/knowledge-base/articles/${articleId}/feedback`, {
        method: 'POST',
        body: JSON.stringify(payload)
      }),
    // Status Page
    getStatusPageSummary: (tenantId?: string) =>
      apiFetch<{
        overallStatus: 'operational' | 'degraded' | 'down';
        services: Array<{ name: string; status: 'up' | 'down' | 'degraded'; uptimePercentage: number }>;
        activeIncidents: unknown[];
        upcomingMaintenance: unknown[];
      }>(`/api/support/status/public${buildQuery({ tenantId })}`),
    getIncidents: (filters?: {
      status?: string;
      severity?: string;
      limit?: number;
      offset?: number;
    }) =>
      apiFetch<{ incidents: unknown[]; total: number }>(
        `/api/support/status/incidents${buildQuery(filters)}`
      ),
    getIncident: (id: string) =>
      apiFetch<unknown>(`/api/support/status/incidents/${id}`),
    createIncident: (payload: {
      title: string;
      description: string;
      status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
      severity: 'minor' | 'major' | 'critical';
      affectedServices?: string[];
    }) =>
      apiFetch<unknown>('/api/support/status/incidents', {
        method: 'POST',
        body: JSON.stringify(payload)
      }),
    addIncidentUpdate: (incidentId: string, payload: {
      status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
      message: string;
    }) =>
      apiFetch<unknown>(`/api/support/status/incidents/${incidentId}/updates`, {
        method: 'POST',
        body: JSON.stringify(payload)
      }),
    getScheduledMaintenance: (filters?: {
      status?: string;
      upcomingOnly?: boolean;
      limit?: number;
      offset?: number;
    }) =>
      apiFetch<{ maintenance: unknown[]; total: number }>(
        `/api/support/status/maintenance${buildQuery(filters)}`
      ),
    createScheduledMaintenance: (payload: {
      title: string;
      description: string;
      affectedServices?: string[];
      scheduledStart: string;
      scheduledEnd: string;
    }) =>
      apiFetch<unknown>('/api/support/status/maintenance', {
        method: 'POST',
        body: JSON.stringify(payload)
      }),
    updateMaintenanceStatus: (id: string, updates: {
      status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
      actualStart?: string;
      actualEnd?: string;
    }) =>
      apiFetch<unknown>(`/api/support/status/maintenance/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates)
      }),
    getUptimeStatistics: (filters?: {
      serviceName?: string;
      days?: number;
    }) =>
      apiFetch<{ statistics: unknown[] }>(
        `/api/support/status/uptime${buildQuery(filters)}`
      ),
      recordUptimeCheck: (payload: {
        serviceName: string;
        status: 'up' | 'down' | 'degraded';
        responseTimeMs?: number;
        metadata?: Record<string, unknown>;
      }) =>
        apiFetch<{ success: boolean }>('/api/support/status/uptime', {
          method: 'POST',
          body: JSON.stringify(payload)
        })
  },
  // Data Management & SSO
  dataManagement: {
    // Backups
    createBackup: (payload: {
      tenantId?: string;
      backupType: 'full' | 'incremental' | 'schema_only' | 'data_only';
      storageProvider: 'local' | 's3' | 'azure' | 'gcs';
      storageLocation: string;
      metadata?: Record<string, unknown>;
    }) =>
      apiFetch<unknown>('/superuser/data/backups', {
        method: 'POST',
        body: JSON.stringify(payload)
      }),
    getBackups: (filters?: {
      status?: string;
      backupType?: string;
      limit?: number;
      offset?: number;
    }) =>
      apiFetch<{ jobs: unknown[]; total: number }>(
        `/superuser/data/backups${buildQuery(filters)}`
      ),
    createBackupSchedule: (payload: {
      name: string;
      backupType: 'full' | 'incremental' | 'schema_only' | 'data_only';
      scheduleCron: string;
      retentionDays?: number;
      storageProvider: 'local' | 's3' | 'azure' | 'gcs';
      storageConfig?: Record<string, unknown>;
    }) =>
      apiFetch<unknown>('/superuser/data/backup-schedules', {
        method: 'POST',
        body: JSON.stringify(payload)
      }),
    getBackupSchedules: () =>
      apiFetch<{ schedules: unknown[] }>('/superuser/data/backup-schedules'),
    updateBackupSchedule: (id: string, updates: {
      name?: string;
      scheduleCron?: string;
      retentionDays?: number;
      isActive?: boolean;
      storageConfig?: Record<string, unknown>;
    }) =>
      apiFetch<unknown>(`/superuser/data/backup-schedules/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates)
      }),
    deleteBackupSchedule: (id: string) =>
      apiFetch<void>(`/superuser/data/backup-schedules/${id}`, {
        method: 'DELETE'
      }),
    // Data Export/Import
    createExportJob: (payload: {
      tenantId: string;
      exportType: 'full' | 'partial' | 'gdpr' | 'custom';
      format: 'json' | 'csv' | 'sql' | 'excel';
      tablesIncluded?: string[];
      filters?: Record<string, unknown>;
    }) =>
      apiFetch<unknown>('/superuser/data/exports', {
        method: 'POST',
        body: JSON.stringify(payload)
      }),
    getExportJobs: (filters?: {
      status?: string;
      exportType?: string;
      limit?: number;
      offset?: number;
    }) =>
      apiFetch<{ jobs: unknown[]; total: number }>(
        `/superuser/data/exports${buildQuery(filters)}`
      ),
    createImportJob: (payload: {
      tenantId: string;
      importType: 'full' | 'merge' | 'update_only';
      format: 'json' | 'csv' | 'sql' | 'excel';
      fileUrl: string;
      fileSizeBytes?: number;
      tablesTargeted?: string[];
    }) =>
      apiFetch<unknown>('/superuser/data/imports', {
        method: 'POST',
        body: JSON.stringify(payload)
      }),
    getImportJobs: (filters?: {
      status?: string;
      importType?: string;
      limit?: number;
      offset?: number;
    }) =>
      apiFetch<{ jobs: unknown[]; total: number }>(
        `/superuser/data/imports${buildQuery(filters)}`
      ),
    // GDPR
    createGdprRequest: (payload: {
      tenantId: string;
      userId: string;
      requestType: 'full_erasure' | 'anonymize' | 'export_only';
      reason?: string;
      dataCategories?: string[];
    }) =>
      apiFetch<unknown>('/superuser/data/gdpr/requests', {
        method: 'POST',
        body: JSON.stringify(payload)
      }),
    verifyGdprRequest: (id: string, verificationToken: string) =>
      apiFetch<{ success: boolean }>(`/superuser/data/gdpr/requests/${id}/verify`, {
        method: 'POST',
        body: JSON.stringify({ verificationToken })
      }),
    processGdprRequest: (id: string) =>
      apiFetch<unknown>(`/superuser/data/gdpr/requests/${id}/process`, {
        method: 'POST'
      }),
    getGdprRequests: (filters?: {
      userId?: string;
      status?: string;
      limit?: number;
      offset?: number;
    }) =>
      apiFetch<{ requests: unknown[]; total: number }>(
        `/superuser/data/gdpr/requests${buildQuery(filters)}`
      ),
    cancelGdprRequest: (id: string) =>
      apiFetch<{ success: boolean }>(`/superuser/data/gdpr/requests/${id}/cancel`, {
        method: 'POST'
      })
  },
  sso: {
    // SAML
    getSamlProviders: () =>
      apiFetch<{ providers: unknown[] }>('/auth/sso/saml/providers'),
    createSamlProvider: (payload: {
      providerName: string;
      metadataUrl?: string;
      entityId: string;
      ssoUrl: string;
      sloUrl?: string;
      certificate: string;
      jitProvisioning?: boolean;
      jitDefaultRole?: string;
      attributeMapping?: Record<string, string>;
    }) =>
      apiFetch<unknown>('/auth/sso/saml/providers', {
        method: 'POST',
        body: JSON.stringify(payload)
      }),
    initiateSamlAuth: (payload: {
      providerId: string;
      relayState?: string;
    }) =>
      apiFetch<{ samlRequest: string; ssoUrl: string; relayState: string }>(
        '/auth/sso/saml/initiate',
        {
          method: 'POST',
          body: JSON.stringify(payload)
        }
      ),
    // OAuth2/OIDC
    getOAuthProviders: () =>
      apiFetch<{ providers: unknown[] }>('/auth/sso/oauth/providers'),
    createOAuthProvider: (payload: {
      providerName: string;
      providerType: 'oauth2' | 'oidc';
      clientId: string;
      clientSecret: string;
      authorizationUrl: string;
      tokenUrl: string;
      userinfoUrl?: string;
      scopes?: string[];
      jitProvisioning?: boolean;
      jitDefaultRole?: string;
      attributeMapping?: Record<string, string>;
    }) =>
      apiFetch<unknown>('/auth/sso/oauth/providers', {
        method: 'POST',
        body: JSON.stringify(payload)
      }),
    getOAuthAuthorizationUrl: (providerId: string) =>
      apiFetch<{ authorizationUrl: string; state: string }>(
        `/auth/sso/oauth/authorize?providerId=${providerId}`
      ),
    refreshOAuthToken: (payload: {
      providerId: string;
      refreshToken: string;
    }) =>
      apiFetch<{ accessToken: string; refreshToken?: string; expiresIn?: number }>(
        '/auth/sso/oauth/refresh',
        {
          method: 'POST',
          body: JSON.stringify(payload)
        }
      )
  },
  // File Upload
  uploadFile: (payload: {
    file: string; // base64 encoded
    filename: string;
    mimetype: string;
    description?: string;
    entityType?: 'user' | 'student' | 'teacher' | 'hod';
    entityId?: string;
  }) =>
    apiFetch<{
      id: string;
      filename: string;
      originalFilename: string;
      fileSize: number;
      mimeType: string;
      fileUrl: string;
      uploadedBy: string;
      uploadedAt: Date;
    }>('/upload', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  listFileUploads: () =>
    apiFetch<Array<{
      id: string;
      filename: string;
      originalFilename: string;
      fileSize: number;
      mimeType: string;
      fileUrl: string;
      uploadedBy: string;
      uploadedAt: Date;
    }>>('/upload'),
  deleteFileUpload: (fileId: string) =>
    apiFetch<void>(`/upload/${fileId}`, {
      method: 'DELETE'
    }),
  // Billing
  billing: {
    getSubscription: () => apiFetch<Subscription>('/admin/billing/subscription'),
    createSubscription: (payload: { priceId: string; trialDays?: number }) =>
      apiFetch<Subscription>('/admin/billing/subscription/subscribe', {
        method: 'POST',
        body: JSON.stringify(payload)
      }),
    cancelSubscription: (payload: { cancelImmediately?: boolean }) =>
      apiFetch<Subscription>('/admin/billing/subscription/cancel', {
        method: 'POST',
        body: JSON.stringify(payload)
      }),
    updatePlan: (payload: { newPriceId: string; prorate?: boolean }) =>
      apiFetch<Subscription>('/admin/billing/subscription/update-plan', {
        method: 'POST',
        body: JSON.stringify(payload)
      }),
    getInvoices: (params?: { status?: string; limit?: number; offset?: number }) => {
      const queryParams = new URLSearchParams();
      if (params?.status) queryParams.append('status', params.status);
      if (params?.limit) queryParams.append('limit', String(params.limit));
      if (params?.offset) queryParams.append('offset', String(params.offset));
      return apiFetch<PaginatedResponse<BillingInvoice>>(
        `/admin/billing/invoices${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
      );
    },
    getInvoice: (invoiceId: string) =>
      apiFetch<BillingInvoice>(`/admin/billing/invoices/${invoiceId}`),
    getPayments: (params?: { invoiceId?: string; status?: string; limit?: number; offset?: number }) => {
      const queryParams = new URLSearchParams();
      if (params?.invoiceId) queryParams.append('invoiceId', params.invoiceId);
      if (params?.status) queryParams.append('status', params.status);
      if (params?.limit) queryParams.append('limit', String(params.limit));
      if (params?.offset) queryParams.append('offset', String(params.offset));
      return apiFetch<PaginatedResponse<BillingPayment>>(
        `/admin/billing/payments${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
      );
    }
  }
};

export default api;

export interface AuditLogEntry {
  id: string;
  action: string;
  entityType?: string;
  entityId?: string | null;
  userId?: string | null;
  userEmail?: string | null;
  timestamp?: string;
  createdAt?: string | Date;
  details?: Record<string, unknown> | null;
  ipAddress?: string | null;
  tenantId?: string | null;
  resourceType?: string;
  resourceId?: string;
  severity?: 'info' | 'warning' | 'error' | 'critical';
  tags?: string[];
  userAgent?: string;
  requestId?: string;
}

export interface UserSession {
  id: string;
  userId: string;
  tenantId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  deviceInfo: Record<string, unknown>;
  normalizedDeviceInfo?: {
    platform?: string;
    os?: string;
    browser?: string;
    deviceType?: 'mobile' | 'tablet' | 'desktop';
    raw?: string;
  };
  loginAt: string;
  logoutAt: string | null;
  expiresAt: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PasswordChangeHistory {
  id: string;
  userId: string;
  tenantId: string | null;
  changedBy: string | null;
  changedByEmail?: string | null;
  changedByName?: string | null;
  changedByRole?: string | null;
  changeType: 'self_reset' | 'admin_reset' | 'admin_change' | 'forced_reset';
  ipAddress: string | null;
  userAgent: string | null;
  deviceInfo?: {
    platform?: string;
    os?: string;
    browser?: string;
    deviceType?: 'mobile' | 'tablet' | 'desktop';
    raw?: string;
  };
  changedAt: string;
  metadata: Record<string, unknown>;
}

export interface LoginAttemptRecord {
  id: string;
  email: string;
  userId: string | null;
  tenantId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  deviceInfo?: {
    platform?: string;
    os?: string;
    browser?: string;
    deviceType?: 'mobile' | 'tablet' | 'desktop';
    raw?: string;
  };
  success: boolean;
  failureReason: string | null;
  attemptedAt: string;
}

export interface InvestigationCase {
  id: string;
  caseNumber: string;
  title: string;
  description?: string | null;
  status: 'open' | 'investigating' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  caseType: 'anomaly' | 'security' | 'compliance' | 'abuse' | 'other';
  relatedUserId?: string | null;
  relatedTenantId?: string | null;
  assignedTo?: string | null;
  createdBy: string;
  resolvedBy?: string | null;
  openedAt: string;
  investigatedAt?: string | null;
  resolvedAt?: string | null;
  closedAt?: string | null;
  resolution?: string | null;
  resolutionNotes?: string | null;
  tags: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CaseNote {
  id: string;
  caseId: string;
  note: string;
  noteType: 'note' | 'finding' | 'evidence' | 'action';
  createdBy: string;
  createdAt: string;
  metadata: Record<string, unknown>;
}

export interface CaseEvidence {
  id: string;
  caseId: string;
  evidenceType: 'audit_log' | 'session' | 'login_attempt' | 'password_change' | 'file' | 'other';
  evidenceId: string;
  evidenceSource?: string | null;
  description?: string | null;
  addedBy: string;
  addedAt: string;
  metadata: Record<string, unknown>;
}

export interface AnomalyDetectionResult {
  type: 'failed_logins' | 'multiple_ips' | 'unusual_activity' | 'suspicious_pattern';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  userId?: string;
  userEmail?: string;
  tenantId?: string | null;
  evidence: Array<{
    type: string;
    id: string;
    timestamp: string;
    details: Record<string, unknown>;
  }>;
  detectedAt: string;
}
