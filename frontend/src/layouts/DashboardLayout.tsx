/**
 * Reusable Dashboard Layout Component
 * Provides consistent layout structure for all dashboard pages
 */
import { Suspense, useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { DashboardHeader } from '../components/layout/DashboardHeader';
import { Sidebar } from '../components/ui/Sidebar';
import { useSidebar } from '../hooks/useSidebar';
import type { AuthUser } from '../lib/api';
import { getSidebarLinksForRole } from '../lib/roleLinks';
import { DashboardRouteProvider, useDashboardRouteMeta } from '../context/DashboardRouteContext';
import { DashboardSkeleton } from '../components/ui/DashboardSkeleton';
import { pageTransition } from '../lib/utils/animations';

export interface DashboardLayoutProps {
  children?: ReactNode;
  user: AuthUser | null;
  onLogout: () => void;
  storageKey?: string;
}

export function DashboardLayout({ children, user, onLogout, storageKey }: DashboardLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const links = useMemo(() => getSidebarLinksForRole(user?.role), [user?.role]);

  const {
    isOpen,
    isDesktop,
    collapsed,
    toggleMobile,
    closeMobile,
    toggleCollapsed,
    shouldShowOverlay
  } = useSidebar({ storageKey: storageKey ?? user?.id });

  const content = children;

  const activePath = useMemo(() => {
    const match = links.find((link) => location.pathname.startsWith(link.path));
    if (match) {
      return match.path;
    }
    return links[0]?.path ?? location.pathname;
  }, [links, location.pathname]);

  const defaultTitle = useMemo(() => {
    const match = links.find((link) => link.path === activePath);
    return match?.label ?? 'Dashboard';
  }, [activePath, links]);

  return (
    <DashboardRouteProvider defaultTitle={defaultTitle}>
      <DashboardLayoutContent
        content={content}
        user={user}
        onLogout={onLogout}
        links={links}
        activePath={activePath}
        isOpen={isOpen}
        isDesktop={isDesktop}
        collapsed={collapsed}
        toggleMobile={toggleMobile}
        closeMobile={closeMobile}
        toggleCollapsed={toggleCollapsed}
        shouldShowOverlay={shouldShowOverlay}
        navigate={navigate}
        location={location}
      />
    </DashboardRouteProvider>
  );
}

interface DashboardLayoutContentProps {
  content: ReactNode;
  user: AuthUser | null;
  onLogout: () => void;
  links: ReturnType<typeof getSidebarLinksForRole>;
  activePath: string;
  isOpen: boolean;
  isDesktop: boolean;
  collapsed: boolean;
  toggleMobile: () => void;
  closeMobile: () => void;
  toggleCollapsed: () => void;
  shouldShowOverlay: boolean;
  navigate: ReturnType<typeof useNavigate>;
  location: ReturnType<typeof useLocation>;
}

function DashboardLayoutContent({
  content,
  user,
  onLogout,
  links,
  activePath,
  isOpen,
  isDesktop,
  collapsed,
  toggleMobile,
  closeMobile,
  toggleCollapsed,
  shouldShowOverlay,
  navigate,
  location
}: DashboardLayoutContentProps) {
  const mainRef = useRef<HTMLElement | null>(null);
  const { titleId } = useDashboardRouteMeta();

  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.focus({ preventScroll: true });
    }
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-[var(--brand-surface)] text-[var(--brand-surface-contrast)] transition-colors duration-300">
      {/* Skip to main content link for accessibility */}
      <a href="#main-content" className="skip-to-main">
        Skip to main content
      </a>
      <DashboardHeader
        onToggleSidebar={toggleMobile}
        sidebarOpen={isOpen}
        user={user}
        onLogout={onLogout}
      />

      <div className="relative mx-auto flex w-full gap-2 sm:gap-4 px-2 sm:px-4 lg:px-6">
        <AnimatePresence>
          {shouldShowOverlay && (
            <motion.div
              className="fixed inset-0 z-30 bg-slate-950/70 backdrop-blur-sm sm:hidden pointer-events-auto"
              onClick={closeMobile}
              aria-hidden="true"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            />
          )}
        </AnimatePresence>
        {links.length > 0 && (
          <Sidebar
            links={links}
            activePath={activePath}
            open={isOpen}
            onClose={closeMobile}
            collapsed={collapsed}
            onCollapsedToggle={toggleCollapsed}
            onNavigate={navigate}
            isDesktop={isDesktop}
          />
        )}
        <motion.main
          id="main-content"
          ref={mainRef}
          role="main"
          aria-labelledby={titleId || undefined}
          tabIndex={-1}
          className="relative z-10 flex-1 overflow-x-hidden overflow-y-auto container-padding scrollbar-thin smooth-scroll"
          initial="initial"
          animate="animate"
          exit="exit"
          variants={pageTransition}
          key={location.pathname}
        >
          <div className="mx-auto w-full max-w-full">
            <Suspense fallback={<DashboardSkeleton />}>{content}</Suspense>
          </div>
        </motion.main>
      </div>
    </div>
  );
}

export default DashboardLayout;
