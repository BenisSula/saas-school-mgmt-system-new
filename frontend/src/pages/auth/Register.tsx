import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { AuthResponse } from '../../lib/api';
import { AuthPanel } from '../../components/auth/AuthPanel';

export function RegisterPage() {
  const navigate = useNavigate();

  const handleSuccess = (auth: AuthResponse) => {
    toast.success('Registration successful. Welcome aboard.');
    // auth is used in the navigate call below
    if (!auth.user.status || auth.user.status === 'active') {
      navigate('/dashboard');
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
