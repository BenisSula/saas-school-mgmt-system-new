import React from 'react';
import { Button } from './Button';
import type { NavLink } from './Navbar';

export interface SidebarProps {
  links: NavLink[];
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ links, open, onClose }: SidebarProps) {
  return (
    <div
      className={`fixed inset-y-0 left-0 z-50 w-64 transform bg-[var(--brand-surface)] shadow-xl transition-transform duration-200 ease-in-out focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary)] sm:static sm:h-auto sm:translate-x-0`}
      aria-hidden={!open}
      role="navigation"
    >
      <div className="flex items-center justify-between border-b border-[var(--brand-border)] px-4 py-3 sm:hidden">
        <span className="text-sm font-semibold text-[var(--brand-surface-contrast)]">Menu</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          aria-label="Close navigation"
          className="text-[var(--brand-surface-contrast)] hover:bg-slate-900/40"
        >
          ✕
        </Button>
      </div>
      <nav className="flex h-full flex-col gap-2 overflow-y-auto px-4 py-6 text-sm text-[var(--brand-surface-contrast)]">
        {links.map((link) => (
          <button
            key={link.label}
            type="button"
            onClick={() => {
              link.onSelect();
              onClose();
            }}
            className={`rounded-md px-3 py-2 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary)] ${
              link.isActive
                ? 'bg-[var(--brand-primary)] text-[var(--brand-primary-contrast)]'
                : 'hover:bg-slate-900/40'
            }`}
          >
            {link.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

export default Sidebar;


