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
      'block w-full rounded-md border bg-slate-950 text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 transition-colors duration-150';

    const fieldClasses = error
      ? 'border-red-500 focus-visible:outline-red-500'
      : 'border-[var(--brand-border)] focus-visible:outline-[var(--brand-primary)]';

    return (
      <div className={`flex flex-col gap-1 ${className}`}>
        {label ? (
          <label htmlFor={selectId} className="text-sm font-medium text-slate-200">
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
          <p id={helperId} className="text-xs text-slate-400">
            {helperText}
          </p>
        ) : null}
        {error ? (
          <p id={errorId} className="text-xs text-red-400" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }
);

Select.displayName = 'Select';

export default Select;


