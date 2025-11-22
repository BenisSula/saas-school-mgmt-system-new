import { useQuery, queryKeys } from '../useQuery';
import { api } from '../../lib/api';

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
 * Hook to fetch teacher statistics
 */
export function useTeacherStats() {
  return useQuery(queryKeys.admin.teacherStats(), async () => {
    const teachers = await api.listTeachers();
    const total = teachers.length;
    const active = teachers.filter((t) => t.status === 'active' || !t.status).length;
    const assigned = teachers.filter((t) => t.assigned_classes && t.assigned_classes.length > 0).length;
    const unassigned = total - assigned;

    return {
      total,
      active,
      assigned,
      unassigned
    } as TeacherStats;
  });
}

/**
 * Hook to fetch student statistics
 */
export function useStudentStats() {
  return useQuery(queryKeys.admin.studentStats(), async () => {
    const students = await api.listStudents();
    const total = students.length;
    const active = students.filter((s) => s.enrollment_status === 'active' || !s.enrollment_status).length;
    
    // Count by class
    const byClass: Record<string, number> = {};
    students.forEach((s) => {
      const classId = s.class_id || 'unassigned';
      byClass[classId] = (byClass[classId] || 0) + 1;
    });

    // Count by gender (assuming gender field exists)
    const byGender = { male: 0, female: 0, other: 0 };
    students.forEach((s) => {
      const gender = (s as unknown as { gender?: string }).gender?.toLowerCase() || 'other';
      if (gender === 'male' || gender === 'm') {
        byGender.male++;
      } else if (gender === 'female' || gender === 'f') {
        byGender.female++;
      } else {
        byGender.other++;
      }
    });

    return {
      total,
      active,
      byClass,
      byGender
    } as StudentStats;
  });
}

/**
 * Hook to fetch class statistics
 */
export function useClassStats() {
  return useQuery(queryKeys.admin.classStats(), async () => {
    const [classes, students, teachers] = await Promise.all([
      api.listClasses(),
      api.listStudents(),
      api.listTeachers()
    ]);

    const total = classes.length;
    const classIds = new Set(students.map((s) => s.class_id).filter(Boolean));
    const withStudents = classIds.size;

    const teacherClassIds = new Set(
      teachers.flatMap((t) => t.assigned_classes || []).filter(Boolean)
    );
    const withTeachers = teacherClassIds.size;

    return {
      total,
      withStudents,
      withTeachers
    } as ClassStats;
  });
}

/**
 * Hook to fetch subject statistics
 */
export function useSubjectStats() {
  return useQuery(queryKeys.admin.subjectStats(), async () => {
    const subjects = await api.admin.listSubjects();
    const total = subjects.length;
    
    // Count assigned subjects (subjects that appear in teacher assignments)
    const teachers = await api.listTeachers();
    const assignedSubjectIds = new Set(
      teachers.flatMap((t) => t.subjects || []).filter(Boolean)
    );
    const assigned = assignedSubjectIds.size;
    const unassigned = total - assigned;

    return {
      total,
      assigned,
      unassigned
    } as SubjectStats;
  });
}

/**
 * Hook to fetch today's attendance statistics
 */
export function useTodayAttendance() {
  return useQuery(queryKeys.admin.todayAttendance(), async () => {
    const today = new Date().toISOString().split('T')[0];
    const attendance = await api.getAttendanceAggregate({ from: today, to: today });
    
    let present = 0;
    let absent = 0;
    let late = 0;
    let total = 0;

    attendance.forEach((record) => {
      if (record.status === 'present') present += record.count;
      else if (record.status === 'absent') absent += record.count;
      else if (record.status === 'late') late += record.count;
      total += record.count;
    });

    const percentage = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

    return {
      present,
      absent,
      late,
      total,
      percentage
    } as TodayAttendance;
  });
}

/**
 * Hook to fetch recent activity logs
 * Note: ActivityLog component uses useActivityLogs hook directly
 * This is kept for API consistency but ActivityLog handles its own data fetching
 */
export function useRecentActivity(limit = 20) {
  // ActivityLog component handles its own data fetching via useActivityLogs
  // This hook is kept for consistency but returns empty array
  return useQuery(queryKeys.admin.recentActivity(limit), async () => {
    return [] as RecentActivity[];
  });
}

/**
 * Hook to fetch login attempts (successful and failed)
 */
export function useLoginAttempts(days = 1) {
  return useQuery(queryKeys.admin.loginAttempts(days), async () => {
    // TODO: Implement backend endpoint /admin/users/login-attempts
    // For now, return mock data structure
    return {
      successful: 0,
      failed: 0,
      attempts: [] as LoginAttempt[]
    };
  });
}

/**
 * Hook to fetch active sessions
 */
export function useActiveSessions() {
  return useQuery(queryKeys.admin.activeSessions(), async () => {
    // TODO: Implement backend endpoint /admin/sessions/active
    // For now, return empty array
    return [] as ActiveSession[];
  });
}

