/**
 * Dashboard Query Hooks
 *
 * All hooks are multi-tenant aware and use React Query v5 features.
 * Each hook includes tenantId in the query key and handles tenant switching gracefully.
 *
 * All hooks use shared query configuration from './queryConfig' (DRY principle).
 */

export { dashboardQueryConfig, createDashboardQueryOptions } from './queryConfig';
export { dashboardKeys } from './queryKeys';

export { useTeacherStatsQuery, teacherStatsQueryOptions } from './useTeacherStatsQuery';
export type { TeacherStats, TeacherStatsResponse } from './useTeacherStatsQuery';

export { useStudentStatsQuery, studentStatsQueryOptions } from './useStudentStatsQuery';
export type { StudentStats, StudentStatsResponse } from './useStudentStatsQuery';

export { useClassStatsQuery, classStatsQueryOptions } from './useClassStatsQuery';
export type { ClassStats, ClassStatsResponse } from './useClassStatsQuery';

export { useSubjectStatsQuery, subjectStatsQueryOptions } from './useSubjectStatsQuery';
export type { SubjectStats, SubjectStatsResponse } from './useSubjectStatsQuery';

export { useTodayAttendanceQuery, todayAttendanceQueryOptions } from './useTodayAttendanceQuery';
export type { TodayAttendance, TodayAttendanceResponse } from './useTodayAttendanceQuery';

export { useActiveSessionsQuery, activeSessionsQueryOptions } from './useActiveSessionsQuery';
export type { ActiveSession, ActiveSessionsResponse } from './useActiveSessionsQuery';

export { useLoginAttemptsQuery, loginAttemptsQueryOptions } from './useLoginAttemptsQuery';
export type { LoginAttempt, LoginAttemptsResponse } from './useLoginAttemptsQuery';

export { useRecentActivityQuery, recentActivityQueryOptions } from './useRecentActivityQuery';
export type { RecentActivity, RecentActivityResponse } from './useRecentActivityQuery';
