import React from 'react';

export interface FormSectionProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Reusable form section wrapper component
 * Provides consistent spacing and optional title/description
 */
export function FormSection({ title, description, children, className = '' }: FormSectionProps) {
  return (
    <div className={`space-y-4 ${className}`}>
      {(title || description) && (
        <div className="space-y-1">
          {title && (
            <h3 className="text-base font-semibold text-[var(--brand-surface-contrast)]">
              {title}
            </h3>
          )}
          {description && <p className="text-sm text-[var(--brand-muted)]">{description}</p>}
        </div>
      )}
      <div className="space-y-4">{children}</div>
    </div>
  );
}

export default FormSection;
