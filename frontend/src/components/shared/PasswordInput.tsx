import React, { useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import type { TextInputProps } from './TextInput';

export interface PasswordInputProps
  extends Omit<TextInputProps, 'type' | 'showPasswordToggle' | 'onTogglePassword' | 'isPasswordVisible'> {
  showToggle?: boolean;
}

/**
 * Reusable password input component with visibility toggle
 * Extracted from AuthInput for global use
 */
export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ showToggle = true, containerClassName = '', id, helperText, error, label, required, ...props }, ref) => {
    const [isVisible, setIsVisible] = useState(false);
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const toggleId = `${inputId}-toggle`;

    const baseInputClasses =
      'block w-full rounded-lg border bg-[var(--brand-surface)] px-4 py-3 pr-12 text-sm sm:text-base text-[var(--brand-surface-contrast)] placeholder:text-[var(--brand-muted)] shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50';

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
          {required && <span className="ml-1 text-red-600 dark:text-red-400">*</span>}
        </label>

        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={isVisible ? 'text' : 'password'}
            aria-describedby={
              helperText || error
                ? `${inputId}-${error ? 'error' : 'helper'}`
                : undefined
            }
            aria-invalid={error ? 'true' : 'false'}
            className={inputClasses}
            {...props}
          />

          {showToggle && (
            <button
              type="button"
              id={toggleId}
              onClick={() => setIsVisible(!isVisible)}
              aria-label={isVisible ? 'Hide password' : 'Show password'}
              aria-pressed={isVisible}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-[var(--brand-muted)] transition-colors hover:bg-[var(--brand-surface)]/50 hover:text-[var(--brand-surface-contrast)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20"
            >
              {isVisible ? (
                <EyeOff className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Eye className="h-5 w-5" aria-hidden="true" />
              )}
            </button>
          )}
        </div>

        {helperText && !error && (
          <p id={`${inputId}-helper`} className="text-xs text-[var(--brand-muted)]">
            {helperText}
          </p>
        )}

        {error && (
          <p
            id={`${inputId}-error`}
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

PasswordInput.displayName = 'PasswordInput';

export default PasswordInput;

