/**
 * Global Button Behavior Contract
 * 
 * All functional buttons must follow this contract to ensure consistent behavior:
 * 1. Execute mutation
 * 2. Show toast feedback (pending, success, error)
 * 3. Invalidate relevant queries
 * 4. Close modal (if applicable)
 */

import type { UseMutationResult } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { QueryClient } from '@tanstack/react-query';

export interface ButtonActionConfig<TData = unknown, TVariables = unknown> {
  /**
   * The mutation to execute
   */
  mutation: UseMutationResult<TData, Error, TVariables>;
  
  /**
   * Variables to pass to the mutation
   */
  variables: TVariables;
  
  /**
   * Query keys to invalidate after successful mutation
   */
  invalidateQueries?: readonly unknown[][];
  
  /**
   * Query client instance (optional, will use default if not provided)
   */
  queryClient?: QueryClient;
  
  /**
   * Toast messages
   */
  messages: {
    pending: string;
    success: string;
    error?: string;
  };
  
  /**
   * Toast ID for managing loading state
   */
  toastId?: string;
  
  /**
   * Callback to close modal (if applicable)
   */
  onClose?: () => void;
  
  /**
   * Additional success callback
   */
  onSuccess?: (data: TData) => void;
  
  /**
   * Additional error callback
   */
  onError?: (error: Error) => void;
}

/**
 * Executes a button action following the contract
 */
export async function executeButtonAction<TData = unknown, TVariables = unknown>(
  config: ButtonActionConfig<TData, TVariables>
): Promise<void> {
  const {
    mutation,
    variables,
    messages,
    toastId = 'button-action',
    onClose,
    onSuccess,
    onError
  } = config;

  // Show pending toast
  toast.loading(messages.pending, { id: toastId });

  try {
    // Execute mutation
    const data = await mutation.mutateAsync(variables);

    // Invalidate queries
    // Note: Query invalidation is handled by the mutation's onSuccess handler
    // which should be configured when creating the mutation

    // Dismiss pending toast and show success
    toast.dismiss(toastId);
    toast.success(messages.success);

    // Close modal if provided
    onClose?.();

    // Call success callback
    onSuccess?.(data);
  } catch (error) {
    // Dismiss pending toast and show error
    toast.dismiss(toastId);
    toast.error(messages.error || (error instanceof Error ? error.message : 'An error occurred'));

    // Call error callback
    onError?.(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Hook for creating button actions that follow the contract
 */
export function useButtonAction<TData = unknown, TVariables = unknown>() {
  return {
    execute: (config: ButtonActionConfig<TData, TVariables>) => 
      executeButtonAction(config)
  };
}

