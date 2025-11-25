import { memo, type ReactNode } from 'react';
import { Card } from '../ui/Card';

export interface DetailField {
  label: string;
  value: ReactNode;
  span?: 1 | 2; // Grid span (1 or 2 columns)
}

export interface DetailCardProps {
  title: string;
  fields: DetailField[];
  actions?: ReactNode;
  className?: string;
}

/**
 * Reusable component for displaying detailed information in a card format
 * Uses DRY principle - single component for all detail views
 * Memoized to prevent unnecessary re-renders
 */
function DetailCardComponent({ title, fields, actions, className = '' }: DetailCardProps) {
  return (
    <Card className={`p-6 ${className}`}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[var(--brand-surface-contrast)]">{title}</h3>
        {actions && <div className="flex gap-2">{actions}</div>}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {fields.map((field, index) => (
          <div key={index} className={field.span === 2 ? 'md:col-span-2' : ''}>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-muted)]">
                {field.label}
              </label>
              <div className="text-sm text-[var(--brand-surface-contrast)]">
                {field.value || <span className="text-[var(--brand-muted)]">Not provided</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export const DetailCard = memo(DetailCardComponent);
export default DetailCard;
