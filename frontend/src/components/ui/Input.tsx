import React, { useId } from 'react';
import { cn } from '../../lib/utils/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, helperText, error, className = '', id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const helperId = `${inputId}-helper`;
    const errorId = `${inputId}-error`;
    const describedBy: string[] = [];
    if (helperText) describedBy.push(helperId);
    if (error) describedBy.push(errorId);
    const hasError = Boolean(error);

    const baseClasses =
      'block w-full rounded-lg border bg-[var(--brand-surface)] text-[var(--brand-text-primary)] placeholder:text-[var(--brand-muted)] focus-visible-ring transition-all duration-200 px-3 py-2 text-sm sm:text-base touch-target';

    const fieldClasses = hasError
      ? 'border-[var(--brand-error)] focus-visible:ring-[var(--brand-error)]'
      : 'border-[var(--brand-border)] focus-visible:ring-[var(--brand-primary)] hover:border-[var(--brand-border-strong)]';

    return (
      <div className={cn('flex flex-col gap-1.5', className)}>
        {label ? (
          <label htmlFor={inputId} className="text-sm font-medium text-[var(--brand-text-primary)]">
            {label}
          </label>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          aria-describedby={describedBy.length > 0 ? describedBy.join(' ') : undefined}
          {...(hasError ? { 'aria-invalid': 'true' as const } : {})}
          className={cn(baseClasses, fieldClasses)}
          {...props}
        />
        {helperText ? (
          <p id={helperId} className="text-xs text-[var(--brand-muted)]">
            {helperText}
          </p>
        ) : null}
        {error ? (
          <p id={errorId} className="text-xs text-[var(--brand-error)]" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
