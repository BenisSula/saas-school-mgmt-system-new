import React from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { AuthResponse } from '../../lib/api';
import { AuthFormLayout } from '../auth/layout/AuthFormLayout';
import { LoginForm } from '../auth/LoginForm';
import { RegisterForm } from '../auth/RegisterForm';
import { TenantPreparationStatus } from '../auth/TenantPreparationStatus';
import { HealthBanner } from '../auth/HealthBanner';
import { getDefaultDashboardPath } from '../../lib/roleLinks';

export type AuthMode = 'login' | 'register';

export interface AuthLayoutProps {
  defaultMode?: AuthMode;
  onModeChange?: (mode: AuthMode) => void;
  onSuccess?: (auth: AuthResponse) => void;
}

/**
 * Consolidated Auth Layout Component
 * 
 * Combines Login and Register pages into a single reusable component
 * Following DRY principles - eliminates duplication between Login and Register pages
 */
export function AuthLayout({
  defaultMode = 'login',
  onModeChange,
  onSuccess
}: AuthLayoutProps) {
  const navigate = useNavigate();
  const [mode, setMode] = React.useState<AuthMode>(defaultMode);
  const [showTenantStatus, setShowTenantStatus] = React.useState(false);
  const [tenantId, setTenantId] = React.useState<string | null>(null);

  const handleModeChange = (newMode: AuthMode) => {
    setMode(newMode);
    onModeChange?.(newMode);
    navigate(newMode === 'register' ? '/auth/register' : '/auth/login', { replace: true });
  };

  const handleLoginSuccess = () => {
    toast.success('Signed in successfully.');
    setTimeout(() => {
      navigate('/dashboard', { replace: true });
    }, 500);
  };

  const handleRegisterSuccess = (auth: AuthResponse) => {
    // If admin created a new tenant, show preparation status
    if (auth.user.role === 'admin' && auth.user.tenantId) {
      setTenantId(auth.user.tenantId);
      setShowTenantStatus(true);
      toast.info('Your school account is being set up. This will take a few seconds...');
      return;
    }

    if (auth.user.status === 'active') {
      toast.success('Registration successful. Welcome aboard.');
      setTimeout(() => {
        const dashboardPath = getDefaultDashboardPath(auth.user.role);
        navigate(dashboardPath, { replace: true });
      }, 500);
    }
    onSuccess?.(auth);
  };

  const handleRegisterPending = () => {
    toast.info('Account created and pending admin approval. We will notify you once activated.');
  };

  const handleTenantReady = () => {
    toast.success('School setup complete! Redirecting to dashboard...');
    setTimeout(() => {
      navigate('/dashboard', { replace: true });
    }, 1500);
  };

  const handleTenantFailed = () => {
    toast.error('School setup failed. Please contact support or try again.');
    setShowTenantStatus(false);
  };

  const title = mode === 'login' ? 'Welcome back' : 'Create your account';
  const subtitle =
    mode === 'login'
      ? 'Access your campus intelligence and role-based dashboards securely.'
      : 'Join the platform to manage academics, attendance, and data-driven insights.';

  return (
    <AuthFormLayout
      title={title}
      subtitle={subtitle}
      footer={
        <p className="text-center text-xs text-[var(--brand-muted)]">
          {mode === 'login'
            ? 'By signing in, you agree to our Terms of Service and Privacy Policy.'
            : 'Student and teacher accounts may require administrator approval before activation.'}
        </p>
      }
    >
      <HealthBanner />
      {showTenantStatus && tenantId ? (
        <TenantPreparationStatus
          tenantId={tenantId}
          onReady={handleTenantReady}
          onFailed={handleTenantFailed}
        />
      ) : mode === 'login' ? (
        <LoginForm
          onSuccess={handleLoginSuccess}
          onSwitchToRegister={() => handleModeChange('register')}
        />
      ) : (
        <RegisterForm
          onPending={handleRegisterPending}
          onSuccess={handleRegisterSuccess}
          onSwitchToLogin={() => handleModeChange('login')}
        />
      )}
    </AuthFormLayout>
  );
}

export default AuthLayout;

