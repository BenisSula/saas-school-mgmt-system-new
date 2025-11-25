import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { AuthResponse } from '../../lib/api';
import { LoginForm, type LoginFormProps } from './LoginForm';
import { RegisterForm, type RegisterFormProps } from './RegisterForm';
import { HealthBanner } from './HealthBanner';
import { useBrand } from '../ui/BrandProvider';

export type AuthView = 'login' | 'register';

export interface AuthPanelProps {
  mode?: AuthView;
  onModeChange?: (mode: AuthView) => void;
  onSuccess?: () => void;
  className?: string;
  onLoginSuccess?: () => void;
  onRegisterSuccess?: (auth: AuthResponse) => void;
  onRegisterPending?: (auth: AuthResponse) => void;
  loginFormProps?: Partial<Omit<LoginFormProps, 'onSuccess' | 'onSwitchToRegister'>>;
  registerFormProps?: Partial<
    Omit<RegisterFormProps, 'onSuccess' | 'onPending' | 'onSwitchToLogin'>
  >;
}

const panelMotion = {
  initial: { opacity: 0, scale: 0.92, y: 12 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.94, y: 12 }
};

export function AuthPanel({
  mode = 'login',
  onModeChange,
  onSuccess,
  className = '',
  onLoginSuccess,
  onRegisterSuccess,
  onRegisterPending,
  loginFormProps,
  registerFormProps
}: AuthPanelProps) {
  useBrand(); // Ensure theme context is available
  const [activeTab, setActiveTab] = useState<AuthView>(mode);

  useEffect(() => {
    setActiveTab(mode);
  }, [mode]);

  const handleTabChange = (next: AuthView) => {
    setActiveTab(next);
    onModeChange?.(next);
  };

  const title =
    activeTab === 'login' ? 'Welcome back to 3iAcademia' : 'Create your account with 3iAcademia';
  const subtitle =
    activeTab === 'login'
      ? 'Access your campus intelligence and role-based dashboards securely.'
      : 'Join the platform to manage academics, attendance, and data-driven insights.';

  return (
    <motion.div
      variants={panelMotion}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ type: 'spring', stiffness: 220, damping: 18 }}
      className={`w-full max-w-md rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-6 shadow-2xl sm:p-8 ${className}`}
    >
      <header className="space-y-2 text-center">
        <h2 className="font-['Poppins'] text-2xl font-semibold text-[var(--brand-primary)] sm:text-3xl">
          {title}
        </h2>
        <p className="font-['Roboto'] text-sm text-[var(--brand-muted)]">{subtitle}</p>
      </header>

      <div className="mt-6 flex items-center justify-center gap-1 rounded-full border border-[var(--brand-border)] bg-[var(--brand-surface)]/50 p-1">
        <button
          type="button"
          onClick={() => handleTabChange('login')}
          className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition ${
            activeTab === 'login'
              ? 'bg-[var(--brand-primary)] text-[var(--brand-primary-contrast)] shadow-lg'
              : 'text-[var(--brand-muted)] hover:text-[var(--brand-primary)]'
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('register')}
          className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition ${
            activeTab === 'register'
              ? 'bg-[var(--brand-accent)] text-[var(--brand-accent-contrast)] shadow-lg'
              : 'text-[var(--brand-muted)] hover:text-[var(--brand-accent)]'
          }`}
        >
          Register
        </button>
      </div>

      <div className="mt-8">
        <HealthBanner />
        {activeTab === 'login' ? (
          <LoginForm
            {...loginFormProps}
            onSuccess={() => {
              onSuccess?.();
              onLoginSuccess?.();
            }}
            onSwitchToRegister={() => handleTabChange('register')}
          />
        ) : (
          <RegisterForm
            {...registerFormProps}
            onPending={(auth) => {
              onRegisterPending?.(auth);
            }}
            onSuccess={(auth) => {
              onSuccess?.();
              onRegisterSuccess?.(auth);
            }}
            onSwitchToLogin={() => handleTabChange('login')}
          />
        )}
      </div>

      {activeTab === 'register' ? (
        <p className="mt-4 text-center text-xs font-['Roboto'] text-[var(--brand-muted)]">
          Student and teacher accounts may require administrator approval before activation.
        </p>
      ) : null}
    </motion.div>
  );
}

export default AuthPanel;
