import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AuthFormLayout } from '../../components/auth/layout/AuthFormLayout';
import { LoginForm } from '../../components/auth/LoginForm';
import { HealthBanner } from '../../components/auth/HealthBanner';
import { useAuth } from '../../context/AuthContext';
import { getDefaultDashboardPath } from '../../lib/roleLinks';

export function LoginPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <AuthFormLayout
      title="Welcome back"
      subtitle="Access your campus intelligence and role-based dashboards securely."
      footer={
        <p className="text-center text-xs text-[var(--brand-muted)]">
          By signing in, you agree to our Terms of Service and Privacy Policy.
        </p>
      }
    >
      <HealthBanner />
      <LoginForm
        onSuccess={() => {
          toast.success('Signed in successfully.');
          // Small delay to allow profile sync
          setTimeout(() => {
            // Navigation will be handled by App.tsx useEffect when user state updates
            // But we can navigate immediately if user is available
            if (user) {
              const dashboardPath = getDefaultDashboardPath(user.role);
              navigate(dashboardPath, { replace: true });
            } else {
              navigate('/dashboard', { replace: true });
            }
          }, 500);
        }}
        onSwitchToRegister={() => {
          navigate('/auth/register');
        }}
      />
    </AuthFormLayout>
  );
}

export default LoginPage;
