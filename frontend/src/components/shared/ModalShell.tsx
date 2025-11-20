import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { Button } from '../ui/Button';
import { modalAnimation } from '../../lib/utils/animations';

export interface ModalShellProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  initialFocusRef?: React.RefObject<HTMLElement>;
  showCloseButton?: boolean;
}

/**
 * Reusable modal shell component
 * Enhanced version of Modal for global use with consistent styling
 */
export function ModalShell({
  title,
  isOpen,
  onClose,
  children,
  footer,
  size = 'md',
  initialFocusRef,
  showCloseButton = true
}: ModalShellProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const lastActiveElement = useRef<HTMLElement | null>(null);

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl'
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
    
    lastActiveElement.current = document.activeElement as HTMLElement;
    const node =
      initialFocusRef?.current ??
      dialogRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
    node?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key === 'Tab') {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable || focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      lastActiveElement.current?.focus();
    };
  }, [isOpen, onClose, initialFocusRef]);

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          role="presentation"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6 backdrop-blur-md sm:px-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              onClose();
            }
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              onClose();
            }
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            ref={dialogRef}
            className={`w-full ${sizeClasses[size]} rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] text-[var(--brand-surface-contrast)] shadow-2xl focus-visible-ring max-h-[90vh] overflow-hidden flex flex-col`}
            variants={modalAnimation}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between border-b border-[var(--brand-border)] px-4 py-3 sm:px-6 sm:py-4 flex-shrink-0">
              <h2 id="modal-title" className="text-base font-semibold sm:text-lg text-[var(--brand-surface-contrast)]">
                {title}
              </h2>
              {showCloseButton && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  aria-label="Close modal"
                  className="text-[var(--brand-surface-contrast)] hover:bg-[var(--brand-surface-secondary)] transition-colors duration-200"
                >
                  <X className="h-5 w-5" />
                </Button>
              )}
            </header>
            <div className="px-4 py-4 text-sm text-[var(--brand-text-primary)] sm:px-6 overflow-y-auto flex-1">
              {children}
            </div>
            {footer ? (
              <footer className="flex flex-col items-stretch gap-2 border-t border-[var(--brand-border)] px-4 py-3 sm:flex-row sm:items-center sm:justify-end sm:px-6 sm:py-4 flex-shrink-0">
                {footer}
              </footer>
            ) : null}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

export default ModalShell;

