import { useId } from 'react';
import type React from 'react';

export interface AuthDatePickerProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'className'> {
  label: string;
  error?: string;
  helperText?: string;
  containerClassName?: string;
}

export function AuthDatePicker({
  label,
  error,
  helperText,
  containerClassName = '',
  id,
  ...props
}: AuthDatePickerProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const helperId = `${inputId}-helper`;
  const errorId = `${inputId}-error`;
  const describedBy: string[] = [];
  if (helperText) describedBy.push(helperId);
  if (error) describedBy.push(errorId);

  const baseInputClasses =
    'block w-full rounded-lg border bg-[var(--brand-surface)] px-4 py-3 text-base text-[var(--brand-surface-contrast)] placeholder:text-[var(--brand-muted)] shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50';

  const inputStateClasses = error
    ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
    : 'border-[var(--brand-border)] focus:border-[var(--brand-primary)] focus:ring-[var(--brand-primary)]/20';

  const inputClasses = `${baseInputClasses} ${inputStateClasses}`;

  return (
    <div className={`space-y-2 ${containerClassName}`}>
      <label
        htmlFor={inputId}
        className="block text-sm font-semibold text-[var(--brand-surface-contrast)]"
      >
        {label}
        {props.required && <span className="ml-1 text-red-600 dark:text-red-400">*</span>}
      </label>

      <input
        id={inputId}
        type="date"
        aria-describedby={describedBy.join(' ') || undefined}
        aria-invalid={error ? 'true' : 'false'}
        className={inputClasses}
        {...props}
      />

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

export default AuthDatePicker;
