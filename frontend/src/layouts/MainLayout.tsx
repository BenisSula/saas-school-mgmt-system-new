import React from 'react';
import { useBrand } from '../components/ui/BrandProvider';

export interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { tokens } = useBrand();
  return (
    <div
      className="min-h-screen rounded-xl bg-[var(--brand-surface)] text-[var(--brand-surface-contrast)]"
      style={
        {
          '--brand-surface': tokens.surface,
          '--brand-surface-contrast': tokens.surfaceContrast,
          '--brand-border': tokens.border
        } as React.CSSProperties
      }
    >
      <header className="border-b border-[var(--brand-border)] bg-slate-900/70 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5 md:px-8">
          <span className="text-lg font-semibold tracking-tight">SaaS School Management</span>
          <nav className="hidden space-x-4 text-sm md:block">
            <a className="text-slate-300 transition hover:text-white" href="#features">
              Features
            </a>
            <a className="text-slate-300 transition hover:text-white" href="#modules">
              Modules
            </a>
            <a className="text-slate-300 transition hover:text-white" href="#contact">
              Contact
            </a>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-10 md:px-8">{children}</main>
      <footer className="border-t border-[var(--brand-border)] bg-slate-900/70">
        <div className="mx-auto max-w-5xl px-4 py-6 text-sm text-slate-400 md:px-8">
          © {new Date().getFullYear()} SaaS School Management. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

export default MainLayout;

