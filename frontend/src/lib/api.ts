const API_BASE_URL = (() => {
  const explicit = import.meta.env.VITE_API_BASE_URL ?? import.meta.env.VITE_API_URL;
  if (explicit) {
    return explicit;
  }
  if (import.meta.env.DEV) {
    console.warn('[api] Falling back to default API base URL http://localhost:3001');
    return 'http://localhost:3001';
  }
  throw new Error('Missing VITE_API_BASE_URL environment variable');
})();
const DEFAULT_TENANT = import.meta.env.VITE_TENANT_ID ?? 'tenant_alpha';

const REFRESH_STORAGE_KEY = 'saas-school.refreshToken';
const TENANT_STORAGE_KEY = 'saas-school.tenantId';

let accessToken: string | null = null;
let refreshToken: string | null = null;
let tenantId: string | null = DEFAULT_TENANT;
let refreshTimeout: ReturnType<typeof setTimeout> | null = null;

type UnauthorizedHandler = () => void;
type RefreshHandler = (auth: AuthResponse) => void;

let onUnauthorized: UnauthorizedHandler | null = null;
let onRefresh: RefreshHandler | null = null;

export type Role = 'student' | 'teacher' | 'admin' | 'superadmin';
export type UserStatus = 'pending' | 'active' | 'suspended' | 'rejected';

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  tenantId: string | null;
  isVerified: boolean;
  status?: UserStatus;
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
}

type FetchOptions = Omit<globalThis.RequestInit, 'headers'> & {
  headers?: Record<string, string>;
  responseType?: 'json' | 'blob';
};

async function extractError(response: Response): Promise<string> {
  try {
    const payload = await response.json();
    if (typeof payload?.message === 'string') {
      return payload.message;
    }
  } catch {
    // ignore
  }
  return response.statusText || 'Request failed';
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
  if (tokens.refresh) {
    window.localStorage.setItem(REFRESH_STORAGE_KEY, tokens.refresh);
  } else {
    window.localStorage.removeItem(REFRESH_STORAGE_KEY);
  }

  if (tokens.tenant) {
    window.localStorage.setItem(TENANT_STORAGE_KEY, tokens.tenant);
  } else {
    window.localStorage.removeItem(TENANT_STORAGE_KEY);
  }
}

const TENANT_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

function isValidTenantId(id: string | null | undefined): id is string {
  return Boolean(id && TENANT_ID_PATTERN.test(id));
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
  const resolvedTenant = auth.user.tenantId ?? DEFAULT_TENANT;
  tenantId = isValidTenantId(resolvedTenant) ? resolvedTenant : DEFAULT_TENANT;
  if (persist) {
    persistSession({ refresh: refreshToken, tenant: tenantId });
  }
  scheduleTokenRefresh(auth.expiresIn);
}

export function clearSession() {
  accessToken = null;
  refreshToken = null;
  tenantId = DEFAULT_TENANT;
  clearRefreshTimer();
  persistSession({ refresh: null, tenant: null });
}

export function hydrateFromStorage(): { refreshToken: string | null; tenantId: string | null } {
  if (typeof window === 'undefined') {
    return { refreshToken: null, tenantId: null };
  }
  const storedRefresh = window.localStorage.getItem(REFRESH_STORAGE_KEY);
  const storedTenant = window.localStorage.getItem(TENANT_STORAGE_KEY);
  refreshToken = storedRefresh;
  const safeTenant = storedTenant && isValidTenantId(storedTenant) ? storedTenant : DEFAULT_TENANT;
  tenantId = safeTenant;
  if (storedTenant && !isValidTenantId(storedTenant)) {
    window.localStorage.removeItem(TENANT_STORAGE_KEY);
  }
  return { refreshToken: storedRefresh, tenantId: safeTenant };
}

export function setTenant(nextTenant: string | null) {
  if (nextTenant && !isValidTenantId(nextTenant)) {
    throw new Error('Invalid tenant identifier');
  }
  tenantId = nextTenant ?? DEFAULT_TENANT;
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
        'x-tenant-id': tenantId ?? DEFAULT_TENANT
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
    'x-tenant-id': tenantId ?? DEFAULT_TENANT,
    ...(rest.body ? { 'Content-Type': 'application/json' } : {}),
    ...rest.headers
  };

  if (accessToken && !headers.Authorization) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers
  });

  if (response.status === 401 && retry && refreshToken) {
    const refreshed = await performRefresh();
    if (refreshed?.accessToken) {
      return apiFetch<T>(path, options, false);
    }
  }

  if (!response.ok) {
    throw new Error(await extractError(response));
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
}

export interface TeacherProfile {
  id: string;
  name: string;
  email: string;
  subjects: string[];
  assigned_classes: string[];
}

export interface StudentRecord {
  id: string;
  first_name: string;
  last_name: string;
  class_id: string | null;
  admission_number: string | null;
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
    initialiseSession(response);
    scheduleTokenRefresh(response.expiresIn);
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
    initialiseSession(response);
    scheduleTokenRefresh(response.expiresIn);
    return response;
  },
  async refresh(): Promise<AuthResponse | null> {
    return performRefresh();
  }
};

export const api = {
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
  bulkUpsertGrades: (examId: string, entries: GradeEntryInput[]) =>
    apiFetch<{ saved: number }>('/grades/bulk', {
      method: 'POST',
      body: JSON.stringify({ examId, entries })
    }),
  getStudentResult: (studentId: string, examId: string) =>
    apiFetch<StudentResult>(`/results/${studentId}${buildQuery({ exam_id: examId })}`),

  // Invoices
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
      })
  },

  // RBAC
  listUsers: () => apiFetch<TenantUser[]>('/users'),
  listTeachers: () => apiFetch<TeacherProfile[]>('/teachers'),
  listStudents: () => apiFetch<StudentRecord[]>('/students'),
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
      apiFetch(`/superuser/schools/${id}/admins`, {
        method: 'POST',
        body: JSON.stringify(payload)
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
  }
};
