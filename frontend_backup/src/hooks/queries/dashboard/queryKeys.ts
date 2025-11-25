/**
 * Shared query keys for dashboard queries
 * All keys are multi-tenant aware and include tenantId
 */
export const dashboardKeys = {
  root: (tenantId: string) => ['dashboard', tenantId] as const,

  teacherStats: (tenantId: string) => [...dashboardKeys.root(tenantId), 'teachers'] as const,
  studentStats: (tenantId: string) => [...dashboardKeys.root(tenantId), 'students'] as const,
  classStats: (tenantId: string) => [...dashboardKeys.root(tenantId), 'classes'] as const,
  subjectStats: (tenantId: string) => [...dashboardKeys.root(tenantId), 'subjects'] as const,

  attendanceToday: (tenantId: string) => [...dashboardKeys.root(tenantId), 'attendanceToday'] as const,

  activeSessions: (tenantId: string) => [...dashboardKeys.root(tenantId), 'activeSessions'] as const,

  loginAttempts: (tenantId: string) => [...dashboardKeys.root(tenantId), 'loginAttempts'] as const,

  recentActivity: (tenantId: string) => [...dashboardKeys.root(tenantId), 'recentActivity'] as const,
};

