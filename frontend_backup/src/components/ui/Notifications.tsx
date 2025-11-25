/**
 * Notifications Component
 * Accessible notification bell with dropdown
 */
import { useState, useRef, useEffect } from 'react';
import type React from 'react';
import { Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface Notification {
  id: string;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  type?: 'info' | 'success' | 'warning' | 'error';
}

export interface NotificationsProps {
  notifications?: Notification[];
  onNotificationClick?: (notification: Notification) => void;
  onMarkAllRead?: () => void;
  className?: string;
}

export function Notifications({
  notifications = [],
  onNotificationClick,
  onMarkAllRead,
  className = ''
}: NotificationsProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const unreadCount = notifications.filter((n) => !n.read).length;

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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className={`relative ${className}`} ref={containerRef} onKeyDown={handleKeyDown}>
      <motion.button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-transparent bg-[var(--brand-surface-secondary)] text-[var(--brand-surface-contrast)] transition hover:bg-[var(--brand-surface-tertiary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary)]"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        whileTap={{ scale: 0.95 }}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <motion.span
            className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--brand-error)] text-xs font-semibold text-white"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 15 }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </motion.span>
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] shadow-xl backdrop-blur"
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 200, damping: 18 }}
            aria-label="Notifications"
          >
            <div className="flex items-center justify-between border-b border-[var(--brand-border)] px-4 py-3">
              <h3 className="text-sm font-semibold text-[var(--brand-surface-contrast)]">
                Notifications
              </h3>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    onMarkAllRead?.();
                  }}
                  className="text-xs text-[var(--brand-primary)] hover:text-[var(--brand-primary-hover)] focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary)]"
                >
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-[var(--brand-muted)]">
                  No notifications
                </div>
              ) : (
                <ul className="divide-y divide-[var(--brand-border)]">
                  {notifications.map((notification) => (
                    <li key={notification.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onNotificationClick?.(notification);
                          setOpen(false);
                        }}
                        className={`w-full px-4 py-3 text-left transition hover:bg-[var(--brand-surface-secondary)] focus:outline-none focus-visible:bg-[var(--brand-surface-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-[var(--brand-primary)] ${
                          !notification.read ? 'bg-[var(--brand-primary-light)]/30' : ''
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`mt-1 h-2 w-2 rounded-full ${
                              !notification.read ? 'bg-[var(--brand-primary)]' : 'bg-transparent'
                            }`}
                            aria-hidden="true"
                          />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-[var(--brand-surface-contrast)]">
                              {notification.title}
                            </p>
                            <p className="mt-1 text-xs text-[var(--brand-muted)]">
                              {notification.message}
                            </p>
                            <p className="mt-1 text-xs text-[var(--brand-muted)]">
                              {notification.timestamp.toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default Notifications;
