import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AuthPanel } from '../../components/auth/AuthPanel';
import { useAuth } from '../../context/AuthContext';
import { getDefaultDashboardPath } from '../../lib/roleLinks';

export function LoginPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6 py-12">
      <AuthPanel
        mode="login"
        onModeChange={(next) => {
          if (next === 'register') {
            navigate('/auth/register');
          }
        }}
        onLoginSuccess={() => {
          toast.success('Signed in successfully.');
          // Navigate to appropriate dashboard based on role
          // App.tsx will handle the actual navigation when user state updates
          // But we can navigate immediately if user is available
          if (user) {
            const dashboardPath = getDefaultDashboardPath(user.role);
            navigate(dashboardPath, { replace: true });
          } else {
            navigate('/dashboard', { replace: true });
          }
        }}
      />
    </div>
  );
}

export default LoginPage;
