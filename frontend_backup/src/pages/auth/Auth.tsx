import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AuthPanel, { type AuthView } from '../../components/auth/AuthPanel';

function useQueryParam(name: string): string | null {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search).get(name), [search, name]);
}

export default function AuthUnifiedPage() {
  const navigate = useNavigate();
  const modeParam = useQueryParam('mode');
  const mode: AuthView = useMemo(
    () => (modeParam === 'register' ? 'register' : 'login'),
    [modeParam]
  );

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-10">
      <AuthPanel
        mode={mode}
        onModeChange={(next) => {
          navigate(`/auth?mode=${next}`, { replace: true });
        }}
      />
    </div>
  );
}
