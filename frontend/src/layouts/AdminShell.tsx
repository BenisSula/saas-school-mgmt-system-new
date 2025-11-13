import { Suspense, useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { DashboardHeader } from '../components/layout/DashboardHeader';
import { Sidebar } from '../components/ui/Sidebar';
import { useResponsiveSidebar } from '../hooks/useResponsiveSidebar';
import type { AuthUser } from '../lib/api';
import { getSidebarLinksForRole } from '../lib/roleLinks';
import { DashboardRouteProvider, useDashboardRouteMeta } from '../context/DashboardRouteContext';
import { DashboardSkeleton } from '../components/ui/DashboardSkeleton';

export interface AdminShellProps {
  children?: ReactNode;
  user: AuthUser | null;
  onLogout: () => void;
}

export function AdminShell({ children, user, onLogout }: AdminShellProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const links = useMemo(() => getSidebarLinksForRole(user?.role), [user?.role]);
  const {
    isOpen,
    isDesktop,
    toggleMobile,
    closeMobile,
    shouldShowOverlay,
    collapsed,
    toggleCollapsed
  } = useResponsiveSidebar({ storageKey: user?.id ?? undefined });

  const content = children ?? <Outlet />;

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
      <AdminShellLayout
        content={content}
        onLogout={onLogout}
        user={user}
        onClose={closeMobile}
        onNavigate={navigate}
        onToggleSidebar={toggleMobile}
        sidebar={{
          links,
          activePath,
          isOpen,
          isDesktop,
          collapsed,
          toggleCollapsed,
          shouldShowOverlay
        }}
      />
    </DashboardRouteProvider>
  );
}

export default AdminShell;

interface AdminShellLayoutProps {
  content: ReactNode;
  user: AuthUser | null;
  onLogout: () => void;
  onNavigate: (path: string) => void;
  onToggleSidebar: () => void;
  onClose: () => void;
  sidebar: {
    links: ReturnType<typeof getSidebarLinksForRole>;
    activePath: string;
    isOpen: boolean;
    isDesktop: boolean;
    collapsed: boolean;
    toggleCollapsed: () => void;
    shouldShowOverlay: boolean;
  };
}

function AdminShellLayout({
  content,
  user,
  onLogout,
  onNavigate,
  onToggleSidebar,
  onClose,
  sidebar
}: AdminShellLayoutProps) {
  const { links, activePath, isOpen, isDesktop, collapsed, toggleCollapsed, shouldShowOverlay } =
    sidebar;
  const mainRef = useRef<HTMLElement | null>(null);
  const location = useLocation();
  const { titleId } = useDashboardRouteMeta();

  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.focus({ preventScroll: true });
    }
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-[var(--brand-surface)] text-[var(--brand-surface-contrast)] transition-colors duration-300">
      <DashboardHeader
        onToggleSidebar={onToggleSidebar}
        sidebarOpen={isOpen}
        user={user}
        onLogout={onLogout}
      />

      <div className="relative mx-auto flex w-full max-w-[1400px] gap-4 px-2 sm:px-4">
        <div
          className={`fixed inset-0 z-30 bg-slate-950/70 backdrop-blur-sm transition-opacity sm:hidden ${
            shouldShowOverlay ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
          }`}
          aria-hidden={!shouldShowOverlay}
          onClick={onClose}
        />
        {links.length > 0 && (
          <Sidebar
            links={links}
            activePath={activePath}
            open={isOpen}
            onClose={onClose}
            collapsed={collapsed}
            onCollapsedToggle={toggleCollapsed}
            onNavigate={onNavigate}
            isDesktop={isDesktop}
          />
        )}
        <main
          ref={mainRef}
          role="main"
          aria-labelledby={titleId || undefined}
          tabIndex={-1}
          className={`relative z-10 flex-1 overflow-x-hidden overflow-y-auto py-6 ${
            isDesktop ? 'px-6' : 'px-2 sm:px-4'
          }`}
        >
          <Suspense fallback={<DashboardSkeleton />}>{content}</Suspense>
        </main>
      </div>
    </div>
  );
}
