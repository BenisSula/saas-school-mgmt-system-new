import React, { useId } from 'react';

export interface Option {
  label: string;
  value: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  helperText?: string;
  error?: string;
  options: Option[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, helperText, error, options, className = '', id, ...props }, ref) => {
    const generatedId = useId();
    const selectId = id ?? generatedId;
    const helperId = `${selectId}-helper`;
    const errorId = `${selectId}-error`;
    const describedBy: string[] = [];
    if (helperText) describedBy.push(helperId);
    if (error) describedBy.push(errorId);
    const baseClasses =
      'block w-full rounded-lg border bg-[var(--brand-surface)] text-[var(--brand-text-primary)] focus-visible-ring transition-all duration-200 px-3 py-2 text-sm sm:text-base touch-target';

    const fieldClasses = error
      ? 'border-[var(--brand-error)] focus-visible:ring-[var(--brand-error)]'
      : 'border-[var(--brand-border)] focus-visible:ring-[var(--brand-primary)] hover:border-[var(--brand-border-strong)]';

    return (
      <div className={`flex flex-col gap-1.5 ${className}`}>
        {label ? (
          <label
            htmlFor={selectId}
            className="text-sm font-medium text-[var(--brand-text-primary)]"
          >
            {label}
          </label>
        ) : null}
        <select
          ref={ref}
          id={selectId}
          className={`${baseClasses} ${fieldClasses}`}
          aria-describedby={describedBy.join(' ') || undefined}
          aria-invalid={Boolean(error)}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
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

Select.displayName = 'Select';

export default Select;
