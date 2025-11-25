/**
 * Standardized React Query hook for Academic Terms
 * Provides consistent query keys and mutation invalidation
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../useQuery';
import { api } from '../../lib/api';
import { toast } from 'sonner';

/**
 * Hook to fetch all academic terms
 */
export function useTerms() {
  return useQuery({
    queryKey: queryKeys.admin.subjects(), // Using subjects key as terms are part of configuration
    queryFn: () => api.listTerms(),
    staleTime: 60000, // 1 minute
  });
}

/**
 * Hook to create an academic term
 */
export function useCreateTerm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { name: string; startsOn: string; endsOn: string }) => {
      toast.loading('Creating term...', { id: 'create-term' });
      try {
        const response = await api.createTerm(data);
        return response;
      } catch (error) {
        toast.dismiss('create-term');
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.subjects() });
      toast.dismiss('create-term');
      toast.success('Term created successfully');
    },
    onError: (error: Error) => {
      toast.dismiss('create-term');
      toast.error(error.message || 'Failed to create term');
    },
  });
}

/**
 * Hook to update an academic term
 */
export function useUpdateTerm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: { name: string; startsOn: string; endsOn: string };
    }) => {
      toast.loading('Updating term...', { id: `update-term-${id}` });
      try {
        const response = await api.updateTerm(id, data);
        return response;
      } catch (error) {
        toast.dismiss(`update-term-${id}`);
        throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.subjects() });
      toast.dismiss(`update-term-${variables.id}`);
      toast.success('Term updated successfully');
    },
    onError: (error: Error, variables) => {
      toast.dismiss(`update-term-${variables.id}`);
      toast.error(error.message || 'Failed to update term');
    },
  });
}

/**
 * Hook to delete an academic term
 */
export function useDeleteTerm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      toast.loading('Deleting term...', { id: `delete-term-${id}` });
      try {
        await api.deleteTerm(id);
      } catch (error) {
        toast.dismiss(`delete-term-${id}`);
        throw error;
      }
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.subjects() });
      toast.dismiss(`delete-term-${id}`);
      toast.success('Term deleted successfully');
    },
    onError: (error: Error, id) => {
      toast.dismiss(`delete-term-${id}`);
      toast.error(error.message || 'Failed to delete term');
    },
  });
}
