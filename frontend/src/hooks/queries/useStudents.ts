/**
 * Standardized React Query hook for Students
 * Provides consistent query keys and mutation invalidation
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../useQuery';
import { api } from '../../lib/api';
import { toast } from 'sonner';
import { useMemo } from 'react';

export interface UseStudentsFilters {
  classId?: string;
  enrollmentStatus?: string;
  search?: string;
}

/**
 * Hook to fetch students with optional filters
 */
export function useStudents(filters?: UseStudentsFilters) {
  const queryKey = useMemo(() => [...queryKeys.admin.students(), filters] as const, [filters]);

  return useQuery({
    queryKey,
    queryFn: async () => {
      const apiFilters: UseStudentsFilters = {};
      if (filters?.classId && filters.classId !== 'all') {
        apiFilters.classId = filters.classId;
      }
      if (filters?.enrollmentStatus && filters.enrollmentStatus !== 'all') {
        apiFilters.enrollmentStatus = filters.enrollmentStatus;
      }
      if (filters?.search) {
        apiFilters.search = filters.search;
      }

      return api.listStudents(Object.keys(apiFilters).length > 0 ? apiFilters : undefined);
    },
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Hook to fetch a single student
 */
export function useStudent(studentId: string | undefined) {
  return useQuery({
    queryKey: [...queryKeys.admin.students(), studentId] as const,
    queryFn: () => api.getStudent(studentId!),
    enabled: !!studentId,
  });
}

/**
 * Hook to create a student
 */
export function useCreateStudent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      firstName: string;
      lastName: string;
      dateOfBirth?: string;
      classId?: string;
      admissionNumber?: string;
      parentContacts?: Array<{ name: string; relationship: string; phone: string }>;
    }) => {
      toast.loading('Creating student...', { id: 'create-student' });
      try {
        const response = await api.createStudent(data);
        return response;
      } catch (error) {
        toast.dismiss('create-student');
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.students() });
      toast.dismiss('create-student');
      toast.success('Student created successfully');
    },
    onError: (error: Error) => {
      toast.dismiss('create-student');
      toast.error(error.message || 'Failed to create student');
    },
  });
}

/**
 * Hook to update a student
 */
export function useUpdateStudent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Parameters<typeof api.updateStudent>[1];
    }) => {
      toast.loading('Updating student...', { id: `update-student-${id}` });
      try {
        const response = await api.updateStudent(id, data);
        return response;
      } catch (error) {
        toast.dismiss(`update-student-${id}`);
        throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.students() });
      queryClient.invalidateQueries({ queryKey: [...queryKeys.admin.students(), variables.id] });
      toast.dismiss(`update-student-${variables.id}`);
      toast.success('Student updated successfully');
    },
    onError: (error: Error, variables) => {
      toast.dismiss(`update-student-${variables.id}`);
      toast.error(error.message || 'Failed to update student');
    },
  });
}

/**
 * Hook to delete a student
 */
export function useDeleteStudent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      toast.loading('Deleting student...', { id: `delete-student-${id}` });
      try {
        await api.deleteStudent(id);
      } catch (error) {
        toast.dismiss(`delete-student-${id}`);
        throw error;
      }
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.students() });
      toast.dismiss(`delete-student-${id}`);
      toast.success('Student deleted successfully');
    },
    onError: (error: Error, id) => {
      toast.dismiss(`delete-student-${id}`);
      toast.error(error.message || 'Failed to delete student');
    },
  });
}

/**
 * Hook to bulk delete students
 */
export function useBulkDeleteStudents() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      toast.loading(`Deleting ${ids.length} student(s)...`, { id: 'bulk-delete-students' });
      try {
        await Promise.all(ids.map((id) => api.deleteStudent(id)));
      } catch (error) {
        toast.dismiss('bulk-delete-students');
        throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.students() });
      toast.dismiss('bulk-delete-students');
      toast.success(`${variables.length} student(s) deleted successfully`);
    },
    onError: (error: Error) => {
      toast.dismiss('bulk-delete-students');
      toast.error(error.message || 'Failed to delete students');
    },
  });
}
