/**
 * React Query hooks for Department Management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, extractApiData } from '../../../lib/api';
import { toast } from 'sonner';

export interface Department {
  id: string;
  name: string;
  slug: string;
  contactEmail: string | null;
  contactPhone: string | null;
  hodCount?: number;
  teacherCount?: number;
  hod?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateDepartmentInput {
  name: string;
  slug?: string;
  contactEmail?: string;
  contactPhone?: string;
  metadata?: Record<string, unknown>;
}

export function useDepartments(includeCounts: boolean = true) {
  return useQuery({
    queryKey: ['admin', 'departments', includeCounts],
    queryFn: async () => {
      const response = await api.admin.listDepartments(includeCounts);
      // Backend returns { success: true, data: [...] }
      const data = extractApiData(response);
      return Array.isArray(data) ? data : [];
    },
    staleTime: 60000, // 1 minute
  });
}

export function useDepartment(id: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'departments', id],
    queryFn: async () => {
      if (!id) return null;
      const response = await api.admin.getDepartment(id);
      return extractApiData(response);
    },
    enabled: !!id,
    staleTime: 60000,
  });
}

export function useCreateDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateDepartmentInput) => api.admin.createDepartment(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'departments'] });
      toast.success('Department created successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create department');
    },
  });
}

export function useUpdateDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CreateDepartmentInput> }) =>
      api.admin.updateDepartment(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'departments'] });
      toast.success('Department updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update department');
    },
  });
}

export function useDeleteDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.admin.deleteDepartment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'departments'] });
      toast.success('Department deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete department');
    },
  });
}

export function useAssignHODToDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ departmentId, userId }: { departmentId: string; userId: string }) =>
      api.admin.assignHODToDepartment(departmentId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'departments'] });
      toast.success('HOD assigned successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to assign HOD');
    },
  });
}
