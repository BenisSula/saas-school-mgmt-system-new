import { Button } from '../ui/Button';
import { Trash2 } from 'lucide-react';
import type { UseMutationResult } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

export interface DeleteButtonProps<TData = unknown, TVariables = unknown> {
  mutation: UseMutationResult<TData, Error, TVariables>;
  variables: TVariables;
  invalidateQueries?: readonly unknown[][];
  messages: {
    pending: string;
    success: string;
    error?: string;
  };
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'solid' | 'outline' | 'ghost';
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  confirmMessage?: string;
}

export function DeleteButton<TData = unknown, TVariables = unknown>({
  mutation,
  variables,
  invalidateQueries,
  messages,
  label = 'Delete',
  size = 'sm',
  variant = 'ghost',
  onSuccess,
  onError,
  confirmMessage,
}: DeleteButtonProps<TData, TVariables>) {
  const queryClient = useQueryClient();

  const handleClick = async () => {
    // Show confirmation if provided
    if (confirmMessage) {
      const confirmed = window.confirm(confirmMessage);
      if (!confirmed) return;
    }

    const toastId = `delete-${typeof variables === 'string' ? variables : 'item'}`;

    // Show pending toast
    toast.loading(messages.pending, { id: toastId });

    try {
      await mutation.mutateAsync(variables);

      // Invalidate queries if provided
      if (invalidateQueries) {
        invalidateQueries.forEach((queryKey) => {
          queryClient.invalidateQueries({ queryKey });
        });
      }

      toast.dismiss(toastId);
      toast.success(messages.success);
      onSuccess?.();
    } catch (error) {
      toast.dismiss(toastId);
      toast.error(messages.error || (error instanceof Error ? error.message : 'Failed to delete'));
      onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  };

  return (
    <Button
      size={size}
      variant={variant}
      onClick={handleClick}
      disabled={mutation.isPending}
      loading={mutation.isPending}
      leftIcon={<Trash2 className="h-4 w-4" />}
      aria-label={label}
    >
      {label}
    </Button>
  );
}
