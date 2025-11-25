import { CheckCircle2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface AuthSuccessBannerProps {
  message: string;
  onDismiss?: () => void;
  className?: string;
}

export function AuthSuccessBanner({ message, onDismiss, className = '' }: AuthSuccessBannerProps) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className={`rounded-lg border border-[var(--brand-accent)]/50 bg-[var(--brand-accent)]/10 p-4 ${className}`}
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
      )}
    </AnimatePresence>
  );
}

export default AuthSuccessBanner;
