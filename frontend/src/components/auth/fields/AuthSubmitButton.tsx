import React from 'react';
import { Button } from '../../ui/Button';

export interface AuthSubmitButtonProps {
  loading?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'accent';
  fullWidth?: boolean;
  className?: string;
}

export function AuthSubmitButton({
  loading = false,
  disabled = false,
  children,
  variant = 'primary',
  fullWidth = true,
  className = '',
}: AuthSubmitButtonProps) {
  const isDisabled = disabled || loading;

  const variantClasses = {
    primary:
      'bg-[var(--brand-primary)] text-[var(--brand-primary-contrast)] hover:brightness-110 focus-visible:outline-[var(--brand-primary)]',
    secondary:
      'bg-[var(--brand-secondary)] text-[var(--brand-secondary-contrast)] hover:brightness-110 focus-visible:outline-[var(--brand-secondary)]',
    accent:
      'bg-[var(--brand-accent)] text-[var(--brand-accent-contrast)] hover:brightness-110 focus-visible:outline-[var(--brand-accent)]',
  };

  return (
    <Button
      type="submit"
      disabled={isDisabled}
      className={`${fullWidth ? 'w-full' : ''} ${variantClasses[variant]} ${className}`}
      size="lg"
    >
      {loading && (
        <span
          className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      )}
      <span>{children}</span>
    </Button>
  );
}

export default AuthSubmitButton;
