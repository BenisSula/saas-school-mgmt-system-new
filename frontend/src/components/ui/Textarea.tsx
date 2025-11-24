import { forwardRef, type TextareaHTMLAttributes } from 'react';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = '', error = false, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={`w-full rounded-md border px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent ${
          error
            ? 'border-[var(--brand-error)] bg-[var(--brand-error-light)]'
            : 'border-[var(--brand-border)] bg-[var(--brand-surface-secondary)] text-[var(--brand-text-primary)]'
        } ${className}`}
        {...props}
      />
    );
  }
);

Textarea.displayName = 'Textarea';
