/**
 * Reusable Empty State Component
 * Consolidates empty state patterns across the application
 */
import { motion } from 'framer-motion';
import { Card } from './Card';
import { fadeIn } from '../../lib/utils/animations';

export interface EmptyStateProps {
  title?: string;
  message: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  message,
  icon,
  action,
  className = ''
}: EmptyStateProps) {
  return (
    <motion.div
      variants={fadeIn}
      initial="hidden"
      animate="visible"
      className={className}
    >
      <Card padding="lg" className="text-center">
        {icon && (
          <div className="mb-4 flex justify-center text-[var(--brand-muted)]">
            {icon}
          </div>
        )}
        {title && (
          <h3 className="mb-2 text-base font-semibold text-[var(--brand-text-primary)] sm:text-lg">
            {title}
          </h3>
        )}
        <p className="text-sm text-[var(--brand-muted)]">{message}</p>
        {action && <div className="mt-4">{action}</div>}
      </Card>
    </motion.div>
  );
}

export default EmptyState;

