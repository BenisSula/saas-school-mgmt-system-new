import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { AuthResponse } from '../../lib/api';
import { AuthFormLayout } from '../../components/auth/layout/AuthFormLayout';
import { RegisterForm } from '../../components/auth/RegisterForm';
import { HealthBanner } from '../../components/auth/HealthBanner';
import { getDefaultDashboardPath } from '../../lib/roleLinks';

export function RegisterPage() {
  const navigate = useNavigate();

  const handleSuccess = (auth: AuthResponse) => {
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
      <RegisterForm
        onPending={handlePending}
        onSuccess={handleSuccess}
        onSwitchToLogin={() => {
          navigate('/auth/login');
        }}
      />
    </AuthFormLayout>
  );
}

export default RegisterPage;
