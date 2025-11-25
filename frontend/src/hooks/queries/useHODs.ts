/**
 * Standardized React Query hook for HODs
 * Provides consistent query keys and mutation invalidation
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../useQuery';
import { api } from '../../lib/api';
import { toast } from 'sonner';
import { useMemo } from 'react';
import { isHOD } from '../../lib/utils/userHelpers';

interface HODRecord {
  id: string;
  name: string;
  email: string;
  subjects: string[];
  assigned_classes: string[];
  department?: string;
  teachersUnderOversight?: number;
}

export interface UseHODsFilters {
  search?: string;
  department?: string;
}

/**
 * Hook to fetch HODs with optional filters
 */
export function useHODs(filters?: UseHODsFilters) {
  const queryKey = useMemo(() => [...queryKeys.admin.hods(), filters] as const, [filters]);

  return useQuery({
    queryKey,
    queryFn: async () => {
      const users = await api.listUsers();
      const teachers = await api.listTeachers();

      // Combine users and teachers to get HODs
      const hodUsers = users.filter((u) => isHOD(u));

      // Map to HOD records with teacher data
      const hods = hodUsers
        .map((user) => {
          const teacher = teachers.find((t) => t.email === user.email);
          if (!teacher) return null;

          const hodRole = user.additional_roles?.find((r) => r.role === 'hod');
          const department =
            (hodRole?.metadata?.department as string) || teacher.subjects[0] || 'General';

          // Count teachers under oversight (teachers with same subjects)
          const hodSubjects = teacher.subjects;
          const teachersUnderOversight = teachers.filter(
            (t) =>
              t.id !== teacher.id && t.subjects.some((subject) => hodSubjects.includes(subject))
          ).length;

          return {
            ...teacher,
            department,
            teachersUnderOversight,
          } as HODRecord;
        })
        .filter((hod): hod is HODRecord => hod !== null);

      // Apply filters
      if (!filters) return hods;

      return hods.filter((hod) => {
        if (filters.search) {
          const searchLower = filters.search.toLowerCase();
          const matchesSearch =
            hod.name?.toLowerCase().includes(searchLower) ||
            hod.email?.toLowerCase().includes(searchLower);
          if (!matchesSearch) return false;
        }
        if (filters.department && filters.department !== 'all') {
          if (hod.department !== filters.department) return false;
        }
        return true;
      });
    },
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Hook to assign department to HOD
 */
export function useAssignHODDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, department }: { userId: string; department: string }) =>
      api.admin.assignHODDepartment(userId, department),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.hods() });
      toast.success('Department assigned successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to assign department');
    },
  });
}

/**
 * Hook to bulk remove HOD roles
 */
export function useBulkRemoveHODRoles() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userIds: string[]) => api.admin.bulkRemoveHODRoles(userIds),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.hods() });
      if (result.failed > 0) {
        toast.warning(
          `HOD role removed from ${result.removed} user(s), but ${result.failed} failed`
        );
      } else {
        toast.success(result.message || `HOD role removed from ${result.removed} user(s)`);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to remove HOD roles');
    },
  });
}
