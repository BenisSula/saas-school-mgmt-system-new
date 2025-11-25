/**
 * Phase 7 Student Hooks
 * React Query hooks for student dashboard, resources, announcements, attendance, and grades
 */

import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

// ========== DASHBOARD HOOK ==========

export function useStudentDashboard() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['student', 'dashboard', user?.id],
    queryFn: () => api.student.getDashboard(),
    enabled: !!user?.id
  });
}

// ========== ANNOUNCEMENTS HOOK ==========

export function useStudentAnnouncements(classId: string | undefined) {
  return useQuery({
    queryKey: ['student', 'announcements', classId],
    queryFn: () => api.student.getAnnouncements(classId!),
    enabled: !!classId
  });
}

// ========== RESOURCES HOOK ==========

export function useStudentResources(classId: string | undefined) {
  return useQuery({
    queryKey: ['student', 'resources', classId],
    queryFn: () => api.student.getResources(classId!),
    enabled: !!classId
  });
}

// ========== ATTENDANCE HOOK ==========

export function useStudentAttendance(params?: { from?: string; to?: string }) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['student', 'attendance', user?.id, params],
    queryFn: () => api.student.getAttendance(params),
    enabled: !!user?.id
  });
}

// ========== GRADES HOOK ==========

export function useStudentGrades(params?: { term?: string }) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['student', 'grades', user?.id, params],
    queryFn: () => api.student.getGrades(params),
    enabled: !!user?.id
  });
}

