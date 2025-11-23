import { useId } from 'react';
import type React from 'react';

export interface AuthSelectOption {
  label: string;
  value: string;
}

export interface AuthSelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'className'> {
  label: string;
  options: AuthSelectOption[];
  error?: string;
  helperText?: string;
  containerClassName?: string;
}

export function AuthSelect({
  label,
  options,
  error,
  helperText,
  containerClassName = '',
  id,
  ...props
}: AuthSelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const helperId = `${selectId}-helper`;
  const errorId = `${selectId}-error`;
  const describedBy: string[] = [];
  if (helperText) describedBy.push(helperId);
  if (error) describedBy.push(errorId);

  const baseSelectClasses =
    'block w-full rounded-lg border bg-[var(--brand-surface)] px-4 py-3 text-base text-[var(--brand-surface-contrast)] shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50';

  const selectStateClasses = error
    ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
    : 'border-[var(--brand-border)] focus:border-[var(--brand-primary)] focus:ring-[var(--brand-primary)]/20';

  const selectClasses = `${baseSelectClasses} ${selectStateClasses}`;

  return (
    <div className={`space-y-2 ${containerClassName}`}>
      <label
        htmlFor={selectId}
        className="block text-sm font-semibold text-[var(--brand-surface-contrast)]"
      >
        {label}
        {props.required && <span className="ml-1 text-red-600 dark:text-red-400">*</span>}
      </label>

      <select
        id={selectId}
        aria-describedby={describedBy.join(' ') || undefined}
        aria-invalid={error ? 'true' : 'false'}
        className={selectClasses}
        {...props}
      >
        {!props.value && <option value="">Select {label.toLowerCase()}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

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

export default AuthSelect;
