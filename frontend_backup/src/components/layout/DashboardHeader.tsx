import type { AriaAttributes } from 'react';
import { motion } from 'framer-motion';
import { Menu } from 'lucide-react';
import type { AuthUser } from '../../lib/api';
import { ThemeToggleWithTooltip } from '../ui/ThemeToggleWithTooltip';
import { useBrand } from '../ui/BrandProvider';
import { AvatarDropdown } from '../ui/AvatarDropdown';
import { SearchBar } from '../ui/SearchBar';
import { Notifications } from '../ui/Notifications';
import { useDashboardRouteMeta } from '../../context/DashboardRouteContext';
import {
  useNotifications,
  useMarkNotificationAsRead,
  useMarkAllNotificationsAsRead
} from '../../hooks/queries/useNotifications';

export interface DashboardHeaderProps {
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
  user: AuthUser | null;
  onLogout: () => void;
}

export function DashboardHeader({
  onToggleSidebar,
  sidebarOpen,
  user,
  onLogout
}: DashboardHeaderProps) {
  const { tokens } = useBrand();
  const brandInitials = 'SS';
  const toggleAria = sidebarOpen
    ? ({ 'aria-expanded': 'true' as const } satisfies AriaAttributes)
    : ({ 'aria-expanded': 'false' as const } satisfies AriaAttributes);
  const { title, titleId } = useDashboardRouteMeta();

  const { data: notificationsData } = useNotifications(50);
  const notifications = notificationsData || [];
  const markAsRead = useMarkNotificationAsRead();
  const markAllAsRead = useMarkAllNotificationsAsRead();

  return (
    <motion.header
      className="sticky top-0 z-40 border-b border-[var(--brand-border)] bg-[var(--brand-surface)]/85 backdrop-blur"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 120, damping: 20 }}
    >
      <div className="mx-auto flex h-14 w-full items-center gap-2 px-3 sm:h-16 sm:gap-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <motion.button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-transparent text-[var(--brand-surface-contrast)] transition hover:bg-[var(--brand-surface-secondary)] focus-visible-ring touch-target lg:hidden"
            onClick={onToggleSidebar}
            aria-label="Toggle navigation"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            {...toggleAria}
          >
            <Menu className="h-5 w-5" />
          </motion.button>
          <div className="flex items-center gap-2">
            <motion.div
              className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-semibold uppercase text-white shadow-lg"
              style={{
                background: `linear-gradient(135deg, ${tokens.primary}, ${tokens.accent})`
              }}
              initial={{ scale: 0.9, rotate: -5 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 12 }}
              aria-hidden="true"
            >
              {brandInitials}
            </motion.div>
            <motion.div
              className="hidden sm:block"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              <p className="text-sm font-semibold text-[var(--brand-surface-contrast)]">
                SaaS School Portal
              </p>
              <p className="text-xs text-[var(--brand-muted)]">Multi-tenant school experience</p>
            </motion.div>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center gap-4">
          <div className="hidden w-full max-w-md md:block">
            <SearchBar
              placeholder="Search students, teachers, classes..."
              onSearch={(query) => {
                if (query.trim().length >= 2) {
                  // Could navigate to search results page or show search modal
                  // For now, search is available via useSearch hook
                }
              }}
            />
          </div>
          {title && (
            <h1
              id={titleId}
              className="line-clamp-1 text-center text-sm font-semibold text-[var(--brand-surface-contrast)] md:hidden lg:text-base"
            >
              {title}
            </h1>
          )}
          {!title && (
            <span className="sr-only md:hidden" id={titleId}>
              Dashboard
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Notifications
            notifications={notifications}
            onNotificationClick={(notification) => {
              if (!notification.read) {
                markAsRead.mutate(notification.id);
              }
              // Could navigate to relevant page based on notification metadata
            }}
            onMarkAllRead={() => {
              markAllAsRead.mutate();
            }}
          />
          <ThemeToggleWithTooltip />
          <AvatarDropdown user={user} onLogout={onLogout} />
        </div>
      </div>
    </motion.header>
  );
}

export default DashboardHeader;
