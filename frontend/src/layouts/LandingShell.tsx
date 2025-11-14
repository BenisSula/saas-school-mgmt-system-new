import type { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import { LandingHeader } from '../components/layout/LandingHeader';
import { LandingFooter } from '../components/layout/LandingFooter';
import { AuthModal } from '../components/auth/AuthModal';
import type { AuthView } from '../components/auth/AuthModal';

export interface LandingShellProps {
  children?: ReactNode;
}

export function LandingShell({ children }: LandingShellProps) {
  const content = children ?? <Outlet />;
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthView>('login');

  return (
    <div className="min-h-screen bg-[var(--brand-surface)] text-[var(--brand-surface-contrast)]">
      <LandingHeader
        onSignIn={() => {
          setAuthMode('login');
          setAuthOpen(true);
        }}
      />
      <main className="mx-auto max-w-5xl px-4 py-10 md:px-8">{content}</main>
      <LandingFooter />
      <AuthModal
        isOpen={authOpen}
        mode={authMode}
        setMode={setAuthMode}
        onClose={() => setAuthOpen(false)}
      />
    </div>
  );
}

export default LandingShell;
