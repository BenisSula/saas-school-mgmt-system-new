import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { HealthBanner } from '../components/auth/HealthBanner';
import { getDefaultDashboardPath } from '../lib/roleLinks';
import { LogIn, User, Eye, EyeOff, Loader2, ExternalLink } from 'lucide-react';

/**
 * Test Login Page - Simple page for quick testing of different user roles
 * This page allows quick login with test credentials and navigation to dashboards
 */
export function TestLoginPage() {
  // Debug: Log when component mounts
  useEffect(() => {
    console.log('[TestLoginPage] Component mounted');
  }, []);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login: loginUser, user } = useAuth();
  const navigate = useNavigate();

  // Pre-filled test credentials for quick access
  const testCredentials = [
    {
      role: 'Superuser',
      email: 'owner@saas-platform.system',
      password: 'SuperOwner#2025!',
      description: 'Platform Owner - Full access'
    },
    {
      role: 'Admin',
      email: 'fatou.jallow@newhorizon.edu.gm',
      password: 'NhsAdmin@2025',
      description: 'New Horizon Admin'
    },
    {
      role: 'Teacher',
      email: 'pamodou.jagne@newhorizon.edu.gm',
      password: 'TeachNHS01@2025',
      description: 'New Horizon Teacher'
    },
    {
      role: 'Student',
      email: 'student@example.com',
      password: 'Student123!',
      description: 'Test Student Account'
    }
  ];

  const handleQuickLogin = async (testEmail: string, testPassword: string) => {
    setEmail(testEmail);
    setPassword(testPassword);
    setIsLoading(true);

    try {
      await loginUser({ email: testEmail, password: testPassword });
      toast.success('Login successful!');
      // Wait a moment for user state to update, then navigate
      setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 300);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      toast.error(errorMessage);
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please enter email and password');
      return;
    }

    setIsLoading(true);
    try {
      await loginUser({ email, password });
      toast.success('Login successful!');
      setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 300);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      toast.error(errorMessage);
      setIsLoading(false);
    }
  };

  // If already logged in, show dashboard link
  if (user) {
    const dashboardPath = getDefaultDashboardPath(user.role);
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--brand-surface)] px-4 py-8">
        <div className="w-full max-w-2xl rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-8 shadow-2xl">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--brand-primary)]/20">
              <User className="h-8 w-8 text-[var(--brand-primary)]" />
            </div>
            <h1 className="text-2xl font-bold text-[var(--brand-surface-contrast)]">
              Already Logged In
            </h1>
            <p className="mt-2 text-sm text-[var(--brand-muted)]">
              You are logged in as <strong>{user.email}</strong>
            </p>
            <p className="mt-1 text-sm text-[var(--brand-muted)]">
              Role: <strong className="capitalize">{user.role}</strong>
            </p>
          </div>

          <div className="space-y-4">
            <a
              href={dashboardPath}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--brand-primary)] px-6 py-3 font-semibold text-[var(--brand-primary-contrast)] transition-colors hover:bg-[var(--brand-primary)]/90"
            >
              <ExternalLink className="h-5 w-5" />
              Go to Dashboard
            </a>

            <button
              onClick={() => {
                window.location.href = '/';
              }}
              className="w-full rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] px-6 py-3 font-semibold text-[var(--brand-surface-contrast)] transition-colors hover:bg-[var(--brand-surface)]/80"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--brand-surface)] px-4 py-8">
      <div className="w-full max-w-4xl">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold text-[var(--brand-surface-contrast)]">
            Test Login Page
          </h1>
          <p className="mt-2 text-sm text-[var(--brand-muted)]">
            Quick access to test different user roles and dashboards
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Quick Login Cards */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-[var(--brand-surface-contrast)]">
              Quick Login
            </h2>
            <div className="space-y-2">
              {testCredentials.map((cred, index) => (
                <button
                  key={index}
                  onClick={() => handleQuickLogin(cred.email, cred.password)}
                  disabled={isLoading}
                  className="w-full rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] p-4 text-left transition-colors hover:bg-[var(--brand-surface)]/80 disabled:opacity-50"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-[var(--brand-surface-contrast)]">
                        {cred.role}
                      </p>
                      <p className="text-xs text-[var(--brand-muted)]">{cred.description}</p>
                    </div>
                    <LogIn className="h-5 w-5 text-[var(--brand-primary)]" />
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Manual Login Form */}
          <div className="rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold text-[var(--brand-surface-contrast)]">
              Manual Login
            </h2>
            <HealthBanner />
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-[var(--brand-surface-contrast)]"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="mt-1 block w-full rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] px-4 py-2 text-[var(--brand-surface-contrast)] placeholder:text-[var(--brand-muted)] focus:border-[var(--brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-[var(--brand-surface-contrast)]"
                >
                  Password
                </label>
                <div className="relative mt-1">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="block w-full rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] px-4 py-2 pr-10 text-[var(--brand-surface-contrast)] placeholder:text-[var(--brand-muted)] focus:border-[var(--brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--brand-muted)] hover:text-[var(--brand-surface-contrast)]"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--brand-primary)] px-6 py-3 font-semibold text-[var(--brand-primary-contrast)] transition-colors hover:bg-[var(--brand-primary)]/90 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Logging in...
                  </>
                ) : (
                  <>
                    <LogIn className="h-5 w-5" />
                    Login
                  </>
                )}
              </button>
            </form>

            <div className="mt-4 text-center">
              <a href="/auth/login" className="text-sm text-[var(--brand-primary)] hover:underline">
                Go to full login page
              </a>
            </div>
          </div>
        </div>

        {/* Info Section */}
        <div className="mt-6 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)]/50 p-4">
          <h3 className="mb-2 text-sm font-semibold text-[var(--brand-surface-contrast)]">
            Dashboard Access
          </h3>
          <ul className="space-y-1 text-xs text-[var(--brand-muted)]">
            <li>
              <strong>Superuser:</strong> Platform overview, school management, analytics
            </li>
            <li>
              <strong>Admin:</strong> School management, students, teachers, classes, reports
            </li>
            <li>
              <strong>Teacher:</strong> Classes, attendance, grades, student management
            </li>
            <li>
              <strong>Student:</strong> Personal dashboard, attendance, results, fees
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default TestLoginPage;
