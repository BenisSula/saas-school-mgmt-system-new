import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, LogOut, Settings, User, UserCircle } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { useBrand } from './BrandProvider';
import type { AuthUser, Role } from '../../lib/api';

export interface NavigationLink {
  label: string;
  icon: React.ReactNode;
  onSelect: () => void;
  isActive?: boolean;
  allowedRoles?: Role[];
}

export interface NavbarProps {
  brandName: string;
  brandSubtitle?: string;
  links: NavigationLink[];
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
  user: AuthUser | null;
  onLogout: () => void;
  onShowAuthPanel?: () => void;
  onShowRegisterPanel?: () => void;
}

const navItemVariants = {
  hidden: { opacity: 0, y: -6 },
  visible: { opacity: 1, y: 0 },
};

function NavbarComponent({
  brandName,
  brandSubtitle,
  links,
  onToggleSidebar,
  sidebarOpen,
  user,
  onLogout,
  onShowAuthPanel,
}: NavbarProps) {
  const { tokens } = useBrand();
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!avatarMenuOpen) return;
    function handlePointerDown(event: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setAvatarMenuOpen(false);
      }
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [avatarMenuOpen]);

  const brandInitials = useMemo(() => {
    const words = brandName.split(' ').filter(Boolean);
    if (words.length === 0) return 'S';
    if (words.length === 1) return words[0][0]?.toUpperCase() ?? 'S';
    return `${words[0][0]?.toUpperCase() ?? 'S'}${words[1][0]?.toUpperCase() ?? ''}`;
  }, [brandName]);

  return (
    <motion.header
      className="sticky top-0 z-40 border-b border-[var(--brand-border)] bg-[var(--brand-surface)]/85 backdrop-blur"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 120, damping: 20 }}
    >
      <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center justify-between px-3 sm:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-transparent text-[var(--brand-surface-contrast)] transition hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary)] lg:hidden"
            onClick={onToggleSidebar}
            aria-label="Toggle navigation"
            aria-expanded={sidebarOpen}
          >
            <span className="text-2xl leading-none">☰</span>
          </button>
          <div className="flex items-center gap-2">
            <motion.div
              className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-semibold uppercase text-white shadow-lg"
              style={{
                background: `linear-gradient(135deg, ${tokens.primary}, ${tokens.accent})`,
              }}
              initial={{ scale: 0.9, rotate: -5 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 12 }}
            >
              {brandInitials}
            </motion.div>
            <div className="hidden sm:block">
              <p className="text-sm font-semibold text-[var(--brand-surface-contrast)]">
                {brandName}
              </p>
              {brandSubtitle ? (
                <p className="text-xs text-[var(--brand-muted)]">{brandSubtitle}</p>
              ) : null}
            </div>
          </div>
        </div>

        <nav
          aria-label="Primary navigation"
          className="hidden items-center gap-3 text-sm font-medium lg:flex"
        >
          <AnimatePresence initial={false}>
            {links.map((link) => (
              <motion.button
                key={link.label}
                type="button"
                onClick={link.onSelect}
                aria-pressed={link.isActive}
                className={`interactive-button group relative inline-flex items-center gap-2 rounded-lg px-3 py-2 ${
                  link.isActive
                    ? 'bg-[var(--brand-primary)]/90 text-[var(--brand-primary-contrast)] shadow-sm'
                    : 'text-[var(--brand-surface-contrast)] hover:bg-white/10'
                }`}
                variants={navItemVariants}
                initial="hidden"
                animate="visible"
                exit="hidden"
              >
                <span className="text-[1.15rem]">{link.icon}</span>
                <span>{link.label}</span>
                {link.isActive ? (
                  <motion.span
                    layoutId="nav-active-indicator"
                    className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-[var(--brand-primary-contrast)]"
                  />
                ) : null}
              </motion.button>
            ))}
          </AnimatePresence>
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {user ? (
            <div className="relative" ref={menuRef}>
              <motion.button
                type="button"
                onClick={() => setAvatarMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 rounded-full border border-transparent bg-white/10 px-2 py-1 text-[var(--brand-surface-contrast)] transition hover:border-white/20 hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary)]"
                whileTap={{ scale: 0.97 }}
              >
                <UserCircle className="h-8 w-8" />
                <div className="hidden text-left text-xs leading-tight sm:block">
                  <p className="font-medium">{user.email}</p>
                  <p className="capitalize text-[var(--brand-muted)]">{user.role}</p>
                </div>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${avatarMenuOpen ? 'rotate-180' : 'rotate-0'}`}
                />
              </motion.button>
              <AnimatePresence>
                {avatarMenuOpen ? (
                  <motion.div
                    className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-lg border border-black/10 bg-[var(--brand-surface)]/95 shadow-2xl backdrop-blur"
                    initial={{ opacity: 0, y: -8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.97 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 18 }}
                  >
                    <div className="border-b border-[var(--brand-border)] px-4 py-3 text-sm">
                      <p className="font-semibold text-[var(--brand-surface-contrast)]">
                        {user.email}
                      </p>
                      <p className="text-xs capitalize text-[var(--brand-muted)]">{user.role}</p>
                    </div>
                    <ul className="space-y-1 p-2 text-sm text-[var(--brand-surface-contrast)]">
                      <li>
                        <button className="nav-item-button" type="button">
                          <User className="h-4 w-4" />
                          Profile
                        </button>
                      </li>
                      <li>
                        <button className="nav-item-button" type="button">
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
                          setAvatarMenuOpen(false);
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
          ) : (
            <button
              type="button"
              onClick={onShowAuthPanel}
              className="interactive-button inline-flex items-center rounded-md border border-transparent bg-[var(--brand-primary)]/90 px-4 py-2 text-sm font-medium text-[var(--brand-primary-contrast)] hover:bg-[var(--brand-primary)]"
            >
              Sign in
            </button>
          )}
        </div>
      </div>
    </motion.header>
  );
}

export const Navbar = React.memo(NavbarComponent);
Navbar.displayName = 'Navbar';

export default Navbar;
