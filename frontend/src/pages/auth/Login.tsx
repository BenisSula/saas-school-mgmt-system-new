import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { sanitizeText } from '../../lib/sanitize';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

export function LoginPage() {
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const demoAccounts = useMemo(
    () => [
      {
        role: 'SuperUser',
        email: 'owner.demo@platform.test',
        password: 'OwnerDemo#2025',
        helper: 'Explore platform-wide controls as the SaaS owner.'
      },
      {
        role: 'Admin',
        email: 'admin.demo@academy.test',
        password: 'AdminDemo#2025',
        helper: 'Manage a school tenant’s configuration, users, and reports.'
      },
      {
        role: 'Teacher',
        email: 'teacher.demo@academy.test',
        password: 'TeacherDemo#2025',
        helper: 'Review the classroom experience for attendance and grading.'
      },
      {
        role: 'Student',
        email: 'student.demo@academy.test',
        password: 'StudentDemo#2025',
        helper: 'Walk through the learner dashboard, reports, and messaging tools.'
      }
    ],
    []
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await login({
        email: form.email,
        password: form.password
      });
      toast.success('Signed in successfully.');
      navigate('/dashboard');
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleUseDemoAccount = (email: string, password: string) => {
    setForm({ email: email.toLowerCase(), password });
    toast.info(`Loaded ${email} credentials.`, { duration: 2500 });
  };

  return (
    <section
      aria-label="Login"
      className="mx-auto max-w-lg space-y-8 rounded-3xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/90 p-10 shadow-lg"
    >
      <header className="space-y-2 text-center">
        <h1 className="text-3xl font-semibold text-[var(--brand-surface-contrast)]">Sign in</h1>
        <p className="text-sm text-[var(--brand-muted)]">
          Access your role-based dashboard with secure multi-tenant isolation.
        </p>
      </header>

      <aside className="rounded-2xl border border-dashed border-[var(--brand-border)] bg-[var(--brand-surface)]/70 p-4 text-left text-sm text-[var(--brand-muted)]">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--brand-muted-strong)]">
          Demo accounts
        </h2>
        <ul className="space-y-3">
          {demoAccounts.map((account) => (
            <li
              key={account.email}
              className="flex flex-col gap-2 rounded-lg border border-[var(--brand-border)] bg-slate-950/40 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-medium text-[var(--brand-surface-contrast)]">
                  {account.role}
                </p>
                <p className="text-xs text-[var(--brand-muted)]">{account.helper}</p>
                <p className="mt-1 text-xs font-mono text-[var(--brand-muted)]">
                  {account.email} / {account.password}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => handleUseDemoAccount(account.email, account.password)}
                className="w-full sm:w-auto"
              >
                Fill credentials
              </Button>
            </li>
          ))}
        </ul>
      </aside>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <Input
          label="Work email"
          type="email"
          required
          value={form.email}
          onChange={(event) =>
            setForm((state) => ({
              ...state,
              email: sanitizeText(event.target.value).toLowerCase()
            }))
          }
        />
        <Input
          label="Password"
          type="password"
          required
          value={form.password}
          onChange={(event) =>
            setForm((state) => ({
              ...state,
              password: event.target.value
            }))
          }
        />
        <Button type="submit" loading={isLoading} className="w-full">
          Continue to dashboard
        </Button>
      </form>

      <p className="text-center text-sm text-[var(--brand-muted)]">
        Need an account?{' '}
        <Link to="/auth/register" className="text-[var(--brand-primary)] underline">
          Request access
        </Link>
      </p>
    </section>
  );
}

export default LoginPage;
