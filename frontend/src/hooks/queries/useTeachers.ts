/**
 * Standardized React Query hook for Teachers
 * Provides consistent query keys and mutation invalidation
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../useQuery';
import { api } from '../../lib/api';
import { toast } from 'sonner';
import { useMemo } from 'react';

export interface UseTeachersFilters {
  search?: string;
  classId?: string;
  subjectId?: string;
}

/**
 * Hook to fetch teachers with optional filters
 */
export function useTeachers(filters?: UseTeachersFilters) {
  const queryKey = useMemo(() => [...queryKeys.admin.teachers(), filters] as const, [filters]);

  return useQuery({
    queryKey,
    queryFn: async () => {
      // Backend doesn't support filters yet, so we filter client-side
      const teachers = await api.listTeachers();

      if (!filters) return teachers;

      return teachers.filter((teacher) => {
        if (filters.search) {
          const searchLower = filters.search.toLowerCase();
          const matchesSearch =
            teacher.name?.toLowerCase().includes(searchLower) ||
            teacher.email?.toLowerCase().includes(searchLower);
          if (!matchesSearch) return false;
        }
        // Additional filters can be added here when backend supports them
        return true;
      });
    },
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Hook to fetch a single teacher
 */
export function useTeacher(teacherId: string | undefined) {
  return useQuery({
    queryKey: [...queryKeys.admin.teachers(), teacherId] as const,
    queryFn: () => api.getTeacher(teacherId!),
    enabled: !!teacherId,
  });
}

/**
 * Hook to create a teacher
 */
export function useCreateTeacher() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      email: string;
      subjects?: string[];
      assignedClasses?: string[];
    }) => {
      toast.loading('Creating teacher...', { id: 'create-teacher' });
      try {
        const response = await api.createTeacher(data);
        return response;
      } catch (error) {
        toast.dismiss('create-teacher');
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.teachers() });
      toast.dismiss('create-teacher');
      toast.success('Teacher created successfully');
    },
    onError: (error: Error) => {
      toast.dismiss('create-teacher');
      toast.error(error.message || 'Failed to create teacher');
    },
  });
}

/**
 * Hook to update a teacher
 */
export function useUpdateTeacher() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Parameters<typeof api.updateTeacher>[1];
    }) => {
      toast.loading('Updating teacher...', { id: `update-teacher-${id}` });
      try {
        const response = await api.updateTeacher(id, data);
        return response;
      } catch (error) {
        toast.dismiss(`update-teacher-${id}`);
        throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.teachers() });
      queryClient.invalidateQueries({ queryKey: [...queryKeys.admin.teachers(), variables.id] });
      toast.dismiss(`update-teacher-${variables.id}`);
      toast.success('Teacher updated successfully');
    },
    onError: (error: Error, variables) => {
      toast.dismiss(`update-teacher-${variables.id}`);
      toast.error(error.message || 'Failed to update teacher');
    },
  });
}

/**
 * Hook to delete a teacher
 */
export function useDeleteTeacher() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      toast.loading('Deleting teacher...', { id: `delete-teacher-${id}` });
      try {
        await api.deleteTeacher(id);
      } catch (error) {
        toast.dismiss(`delete-teacher-${id}`);
        throw error;
      }
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.teachers() });
      toast.dismiss(`delete-teacher-${id}`);
      toast.success('Teacher deleted successfully');
    },
    onError: (error: Error, id) => {
      toast.dismiss(`delete-teacher-${id}`);
      toast.error(error.message || 'Failed to delete teacher');
    },
  });
}

/**
 * Hook to fetch teacher's assigned classes
 */
export function useTeacherClasses() {
  return useQuery({
    queryKey: ['teacher', 'classes'],
    queryFn: () => api.teachers.getMyClasses(),
    staleTime: 30000, // 30 seconds
  });
}
