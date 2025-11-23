/**
 * Standardized React Query hook for Classes
 * Provides consistent query keys and mutation invalidation
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../useQuery';
import { api } from '../../lib/api';
import { toast } from 'sonner';

/**
 * Hook to fetch all classes
 */
export function useClasses() {
  return useQuery({
    queryKey: queryKeys.admin.classes(),
    queryFn: () => api.listClasses(),
    staleTime: 60000, // 1 minute (classes don't change often)
  });
}

/**
 * Hook to fetch a single class
 */
export function useClass(classId: string | undefined) {
  return useQuery({
    queryKey: [...queryKeys.admin.classes(), classId] as const,
    queryFn: async () => {
      const classes = await api.listClasses();
      return classes.find((c) => c.id === classId);
    },
    enabled: !!classId,
  });
}

/**
 * Hook to create a class
 */
export function useCreateClass() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Parameters<typeof api.createClass>[0]) => {
      toast.loading('Creating class...', { id: 'create-class' });
      try {
        const response = await api.createClass(data);
        return response;
      } catch (error) {
        toast.dismiss('create-class');
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.classes() });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.students() }); // Students may change class assignments
      toast.dismiss('create-class');
      toast.success('Class created successfully');
    },
    onError: (error: Error) => {
      toast.dismiss('create-class');
      toast.error(error.message || 'Failed to create class');
    },
  });
}

/**
 * Hook to update a class
 */
export function useUpdateClass() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Parameters<typeof api.updateClass>[1] }) => {
      toast.loading('Updating class...', { id: `update-class-${id}` });
      try {
        const response = await api.updateClass(id, data);
        return response;
      } catch (error) {
        toast.dismiss(`update-class-${id}`);
        throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.classes() });
      queryClient.invalidateQueries({ queryKey: [...queryKeys.admin.classes(), variables.id] });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.students() }); // Students may change class assignments
      toast.dismiss(`update-class-${variables.id}`);
      toast.success('Class updated successfully');
    },
    onError: (error: Error, variables) => {
      toast.dismiss(`update-class-${variables.id}`);
      toast.error(error.message || 'Failed to update class');
    },
  });
}

/**
 * Hook to delete a class
 */
export function useDeleteClass() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      toast.loading('Deleting class...', { id: `delete-class-${id}` });
      try {
        await api.deleteClass(id);
      } catch (error) {
        toast.dismiss(`delete-class-${id}`);
        throw error;
      }
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.classes() });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.students() }); // Students may change class assignments
      toast.dismiss(`delete-class-${id}`);
      toast.success('Class deleted successfully');
    },
    onError: (error: Error, id) => {
      toast.dismiss(`delete-class-${id}`);
      toast.error(error.message || 'Failed to delete class');
    },
  });
}

