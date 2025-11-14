import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { AuthResponse } from '../../lib/api';
import { AuthPanel } from '../../components/auth/AuthPanel';
import { getDefaultDashboardPath } from '../../lib/roleLinks';

export function RegisterPage() {
  const navigate = useNavigate();

  const handleSuccess = (auth: AuthResponse) => {
    if (auth.user.status === 'active') {
      toast.success('Registration successful. Welcome aboard.');
      // Navigate to appropriate dashboard based on role
      const dashboardPath = getDefaultDashboardPath(auth.user.role);
      navigate(dashboardPath, { replace: true });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6 py-12">
      <AuthPanel
        mode="register"
        onModeChange={(next) => {
          if (next === 'login') {
            navigate('/auth/login');
          }
        }}
        onRegisterPending={() => {
          toast.info(
            'Account created and pending admin approval. We will notify you once activated.'
          );
        }}
        onRegisterSuccess={handleSuccess}
      />
    </div>
  );
}

export default RegisterPage;
