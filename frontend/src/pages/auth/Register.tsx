import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import type { Role } from '../../lib/api';
import { sanitizeIdentifier, sanitizeText } from '../../lib/sanitize';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';

const ROLE_OPTIONS: Array<{ label: string; value: Role }> = [
  { label: 'Student', value: 'student' },
  { label: 'Teacher', value: 'teacher' },
  { label: 'Admin', value: 'admin' }
];

export function RegisterPage() {
  const { register, isLoading } = useAuth();
  const [form, setForm] = useState({
    email: '',
    password: '',
    role: 'teacher' as Role,
    tenantId: ''
  });

  const isTenantRequired = form.role !== 'superadmin';

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isTenantRequired && !form.tenantId) {
      toast.error('Provide a tenant identifier for your institution.');
      return;
    }

    try {
      const result = await register({
        email: form.email,
        password: form.password,
        role: form.role,
        tenantId: form.role === 'superadmin' ? undefined : form.tenantId
      });

      if (result.user.status && result.user.status !== 'active') {
        toast.info(
          'Account created and pending admin approval. We will notify you once activated.'
        );
      } else {
        toast.success('Registration successful. Welcome aboard.');
      }
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  return (
    <section
      aria-label="Register"
      className="mx-auto max-w-lg space-y-8 rounded-3xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/90 p-10 shadow-lg"
    >
      <header className="space-y-2 text-center">
        <h1 className="text-3xl font-semibold text-[var(--brand-surface-contrast)]">
          Request dashboard access
        </h1>
        <p className="text-sm text-[var(--brand-muted)]">
          Student and teacher accounts activate after admin review. Admins can create operational
          users immediately.
        </p>
      </header>

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
        <Select
          label="Role"
          options={[...ROLE_OPTIONS, { label: 'Superadmin', value: 'superadmin' }]}
          value={form.role}
          onChange={(event) =>
            setForm((state) => ({
              ...state,
              role: event.target.value as Role
            }))
          }
        />
        {isTenantRequired ? (
          <Input
            label="Tenant ID"
            placeholder="tenant_alpha"
            required
            value={form.tenantId}
            onChange={(event) =>
              setForm((state) => ({
                ...state,
                tenantId: sanitizeIdentifier(event.target.value)
              }))
            }
          />
        ) : null}

        <Button type="submit" loading={isLoading} className="w-full">
          Submit request
        </Button>
      </form>

      <p className="text-center text-sm text-[var(--brand-muted)]">
        Already cleared by your admin?{' '}
        <Link to="/auth/login" className="text-[var(--brand-primary)] underline">
          Sign in
        </Link>
      </p>
    </section>
  );
}

export default RegisterPage;
