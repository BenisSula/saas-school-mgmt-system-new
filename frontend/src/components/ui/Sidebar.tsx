import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
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
  expanded: { width: 'var(--layout-sidebar-width)' },
  collapsed: { width: 'var(--layout-sidebar-collapsed-width)' }
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
  const isExpanded = !collapsed;
  const navRef = useRef<HTMLElement>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Keyboard navigation: Arrow keys to navigate, Enter/Space to activate
  useEffect(() => {
    if (!open && !isDesktop) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!navRef.current) return;

      const buttons = buttonRefs.current.filter((ref) => ref !== null) as HTMLButtonElement[];
      if (buttons.length === 0) return;

      const currentIndex = buttons.findIndex((btn) => btn === document.activeElement);

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (currentIndex < buttons.length - 1) {
            buttons[currentIndex + 1]?.focus();
          } else {
            buttons[0]?.focus();
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (currentIndex > 0) {
            buttons[currentIndex - 1]?.focus();
          } else {
            buttons[buttons.length - 1]?.focus();
          }
          break;
        case 'Home':
          e.preventDefault();
          buttons[0]?.focus();
          break;
        case 'End':
          e.preventDefault();
          buttons[buttons.length - 1]?.focus();
          break;
        case 'Escape':
          if (!isDesktop) {
            e.preventDefault();
            onClose();
          }
          break;
      }
    };

    const navElement = navRef.current;
    navElement?.addEventListener('keydown', handleKeyDown);
    return () => {
      navElement?.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, isDesktop, onClose]);

  // Pre-compute button props to avoid linter issues with JSX expressions
  const collapseButtonProps = {
    type: 'button' as const,
    onClick: onCollapsedToggle,
    className:
      'interactive-button inline-flex h-9 w-9 items-center justify-center rounded-md text-[var(--brand-surface-contrast)]',
    'aria-label': collapsed ? 'Expand sidebar' : 'Collapse sidebar',
    'aria-expanded': isExpanded
  } as React.ButtonHTMLAttributes<HTMLButtonElement>;

  return (
    <motion.aside
      className={`${
        isDesktop
          ? 'sticky top-[var(--layout-header-height)] h-[calc(100vh-var(--layout-header-height))]'
          : 'fixed inset-y-0 left-0 z-50 h-screen'
      } flex-shrink-0 overflow-hidden border-r border-[var(--brand-border)] bg-[var(--brand-surface)]/95 shadow-xl backdrop-blur transition-colors duration-300`}
      aria-hidden={!open && !isDesktop}
      data-collapsed={shouldCollapse}
      animate={shouldCollapse ? 'collapsed' : 'expanded'}
      variants={sidebarVariants}
      initial={false}
      transition={{
        type: 'tween',
        duration: 0.3,
        ease: [0.4, 0, 0.2, 1]
      }}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-[var(--brand-border)] px-3 py-3 sm:px-4 lg:px-5">
          <motion.span
            className="text-sm font-semibold text-[var(--brand-surface-contrast)]"
            animate={{ opacity: shouldCollapse ? 0.7 : 1 }}
            transition={{ duration: 0.2 }}
          >
            {shouldCollapse ? 'Menu' : 'Navigation'}
          </motion.span>
          {isDesktop ? (
            <button {...collapseButtonProps}>
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
          ref={navRef}
          className="flex flex-1 flex-col overflow-y-auto px-2 py-4 text-sm text-[var(--brand-surface-contrast)] scrollbar-thin lg:px-3"
          role="navigation"
          aria-label="Sidebar navigation"
        >
          <ul className="flex flex-col gap-1">
            {links.map((link, index) => {
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
                    ref={(el) => {
                      buttonRefs.current[index] = el;
                    }}
                    type="button"
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => {
                      onNavigate(link.path);
                      if (!isDesktop) {
                        onClose();
                      }
                    }}
                    className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-all duration-200 touch-target focus-visible-ring ${
                      isActive
                        ? 'bg-[var(--brand-primary)]/90 text-[var(--brand-primary-contrast)] shadow-sm'
                        : 'hover:bg-[var(--brand-surface-secondary)] active:bg-[var(--brand-surface-tertiary)]'
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
          </ul>
        </nav>
      </div>
    </motion.aside>
  );
}

export const Sidebar = React.memo(SidebarComponent);
Sidebar.displayName = 'Sidebar';

export default Sidebar;
