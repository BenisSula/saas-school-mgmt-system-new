import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import type { SidebarLink } from '../../lib/roleLinks';

export interface SidebarProps {
  links: SidebarLink[];
  activePath: string;
  open: boolean;
  onClose: () => void;
  collapsed: boolean;
  onCollapsedToggle: () => void;
  onNavigate: (path: string) => void;
  isDesktop: boolean;
}

const sidebarVariants = {
  expanded: { width: 264 },
  collapsed: { width: 92 }
};

const navItemVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: { opacity: 1, x: 0 }
};

function SidebarComponent({
  links,
  activePath,
  open,
  onClose,
  collapsed,
  onCollapsedToggle,
  onNavigate,
  isDesktop
}: SidebarProps) {
  const shouldCollapse = collapsed && isDesktop;

  return (
    <motion.aside
      className={`${
        isDesktop ? 'sticky top-20 h-[calc(100vh-5rem)]' : 'fixed inset-y-0 left-0 z-50 h-screen'
      } flex-shrink-0 overflow-hidden border-r border-[var(--brand-border)] bg-[var(--brand-surface)]/95 shadow-xl backdrop-blur transition-all`}
      aria-hidden={!open && !isDesktop}
      data-collapsed={shouldCollapse}
      animate={shouldCollapse ? 'collapsed' : 'expanded'}
      variants={sidebarVariants}
      initial={false}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-[var(--brand-border)] px-4 py-3 lg:px-5">
          <span className="text-sm font-semibold text-[var(--brand-surface-contrast)]">
            {shouldCollapse ? 'Menu' : 'Navigation'}
          </span>
          {isDesktop ? (
            <button
              type="button"
              onClick={onCollapsedToggle}
              className="interactive-button inline-flex h-9 w-9 items-center justify-center rounded-md text-[var(--brand-surface-contrast)]"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-expanded={!collapsed}
            >
              {collapsed ? (
                <ChevronsRight className="h-4 w-4" />
              ) : (
                <ChevronsLeft className="h-4 w-4" />
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-[var(--brand-surface-contrast)]"
              aria-label="Close navigation"
            >
              ✕
            </button>
          )}
        </div>

        <nav
          className="flex flex-1 flex-col overflow-y-auto px-2 py-4 text-sm text-[var(--brand-surface-contrast)] lg:px-3"
          role="navigation"
          aria-label="Sidebar navigation"
        >
          <ul className="flex flex-col gap-1" role="list">
            <AnimatePresence initial={false}>
              {links.map((link) => {
                const isActive = activePath === link.path;
                return (
                  <motion.li
                    key={link.id}
                    className="list-none"
                    variants={navItemVariants}
                    initial="hidden"
                    animate="visible"
                    exit="hidden"
                  >
                    <button
                      type="button"
                      aria-pressed={isActive}
                      aria-current={isActive ? 'page' : undefined}
                      onClick={() => {
                        onNavigate(link.path);
                        if (!isDesktop) {
                          onClose();
                        }
                      }}
                      className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary)] ${
                        isActive
                          ? 'bg-[var(--brand-primary)]/90 text-[var(--brand-primary-contrast)] shadow-sm'
                          : 'hover:bg-white/10'
                      }`}
                      title={shouldCollapse ? link.label : undefined}
                    >
                      <span className="text-lg" aria-hidden="true">
                        {link.icon}
                      </span>
                      <span
                        className={`whitespace-nowrap transition-opacity ${
                          shouldCollapse ? 'pointer-events-none opacity-0' : 'opacity-100'
                        }`}
                      >
                        {link.label}
                      </span>
                      {shouldCollapse ? (
                        <span className="pointer-events-none absolute left-full ml-2 hidden rounded-md bg-[var(--brand-surface)]/95 px-2 py-1 text-xs text-[var(--brand-surface-contrast)] shadow-lg group-hover:block">
                          {link.label}
                        </span>
                      ) : null}
                      {isActive ? (
                        <motion.span
                          layoutId="sidebar-active-indicator"
                          className="absolute inset-y-2 right-1 w-[3px] rounded-full bg-[var(--brand-primary-contrast)]"
                        />
                      ) : null}
                    </button>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        </nav>
      </div>
    </motion.aside>
  );
}

export const Sidebar = React.memo(SidebarComponent);
Sidebar.displayName = 'Sidebar';

export default Sidebar;
