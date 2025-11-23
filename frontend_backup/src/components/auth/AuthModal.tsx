import { useCallback, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { AuthPanel, type AuthView } from './AuthPanel';
import type { AuthResponse } from '../../lib/api';
import { getDefaultDashboardPath } from '../../lib/roleLinks';

export interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: AuthView;
  setMode: (mode: AuthView) => void;
}

export function AuthModal({ isOpen, onClose, mode, setMode }: AuthModalProps) {
  const location = useLocation();
  const navigate = useNavigate();
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--brand-surface-contrast)]/60 dark:bg-black/60 backdrop-blur-sm px-4 py-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-md rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-6 shadow-2xl sm:p-8"
            initial={{ scale: 0.9, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 16 }}
            onClick={(event) => event.stopPropagation()}
          >
            <AuthPanel
              mode={mode}
              onModeChange={setMode}
              onSuccess={() => {
                onClose();
                // Navigation will be handled by App.tsx useEffect when user state updates
              }}
              onLoginSuccess={() => {
                onClose();
                toast.success('Signed in successfully.');
                // Navigation will be handled by App.tsx useEffect when user state updates
              }}
              onRegisterSuccess={(auth: AuthResponse) => {
                if (auth.user.status === 'active') {
                  onClose();
                  toast.success('Registration successful. Welcome aboard.');
                  // Navigate to appropriate dashboard based on role
                  const dashboardPath = getDefaultDashboardPath(auth.user.role);
                  navigate(dashboardPath, { replace: true });
                } else {
                  onClose();
                  toast.info(
                    'Account created and pending admin approval. We will notify you once activated.'
                  );
                }
              }}
              onRegisterPending={() => {
                onClose();
                toast.info(
                  'Account created and pending admin approval. We will notify you once activated.'
                );
              }}
            />
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export default AuthModal;
