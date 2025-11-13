import type { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { LandingHeader } from '../components/layout/LandingHeader';
import { LandingFooter } from '../components/layout/LandingFooter';

export interface LandingShellProps {
  children?: ReactNode;
}

export function LandingShell({ children }: LandingShellProps) {
  const content = children ?? <Outlet />;
  return (
    <div className="min-h-screen bg-[var(--brand-surface)] text-[var(--brand-surface-contrast)]">
      <LandingHeader />
      <main className="mx-auto max-w-5xl px-4 py-10 md:px-8">{content}</main>
      <LandingFooter />
    </div>
  );
}

export default LandingShell;
