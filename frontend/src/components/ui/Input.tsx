import React, { useId } from 'react';

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

    const baseClasses =
      'block w-full rounded-md border bg-slate-950 text-slate-100 placeholder:text-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 transition-colors duration-150';

    const fieldClasses = error
      ? 'border-red-500 focus-visible:outline-red-500'
      : 'border-[var(--brand-border)] focus-visible:outline-[var(--brand-primary)]';

    return (
      <div className={`flex flex-col gap-1 ${className}`}>
        {label ? (
          <label htmlFor={inputId} className="text-sm font-medium text-slate-200">
            {label}
          </label>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          aria-describedby={describedBy.join(' ') || undefined}
          aria-invalid={Boolean(error)}
          className={`${baseClasses} ${fieldClasses}`}
          {...props}
        />
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

Input.displayName = 'Input';

export default Input;
