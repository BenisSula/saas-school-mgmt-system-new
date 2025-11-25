/**
 * Shared Form Modal Component
 * Reusable modal for forms with save/cancel actions following ButtonActionContract
 */

import type { ReactNode } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import type { UseMutationResult } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

export interface FormModalProps<TData = unknown, TVariables = unknown> {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  mutation?: UseMutationResult<TData, Error, TVariables>;
  variables?: TVariables;
  invalidateQueries?: readonly unknown[][];
  messages?: {
    pending: string;
    success: string;
    error?: string;
  };
  onSuccess?: (data: TData) => void;
  saveLabel?: string;
  cancelLabel?: string;
  footer?: ReactNode;
}

/**
 * Shared form modal that handles save/cancel actions following the ButtonActionContract
 */
export function FormModal<TData = unknown, TVariables = unknown>({
  title,
  isOpen,
  onClose,
  children,
  mutation,
  variables,
  invalidateQueries,
  messages,
  onSuccess,
  saveLabel = 'Save',
  cancelLabel = 'Cancel',
  footer
}: FormModalProps<TData, TVariables>) {
  const queryClient = useQueryClient();

  const handleSave = async () => {
    if (!mutation || !variables) {
      toast.error('Please fill in all required fields');
      return;
    }

    const toastId = `form-modal-${title.replace(/\s+/g, '-').toLowerCase()}`;
    const pendingMsg = messages?.pending || 'Saving...';
    const successMsg = messages?.success || 'Saved successfully';
    const errorMsg = messages?.error || 'Failed to save';

    toast.loading(pendingMsg, { id: toastId });

    try {
      const data = await mutation.mutateAsync(variables);

      // Invalidate queries
      if (invalidateQueries) {
        invalidateQueries.forEach((queryKey) => {
          queryClient.invalidateQueries({ queryKey });
        });
      }

      toast.dismiss(toastId);
      toast.success(successMsg);

      onSuccess?.(data);
      onClose();
    } catch {
      toast.dismiss(toastId);
      toast.error(errorMsg);
    }
  };

  const canSave = mutation && variables;
  const defaultFooter = (
    <div className="flex justify-end gap-3 pt-2">
      <Button variant="ghost" onClick={onClose} disabled={mutation?.isPending}>
        {cancelLabel}
      </Button>
      {canSave && (
        <Button
          onClick={handleSave}
          disabled={mutation.isPending || !variables}
          loading={mutation.isPending}
        >
          {saveLabel}
        </Button>
      )}
    </div>
  );

  return (
    <Modal
      title={title}
      isOpen={isOpen}
      onClose={onClose}
      footer={footer || defaultFooter}
    >
      {children}
    </Modal>
  );
}

