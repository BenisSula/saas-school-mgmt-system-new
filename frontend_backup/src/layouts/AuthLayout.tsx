/**
 * Reusable Auth Layout Component
 * Provides consistent layout structure for authentication pages
 */
import type { ReactNode } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { LandingHeader } from '../components/layout/LandingHeader';
import { LandingFooter } from '../components/layout/LandingFooter';

export interface AuthLayoutProps {
  children?: ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  const content = children ?? <Outlet />;
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[var(--brand-surface)] text-[var(--brand-surface-contrast)]">
      <LandingHeader onSignIn={() => navigate('/auth?mode=login')} />
      <main className="mx-auto max-w-5xl px-4 py-10 md:px-8">{content}</main>
      <LandingFooter />
    </div>
  );
}

export default AuthLayout;
