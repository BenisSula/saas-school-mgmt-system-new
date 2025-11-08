import React from 'react';
import { Button } from './Button';

export interface NavLink {
  label: string;
  onSelect: () => void;
  isActive?: boolean;
}

export interface NavbarProps {
  brandName: string;
  links: NavLink[];
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
}

export function Navbar({ brandName, links, onToggleSidebar, sidebarOpen }: NavbarProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--brand-border)] bg-[var(--brand-surface)]/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="rounded-md border border-transparent p-2 text-[var(--brand-surface-contrast)] transition hover:bg-slate-900/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary)] sm:hidden"
            onClick={onToggleSidebar}
            aria-label="Toggle navigation"
            aria-expanded={sidebarOpen}
          >
            ☰
          </button>
          <span className="text-lg font-semibold text-[var(--brand-surface-contrast)]">{brandName}</span>
        </div>
        <nav
          aria-label="Primary navigation"
          className="hidden items-center gap-3 text-sm font-medium sm:flex"
        >
          {links.map((link) => (
            <button
              key={link.label}
              type="button"
              onClick={link.onSelect}
              className={`rounded-md px-3 py-2 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary)] ${
                link.isActive
                  ? 'bg-[var(--brand-primary)] text-[var(--brand-primary-contrast)]'
                  : 'text-[var(--brand-surface-contrast)] hover:bg-slate-900/40'
              }`}
            >
              {link.label}
            </button>
          ))}
        </nav>
        <Button
          variant="ghost"
          size="sm"
          className="hidden text-[var(--brand-surface-contrast)] hover:bg-slate-900/40 sm:inline-flex"
          onClick={() => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          Back to top
        </Button>
      </div>
    </header>
  );
}

export default Navbar;


