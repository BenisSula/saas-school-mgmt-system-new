import React, { useCallback, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AuthPanel, type AuthView } from './AuthPanel';

export interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: AuthView;
  setMode: (mode: AuthView) => void;
}

export function AuthModal({ isOpen, onClose, mode, setMode }: AuthModalProps) {
  const location = useLocation();
  const lastLocationRef = useRef<string>('');
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previousOverflow = useRef<string>('');

  useEffect(() => {
    const signature = `${location.pathname}${location.search}${location.hash}`;
    if (!isOpen) {
      lastLocationRef.current = signature;
      return;
    }
    if (lastLocationRef.current && lastLocationRef.current !== signature) {
      onClose();
    }
    lastLocationRef.current = signature;
    setMode('login');
  }, [isOpen, location.hash, location.pathname, location.search, onClose, setMode]);

  const enforceFocus = useCallback((event: KeyboardEvent) => {
    if (event.key !== 'Tab' || !dialogRef.current) return;
    const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement as HTMLElement | null;

    if (event.shiftKey) {
      if (active === first || !active) {
        event.preventDefault();
        last.focus();
      }
    } else if (active === last) {
      event.preventDefault();
      first.focus();
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      if (previousOverflow.current) {
        document.body.style.overflow = previousOverflow.current;
      }
      return;
    }
    previousOverflow.current = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
      enforceFocus(event);
    };

    const focusTimer = window.setTimeout(() => {
      const firstFocusable =
        dialogRef.current?.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        ) ?? null;
      firstFocusable?.focus();
    }, 20);

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.clearTimeout(focusTimer);
      if (previousOverflow.current) {
        document.body.style.overflow = previousOverflow.current;
      }
    };
  }, [enforceFocus, isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 py-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl sm:p-8"
            initial={{ scale: 0.9, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 16 }}
            onClick={(event) => event.stopPropagation()}
          >
            <AuthPanel mode={mode} onModeChange={setMode} onSuccess={onClose} />
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export default AuthModal;
