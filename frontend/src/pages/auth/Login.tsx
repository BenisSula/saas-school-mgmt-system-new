import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AuthPanel } from '../../components/auth/AuthPanel';

export function LoginPage() {
  const navigate = useNavigate();

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
          navigate('/dashboard');
        }}
      />
    </div>
  );
}

export default LoginPage;
