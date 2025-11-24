/**
 * Shared hook for button actions following the ButtonActionContract
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { executeButtonAction } from '../components/buttons/ButtonActionContract';

export interface UseButtonActionOptions<TData, TVariables> {
  mutationFn: (variables: TVariables) => Promise<TData>;
  invalidateQueries?: readonly unknown[][];
  messages: {
    pending: string;
    success: string;
    error?: string;
  };
  onSuccess?: (data: TData) => void;
  onError?: (error: Error) => void;
}

/**
 * Hook that creates a mutation and provides an execute function following the contract
 */
export function useButtonAction<TData = unknown, TVariables = unknown>(
  options: UseButtonActionOptions<TData, TVariables>
) {
  const queryClient = useQueryClient();
  const { mutationFn, invalidateQueries = [], messages, onSuccess, onError } = options;

  const mutation = useMutation({
    mutationFn,
    onSuccess: (data) => {
      // Invalidate queries
      invalidateQueries.forEach((queryKey) => {
        queryClient.invalidateQueries({ queryKey });
      });
      onSuccess?.(data);
    },
    onError: (error: Error) => {
      onError?.(error);
    },
  });

  const execute = async (
    variables: TVariables,
    config?: {
      toastId?: string;
      onClose?: () => void;
      additionalSuccess?: (data: TData) => void;
      additionalError?: (error: Error) => void;
    }
  ) => {
    await executeButtonAction({
      mutation,
      variables,
      invalidateQueries,
      queryClient,
      messages,
      toastId: config?.toastId,
      onClose: config?.onClose,
      onSuccess: (data) => {
        onSuccess?.(data);
        config?.additionalSuccess?.(data);
      },
      onError: (error) => {
        onError?.(error);
        config?.additionalError?.(error);
      },
    });
  };

  return {
    mutation,
    execute,
    isLoading: mutation.isPending,
  };
}
