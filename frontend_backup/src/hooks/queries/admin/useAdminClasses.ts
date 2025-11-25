/**
 * React Query hooks for Admin Class Management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { toast } from 'sonner';
import { unwrapApiResponse } from '../../../lib/apiResponseUtils';

export interface AdminClass {
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
}

export interface CreateClassInput {
  name: string;
  description?: string;
  gradeLevel?: string;
  section?: string;
  departmentId?: string;
  capacity?: number;
  academicYear?: string;
  metadata?: Record<string, unknown>;
}

export function useAdminClasses(includeCounts: boolean = true) {
  return useQuery({
    queryKey: ['admin', 'classes', includeCounts],
    queryFn: async () => {
      const response = await api.admin.listClasses(includeCounts);
      return unwrapApiResponse(response);
    },
    staleTime: 60000, // 1 minute
  });
}

export function useAdminClass(id: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'classes', id],
    queryFn: () => (id ? api.admin.getClass(id) : null),
    enabled: !!id,
    staleTime: 60000,
  });
}

export function useCreateAdminClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateClassInput) => api.admin.createClass(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'classes'] });
      toast.success('Class created successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create class');
    },
  });
}

export function useUpdateAdminClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CreateClassInput> }) =>
      api.admin.updateClass(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'classes'] });
      toast.success('Class updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update class');
    },
  });
}

export function useDeleteAdminClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.admin.deleteClass(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'classes'] });
      toast.success('Class deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete class');
    },
  });
}

export function useAssignClassTeacher() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ classId, teacherUserId }: { classId: string; teacherUserId: string }) =>
      api.admin.assignClassTeacher(classId, teacherUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'classes'] });
      toast.success('Class teacher assigned successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to assign class teacher');
    },
  });
}

export function useAssignStudentsToClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ classId, studentIds }: { classId: string; studentIds: string[] }) =>
      api.admin.assignStudentsToClass(classId, studentIds),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'classes'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'students'] });
      toast.success(`Assigned ${result.assigned} student(s), ${result.failed} failed`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to assign students');
    },
  });
}

