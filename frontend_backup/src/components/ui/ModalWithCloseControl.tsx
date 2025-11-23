import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './Button';
import { modalAnimation } from '../../lib/utils/animations';

export interface ModalWithCloseControlProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  initialFocusRef?: React.RefObject<HTMLElement>;
  showCloseButton?: boolean; // Control close button visibility
}

export function ModalWithCloseControl({
  title,
  isOpen,
  onClose,
  children,
  footer,
  initialFocusRef,
  showCloseButton = true
}: ModalWithCloseControlProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const lastActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    lastActiveElement.current = document.activeElement as HTMLElement;
    const node =
      initialFocusRef?.current ??
      dialogRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
    node?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && showCloseButton) {
        onClose();
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
      lastActiveElement.current?.focus();
    };
  }, [isOpen, onClose, initialFocusRef, showCloseButton]);

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          role="presentation"
          className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 backdrop-blur-sm sm:px-6"
          style={{
            backgroundColor: 'var(--modal-backdrop)',
            backdropFilter: 'var(--modal-backdrop-blur)'
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && showCloseButton) {
              onClose();
            }
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            ref={dialogRef}
            className="w-full max-w-lg rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] shadow-2xl focus-visible-ring"
            style={{
              borderRadius: 'var(--modal-radius)',
              padding: 'var(--modal-padding)'
            }}
            variants={modalAnimation}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <header className="mb-6 flex items-center justify-between border-b border-[var(--brand-border)] pb-4">
              <h2
                id="modal-title"
                className="text-heading-4 text-[var(--brand-text-primary)]"
              >
                {title}
              </h2>
              {showCloseButton && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  aria-label="Close modal"
                  className="ml-4 -mr-2 text-[var(--brand-text-secondary)] hover:bg-[var(--brand-surface-secondary)] hover:text-[var(--brand-text-primary)]"
                >
                  ✕
                </Button>
              )}
            </header>
            <div className="text-body text-[var(--brand-text-primary)]">
              {children}
            </div>
            {footer ? (
              <footer className="mt-6 flex flex-col items-stretch gap-3 border-t border-[var(--brand-border)] pt-4 sm:flex-row sm:items-center sm:justify-end">
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

export default ModalWithCloseControl;

