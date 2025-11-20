import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { AuthResponse } from '../../lib/api';
import { AuthFormLayout } from '../../components/auth/layout/AuthFormLayout';
import { RegisterForm } from '../../components/auth/RegisterForm';
import { TenantPreparationStatus } from '../../components/auth/TenantPreparationStatus';
import { HealthBanner } from '../../components/auth/HealthBanner';
import { getDefaultDashboardPath } from '../../lib/roleLinks';

export function RegisterPage() {
  const navigate = useNavigate();
  const [showTenantStatus, setShowTenantStatus] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);

  const handleSuccess = (auth: AuthResponse) => {
    // If admin created a new tenant, show preparation status
    if (auth.user.role === 'admin' && auth.user.tenantId) {
      setTenantId(auth.user.tenantId);
      setShowTenantStatus(true);
      toast.info('Your school account is being set up. This will take a few seconds...');
      return;
    }

    if (auth.user.status === 'active') {
      toast.success('Registration successful. Welcome aboard.');
      // Small delay to allow profile sync
      setTimeout(() => {
        const dashboardPath = getDefaultDashboardPath(auth.user.role);
        navigate(dashboardPath, { replace: true });
      }, 500);
    }
  };

  const handlePending = () => {
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

  return (
    <AuthFormLayout
      title="Create your account"
      subtitle="Join the platform to manage academics, attendance, and data-driven insights."
      footer={
        <p className="text-center text-xs text-[var(--brand-muted)]">
          Student and teacher accounts may require administrator approval before activation.
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
      ) : (
        <RegisterForm
          onPending={handlePending}
          onSuccess={handleSuccess}
          onSwitchToLogin={() => {
            navigate('/auth/login');
          }}
        />
      )}
    </AuthFormLayout>
  );
}

export default RegisterPage;
