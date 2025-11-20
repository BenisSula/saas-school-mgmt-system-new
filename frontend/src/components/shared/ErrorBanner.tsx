import { AlertCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface ErrorBannerProps {
  message: string;
  onDismiss?: () => void;
  className?: string;
  variant?: 'default' | 'inline';
}

/**
 * Reusable error banner component
 * Extracted from AuthErrorBanner for global use
 */
export function ErrorBanner({
  message,
  onDismiss,
  className = '',
  variant = 'default'
}: ErrorBannerProps) {
  if (!message) return null;

  const baseClasses =
    variant === 'inline'
      ? 'rounded-md border border-red-500/60 bg-red-500/10 dark:bg-red-900/20 dark:border-red-500/40 p-3'
      : 'rounded-lg border border-red-500/60 bg-red-500/10 dark:bg-red-900/20 dark:border-red-500/40 p-4';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={`${baseClasses} ${className}`}
        role="alert"
        aria-live="assertive"
      >
        <div className="flex items-start gap-3">
          <AlertCircle
            className="h-5 w-5 flex-shrink-0 text-red-500 dark:text-red-400"
            aria-hidden="true"
          />
          <p className="flex-1 text-sm font-medium text-red-700 dark:text-red-200">{message}</p>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss error"
              className="flex-shrink-0 rounded-md p-1 text-red-600 dark:text-red-400 transition-colors hover:bg-red-500/20 dark:hover:bg-red-500/30 hover:text-red-800 dark:hover:text-red-300 focus:outline-none focus:ring-2 focus:ring-red-500/20"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default ErrorBanner;

