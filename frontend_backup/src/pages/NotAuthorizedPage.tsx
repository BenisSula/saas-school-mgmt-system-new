/**
 * Not Authorized Page
 * Displayed when user lacks required permissions
 */
import { useNavigate, useLocation } from 'react-router-dom';
import { AlertCircle, Home, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import { getDefaultDashboardPath } from '../lib/roleLinks';

export function NotAuthorizedPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // Get the previous location from state (set by ProtectedRoute)
  const from = (location.state as { from?: string })?.from;

  const handleGoHome = () => {
    if (user) {
      navigate(getDefaultDashboardPath(user.role), { replace: true });
    } else {
      navigate('/', { replace: true });
    }
  };

  const handleGoBack = () => {
    if (from) {
      navigate(from, { replace: true });
    } else {
      navigate(-1);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--brand-surface)] px-4 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface-secondary)] p-8 text-center shadow-lg">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10">
            <AlertCircle className="h-8 w-8 text-amber-500" aria-hidden="true" />
          </div>

          <h1 className="mb-3 text-2xl font-bold text-[var(--brand-surface-contrast)]">
            Access Denied
          </h1>

          <p className="mb-6 text-sm text-[var(--brand-muted)]">
            You don&apos;t have permission to access this resource. Please contact your
            administrator if you believe this is an error.
          </p>

          {user && (
            <div className="mb-6 rounded-md bg-[var(--brand-surface-tertiary)] p-4 text-left">
              <p className="text-xs font-medium text-[var(--brand-muted)] mb-1">Current Role:</p>
              <p className="text-sm font-semibold text-[var(--brand-surface-contrast)] capitalize">
                {user.role}
              </p>
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button onClick={handleGoBack} variant="outline" className="w-full sm:w-auto">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go Back
            </Button>
            <Button onClick={handleGoHome} className="w-full sm:w-auto">
              <Home className="mr-2 h-4 w-4" />
              {user ? 'Go to Dashboard' : 'Go to Home'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default NotAuthorizedPage;
