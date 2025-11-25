/**
 * @deprecated This file is deprecated. Use hooks from '../queries/dashboard' instead.
 * This file provides backward-compatible wrappers for existing code.
 *
 * Migration path:
 * - useTeacherStats() -> useTeacherStatsQuery()
 * - useStudentStats() -> useStudentStatsQuery()
 * - useClassStats() -> useClassStatsQuery()
 * - useSubjectStats() -> useSubjectStatsQuery()
 * - useTodayAttendance() -> useTodayAttendanceQuery()
 * - useActiveSessions() -> useActiveSessionsQuery()
 * - useLoginAttempts() -> useLoginAttemptsQuery()
 * - useRecentActivity() -> useRecentActivityQuery()
 */

import {
  useTeacherStatsQuery,
  useStudentStatsQuery,
  useClassStatsQuery,
  useSubjectStatsQuery,
  useTodayAttendanceQuery,
  useActiveSessionsQuery,
  useLoginAttemptsQuery,
  useRecentActivityQuery,
} from './dashboard';

// Legacy interfaces for backward compatibility
export interface TeacherStats {
  total: number;
  active: number;
  assigned: number;
  unassigned: number;
}

export interface StudentStats {
  total: number;
  active: number;
  byClass: Record<string, number>;
  byGender: { male: number; female: number; other: number };
}

export interface ClassStats {
  total: number;
  withStudents: number;
  withTeachers: number;
}

export interface SubjectStats {
  total: number;
  assigned: number;
  unassigned: number;
}

export interface TodayAttendance {
  present: number;
  absent: number;
  late: number;
  total: number;
  percentage: number;
}

export interface LoginAttempt {
  id: string;
  email: string;
  success: boolean;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
}

export interface ActiveSession {
  id: string;
  userId: string;
  userEmail: string;
  ipAddress?: string;
  userAgent?: string;
  lastActivity: string;
  deviceType?: string;
}

export interface RecentActivity {
  id: string;
  action: string;
  description: string;
  userEmail?: string;
  timestamp: string;
  severity?: 'info' | 'warning' | 'error';
}

/**
 * @deprecated Use useTeacherStatsQuery() from '../queries/dashboard' instead
 * Hook to fetch teacher statistics (backward-compatible wrapper)
 */
export function useTeacherStats() {
  const { data, ...rest } = useTeacherStatsQuery();

  // Transform new format to old format
  const transformed: TeacherStats | undefined = data
    ? {
        total: data.totalTeachers,
        active: data.activeTeachers,
        assigned: data.teachersByDepartment.reduce((sum, dept) => sum + dept.count, 0), // Approximate
        unassigned:
          data.totalTeachers - data.teachersByDepartment.reduce((sum, dept) => sum + dept.count, 0),
      }
    : undefined;

  return { data: transformed, ...rest };
}

/**
 * @deprecated Use useStudentStatsQuery() from '../queries/dashboard' instead
 * Hook to fetch student statistics (backward-compatible wrapper)
 */
export function useStudentStats() {
  const { data, ...rest } = useStudentStatsQuery();

  // Transform new format to old format
  const transformed: StudentStats | undefined = data
    ? {
        total: data.totalStudents,
        active: data.activeStudents,
        byClass: data.studentsByClass.reduce(
          (acc, item) => {
            acc[item.classId] = item.count;
            return acc;
          },
          {} as Record<string, number>
        ),
        byGender: {
          male: data.maleCount,
          female: data.femaleCount,
          other: data.totalStudents - data.maleCount - data.femaleCount,
        },
      }
    : undefined;

  return { data: transformed, ...rest };
}

/**
 * @deprecated Use useClassStatsQuery() from '../queries/dashboard' instead
 * Hook to fetch class statistics (backward-compatible wrapper)
 */
export function useClassStats() {
  const { data, ...rest } = useClassStatsQuery();

  // Transform new format to old format
  const transformed: ClassStats | undefined = data
    ? {
        total: data.totalClasses,
        withStudents: data.classesByLevel.reduce((sum, level) => sum + level.count, 0), // Approximate
        withTeachers: data.activeClasses, // Approximate
      }
    : undefined;

  return { data: transformed, ...rest };
}

/**
 * @deprecated Use useSubjectStatsQuery() from '../queries/dashboard' instead
 * Hook to fetch subject statistics (backward-compatible wrapper)
 */
export function useSubjectStats() {
  const { data, ...rest } = useSubjectStatsQuery();

  // Transform new format to old format
  const transformed: SubjectStats | undefined = data
    ? {
        total: data.totalSubjects,
        assigned: data.assignedSubjects,
        unassigned: data.unassignedSubjects,
      }
    : undefined;

  return { data: transformed, ...rest };
}

/**
 * @deprecated Use useTodayAttendanceQuery() from '../queries/dashboard' instead
 * Hook to fetch today's attendance statistics (backward-compatible wrapper)
 */
export function useTodayAttendance() {
  const { data, ...rest } = useTodayAttendanceQuery();

  // Transform new format to old format
  const transformed: TodayAttendance | undefined = data
    ? {
        present: data.presentCount,
        absent: data.absentCount,
        late: 0, // Not available in new format
        total: data.presentCount + data.absentCount,
        percentage: data.attendanceRate,
      }
    : undefined;

  return { data: transformed, ...rest };
}

/**
 * @deprecated Use useActiveSessionsQuery() from '../queries/dashboard' instead
 * Hook to fetch active sessions (backward-compatible wrapper)
 */
export function useActiveSessions() {
  const { data, ...rest } = useActiveSessionsQuery();

  // Transform new format to old format
  const transformed: ActiveSession[] | undefined = data?.sessions.map((session) => ({
    id: session.id,
    userId: session.userId,
    userEmail: '', // Not available in new format
    ipAddress: session.ipAddress || undefined,
    userAgent: session.userAgent || undefined,
    lastActivity: session.updatedAt,
    deviceType: (session.deviceInfo as { deviceType?: string })?.deviceType || undefined,
  }));

  return { data: transformed, ...rest };
}

/**
 * @deprecated Use useLoginAttemptsQuery() from '../queries/dashboard' instead
 * Hook to fetch login attempts (backward-compatible wrapper)
 */
export function useLoginAttempts(days = 1) {
  const { data, ...rest } = useLoginAttemptsQuery(days);

  // Transform new format to old format
  const transformed: LoginAttempt[] | undefined = data?.attempts.map((attempt) => ({
    id: '', // Not available in new format
    email: attempt.email,
    success: attempt.success,
    ipAddress: attempt.ipAddress || undefined,
    userAgent: attempt.userAgent || undefined,
    timestamp: attempt.attemptedAt,
  }));

  return { data: transformed, ...rest };
}

/**
 * @deprecated Use useRecentActivityQuery() from '../queries/dashboard' instead
 * Hook to fetch recent activity logs (backward-compatible wrapper)
 */
export function useRecentActivity(limit = 20) {
  const { data, ...rest } = useRecentActivityQuery(limit);

  // Transform new format to old format
  const transformed: RecentActivity[] | undefined = data?.activities.map((activity) => ({
    id: activity.id,
    action: activity.action,
    description: `${activity.action} on ${activity.resourceType || 'resource'}`,
    userEmail: undefined, // Not available in new format
    timestamp:
      typeof activity.createdAt === 'string'
        ? activity.createdAt
        : activity.createdAt?.toString() || '',
    severity: undefined, // Not available in new format
  }));

  return { data: transformed, ...rest };
}
