import { motion } from 'framer-motion';
import { Menu } from 'lucide-react';
import type { AuthUser } from '../../lib/api';
import { ThemeToggle } from '../ui/ThemeToggle';
import { useBrand } from '../ui/BrandProvider';
import { AvatarDropdown } from '../ui/AvatarDropdown';
import { useDashboardRouteMeta } from '../../context/DashboardRouteContext';

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
  const { title, titleId } = useDashboardRouteMeta();

  return (
    <motion.header
      className="sticky top-0 z-40 border-b border-[var(--brand-border)] bg-[var(--brand-surface)]/85 backdrop-blur"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 120, damping: 20 }}
    >
      <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center gap-3 px-3 sm:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-transparent text-[var(--brand-surface-contrast)] transition hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary)] lg:hidden"
            onClick={onToggleSidebar}
            aria-label="Toggle navigation"
            aria-expanded={sidebarOpen}
          >
            <Menu className="h-5 w-5" />
          </button>
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
            <div className="hidden sm:block">
              <p className="text-sm font-semibold text-[var(--brand-surface-contrast)]">
                SaaS School Portal
              </p>
              <p className="text-xs text-[var(--brand-muted)]">Multi-tenant school experience</p>
            </div>
          </div>
        </div>

        <div className="flex flex-1 justify-center">
          {title ? (
            <h1
              id={titleId}
              className="line-clamp-1 text-center text-sm font-semibold text-[var(--brand-surface-contrast)] sm:text-base md:text-lg"
            >
              {title}
            </h1>
          ) : (
            <span className="sr-only" id={titleId}>
              Dashboard
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <AvatarDropdown user={user} onLogout={onLogout} />
        </div>
      </div>
    </motion.header>
  );
}

export default DashboardHeader;
