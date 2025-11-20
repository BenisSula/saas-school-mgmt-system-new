import { CheckCircle2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface SuccessBannerProps {
  message: string;
  onDismiss?: () => void;
  className?: string;
  variant?: 'default' | 'inline';
}

/**
 * Reusable success banner component
 * Extracted from AuthSuccessBanner for global use
 */
export function SuccessBanner({
  message,
  onDismiss,
  className = '',
  variant = 'default'
}: SuccessBannerProps) {
  if (!message) return null;

  const baseClasses =
    variant === 'inline'
      ? 'rounded-md border border-green-500/60 bg-green-500/10 dark:bg-green-900/20 dark:border-green-500/40 p-3'
      : 'rounded-lg border border-[var(--brand-accent)]/50 bg-[var(--brand-accent)]/10 p-4';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={`${baseClasses} ${className}`}
        role="alert"
        aria-live="polite"
      >
        <div className="flex items-start gap-3">
          <CheckCircle2
            className="h-5 w-5 flex-shrink-0 text-[var(--brand-accent)]"
            aria-hidden="true"
          />
          <p className="flex-1 text-sm font-medium text-[var(--brand-surface-contrast)]">
            {message}
          </p>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss success message"
              className="flex-shrink-0 rounded-md p-1 text-[var(--brand-muted)] transition-colors hover:bg-[var(--brand-surface)]/50 hover:text-[var(--brand-surface-contrast)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default SuccessBanner;

