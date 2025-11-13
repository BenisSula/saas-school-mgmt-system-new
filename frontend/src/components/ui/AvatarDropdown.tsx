import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, LogOut, Settings, User } from 'lucide-react';
import type { AuthUser } from '../../lib/api';

export interface AvatarDropdownProps {
  user: AuthUser | null;
  onLogout: () => void;
  onProfile?: () => void;
  onSettings?: () => void;
}

export function AvatarDropdown({ user, onLogout, onProfile, onSettings }: AvatarDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  const initials = useMemo(() => {
    if (!user?.email) return 'U';
    const [name] = user.email.split('@');
    if (!name) return 'U';
    const parts = name
      .replace(/[^a-zA-Z]/g, ' ')
      .trim()
      .split(/\s+/);
    if (parts.length === 0) return name.slice(0, 2).toUpperCase();
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]?.toUpperCase() ?? ''}${parts[1][0]?.toUpperCase() ?? ''}` || 'U';
  }, [user?.email]);

  if (!user) {
    return null;
  }

  return (
    <div className="relative" ref={containerRef}>
      <motion.button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 rounded-full border border-transparent bg-white/10 px-2 py-1 text-[var(--brand-surface-contrast)] transition hover:border-white/20 hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary)]"
        whileTap={{ scale: 0.97 }}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--brand-primary)]/80 text-sm font-semibold text-[var(--brand-primary-contrast)]">
          {initials}
        </span>
        <div className="hidden text-left text-xs leading-tight sm:block">
          <p className="font-medium">{user.email}</p>
          <p className="capitalize text-[var(--brand-muted)]">{user.role}</p>
        </div>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </motion.button>

      <AnimatePresence>
        {open ? (
          <motion.div
            className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-lg border border-black/10 bg-[var(--brand-surface)]/95 shadow-2xl backdrop-blur"
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 200, damping: 18 }}
            role="menu"
            aria-label="User menu"
          >
            <div className="border-b border-[var(--brand-border)] px-4 py-3 text-sm">
              <p className="font-semibold text-[var(--brand-surface-contrast)]">{user.email}</p>
              <p className="text-xs capitalize text-[var(--brand-muted)]">{user.role}</p>
            </div>
            <ul className="space-y-1 p-2 text-sm text-[var(--brand-surface-contrast)]">
              <li>
                <button
                  className="nav-item-button"
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onProfile?.();
                  }}
                >
                  <User className="h-4 w-4" />
                  Profile
                </button>
              </li>
              <li>
                <button
                  className="nav-item-button"
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onSettings?.();
                  }}
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </button>
              </li>
            </ul>
            <div className="border-t border-[var(--brand-border)] p-2">
              <button
                className="nav-item-button text-red-300 hover:text-red-200"
                type="button"
                onClick={() => {
                  setOpen(false);
                  onLogout();
                }}
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export default AvatarDropdown;
