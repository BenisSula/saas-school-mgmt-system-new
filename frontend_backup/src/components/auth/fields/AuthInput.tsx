import React, { useId } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export interface AuthInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'className'> {
  label: string;
  error?: string;
  helperText?: string;
  showPasswordToggle?: boolean;
  onTogglePassword?: () => void;
  isPasswordVisible?: boolean;
  containerClassName?: string;
}

export const AuthInput = React.forwardRef<HTMLInputElement, AuthInputProps>(
  (
    {
      label,
      error,
      helperText,
      showPasswordToggle = false,
      onTogglePassword,
      isPasswordVisible = false,
      containerClassName = '',
      id,
      type = 'text',
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const helperId = `${inputId}-helper`;
    const errorId = `${inputId}-error`;
    const describedBy: string[] = [];
    if (helperText) describedBy.push(helperId);
    if (error) describedBy.push(errorId);

    const inputType = showPasswordToggle ? (isPasswordVisible ? 'text' : 'password') : type;

    const baseInputClasses =
      'block w-full rounded-lg border bg-[var(--brand-surface)] px-4 py-3 text-base text-[var(--brand-surface-contrast)] placeholder:text-[var(--brand-muted)] shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50';

    const inputStateClasses = error
      ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
      : 'border-[var(--brand-border)] focus:border-[var(--brand-primary)] focus:ring-[var(--brand-primary)]/20';

    const inputClasses = `${baseInputClasses} ${inputStateClasses} ${
      showPasswordToggle ? 'pr-12' : ''
    }`;

    return (
      <div className={`space-y-2 ${containerClassName}`}>
        <label
          htmlFor={inputId}
          className="block text-sm font-semibold text-[var(--brand-surface-contrast)]"
        >
          {label}
          {props.required && <span className="ml-1 text-red-600 dark:text-red-400">*</span>}
        </label>

        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={inputType}
            aria-describedby={describedBy.join(' ') || undefined}
            aria-invalid={error ? 'true' : 'false'}
            className={inputClasses}
            {...props}
          />

          {showPasswordToggle && (
            <button
              type="button"
              onClick={onTogglePassword}
              aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-[var(--brand-muted)] transition-colors hover:bg-[var(--brand-surface)]/50 hover:text-[var(--brand-surface-contrast)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20"
            >
              {isPasswordVisible ? (
                <EyeOff className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Eye className="h-5 w-5" aria-hidden="true" />
              )}
            </button>
          )}
        </div>

        {helperText && !error && (
          <p id={helperId} className="text-xs text-[var(--brand-muted)]">
            {helperText}
          </p>
        )}

        {error && (
          <p
            id={errorId}
            className="text-xs font-medium text-red-600 dark:text-red-400"
            role="alert"
            aria-live="polite"
          >
            {error}
          </p>
        )}
      </div>
    );
  }
);

AuthInput.displayName = 'AuthInput';

export default AuthInput;
