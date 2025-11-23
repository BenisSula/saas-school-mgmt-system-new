import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { api } from '../../lib/api';
import { toast } from 'sonner';
import { Key, Eye, EyeOff, AlertCircle } from 'lucide-react';

export interface PasswordManagementModalProps {
  userId: string;
  userEmail?: string;
  isOpen: boolean;
  onClose: () => void;
  mode: 'reset' | 'change';
}

export function PasswordManagementModal({
  userId,
  userEmail,
  isOpen,
  onClose,
  mode
}: PasswordManagementModalProps) {
  const queryClient = useQueryClient();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [reason, setReason] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showTemporaryPassword, setShowTemporaryPassword] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);

  const resetPasswordMutation = useMutation({
    mutationFn: async (payload?: { reason?: string }) => {
      return await api.superuser.resetPassword(userId, payload);
    },
    onSuccess: (data) => {
      toast.success('Password reset successfully');
      setTemporaryPassword(data.temporaryPassword);
      queryClient.invalidateQueries({ queryKey: ['superuser', 'password-history', userId] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to reset password: ${error.message}`);
    }
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (payload: { newPassword: string; reason?: string }) => {
      return await api.superuser.changePassword(userId, payload);
    },
    onSuccess: () => {
      toast.success('Password changed successfully');
      handleClose();
      queryClient.invalidateQueries({ queryKey: ['superuser', 'password-history', userId] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to change password: ${error.message}`);
    }
  });

  const handleClose = () => {
    setNewPassword('');
    setConfirmPassword('');
    setReason('');
    setShowPassword(false);
    setTemporaryPassword(null);
    onClose();
  };

  const handleSubmit = () => {
    if (mode === 'reset') {
      resetPasswordMutation.mutate({ reason: reason || undefined });
    } else {
      if (!newPassword) {
        toast.error('Password is required');
        return;
      }
      if (newPassword.length < 8) {
        toast.error('Password must be at least 8 characters long');
        return;
      }
      if (newPassword !== confirmPassword) {
        toast.error('Passwords do not match');
        return;
      }
      changePasswordMutation.mutate({
        newPassword,
        reason: reason || undefined
      });
    }
  };

  const isResetMode = mode === 'reset';
  const isLoading = resetPasswordMutation.isPending || changePasswordMutation.isPending;

  return (
    <Modal
      title={isResetMode ? 'Reset Password' : 'Change Password'}
      isOpen={isOpen}
      onClose={handleClose}
      footer={
        temporaryPassword ? (
          <Button variant="solid" onClick={handleClose}>
            Close
          </Button>
        ) : (
          <>
            <Button variant="outline" onClick={handleClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              variant="solid"
              onClick={handleSubmit}
              loading={isLoading}
              leftIcon={<Key className="h-4 w-4" />}
            >
              {isResetMode ? 'Reset Password' : 'Change Password'}
            </Button>
          </>
        )
      }
    >
      <div className="space-y-4">
        {userEmail && (
          <div className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface-secondary)] p-3">
            <p className="text-sm text-[var(--brand-text-secondary)]">
              <strong>User:</strong> {userEmail}
            </p>
          </div>
        )}

        {temporaryPassword ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-[var(--brand-success)]/30 bg-[var(--brand-success)]/10 p-4">
              <AlertCircle className="h-5 w-5 text-[var(--brand-success)] mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-[var(--brand-text-primary)]">
                  Password Reset Successful
                </p>
                <p className="mt-1 text-sm text-[var(--brand-text-secondary)]">
                  A temporary password has been generated. Share this with the user securely.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-[var(--brand-text-primary)]">
                Temporary Password
              </label>
              <div className="relative">
                <Input
                  type={showTemporaryPassword ? 'text' : 'password'}
                  value={temporaryPassword}
                  readOnly
                  className="pr-10 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowTemporaryPassword(!showTemporaryPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--brand-muted)] hover:text-[var(--brand-text-primary)]"
                  aria-label={showTemporaryPassword ? 'Hide password' : 'Show password'}
                >
                  {showTemporaryPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(temporaryPassword);
                  toast.success('Password copied to clipboard');
                }}
              >
                Copy Password
              </Button>
            </div>
          </div>
        ) : (
          <>
            {!isResetMode && (
              <>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-[var(--brand-text-primary)]">
                    New Password
                  </label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password (min. 8 characters)"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--brand-muted)] hover:text-[var(--brand-text-primary)]"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-[var(--brand-muted)]">
                    Password must be at least 8 characters long
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-[var(--brand-text-primary)]">
                    Confirm Password
                  </label>
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <label className="block text-sm font-medium text-[var(--brand-text-primary)]">
                Reason (Optional)
              </label>
              <Input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason for password change"
              />
            </div>

            {isResetMode && (
              <div className="flex items-start gap-3 rounded-lg border border-[var(--brand-warning)]/30 bg-[var(--brand-warning)]/10 p-4">
                <AlertCircle className="h-5 w-5 text-[var(--brand-warning)] mt-0.5" />
                <div>
                  <p className="font-semibold text-[var(--brand-text-primary)]">
                    Reset Password
                  </p>
                  <p className="mt-1 text-sm text-[var(--brand-text-secondary)]">
                    A temporary password will be generated. The user will need to change it on their next login.
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

