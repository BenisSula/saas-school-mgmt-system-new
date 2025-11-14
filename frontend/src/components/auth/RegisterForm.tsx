import React, { useEffect, useMemo, useState } from 'react';
import type { AuthResponse, Role } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';
import { sanitizeText } from '../../lib/sanitize';

const DEFAULT_ROLE: Role = (import.meta.env.VITE_DEFAULT_ROLE as Role | undefined) ?? 'teacher';

export interface RegisterFormProps {
  onSuccess?: (auth: AuthResponse) => void;
  onPending?: (auth: AuthResponse) => void;
  onSwitchToLogin?: () => void;
  defaultRole?: Role;
  defaultTenantId?: string;
  initialValues?: {
    name?: string;
    email?: string;
  };
  submitLabel?: string;
}

export function RegisterForm({
  onSuccess,
  onPending,
  onSwitchToLogin,
  defaultRole = DEFAULT_ROLE,
  defaultTenantId,
  initialValues,
  submitLabel = 'Create account'
}: RegisterFormProps) {
  const { register } = useAuth();
  const [name, setName] = useState(initialValues?.name ?? '');
  const [email, setEmail] = useState(initialValues?.email ?? '');
  const [password, setPassword] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const normalizedEmail = useMemo(() => sanitizeText(email).toLowerCase(), [email]);
  const normalizedName = useMemo(() => sanitizeText(name), [name]);
  const isAdminCreatingTenant = defaultRole === 'admin' && !defaultTenantId;
  const inputBase =
    'mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-base text-gray-900 shadow-sm transition-colors duration-150 focus:border-[#1ABC9C] focus:outline-none focus:ring-2 focus:ring-[#1ABC9C]/20';

  const passwordInputBase =
    'mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-3 pr-20 text-base text-gray-900 shadow-sm transition-colors duration-150 focus:border-[#1ABC9C] focus:outline-none focus:ring-2 focus:ring-[#1ABC9C]/20';

  useEffect(() => {
    if (initialValues) {
      setName(initialValues.name ?? '');
      setEmail(initialValues.email ?? '');
    }
  }, [initialValues]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;

    if (!normalizedName) {
      setError('Please provide your full name.');
      return;
    }

    if (!normalizedEmail) {
      setError('Please enter a valid email address.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      if (isAdminCreatingTenant && !tenantName.trim()) {
        setError('School/Organization name is required to create a new account.');
        return;
      }

      const payload = {
        email: normalizedEmail,
        password,
        role: defaultRole,
        ...(defaultRole === 'superadmin'
          ? {}
          : defaultTenantId
            ? { tenantId: defaultTenantId }
            : isAdminCreatingTenant
              ? { tenantName: tenantName.trim() }
              : {})
      };

      const auth = await register(payload);
      if (auth.user.status && auth.user.status !== 'active') {
        if (onPending) {
          onPending(auth);
        } else {
          setError('Account pending approval. Please await administrator confirmation.');
        }
        return;
      }
      if (onSuccess) {
        onSuccess(auth);
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message.trim() || 'Unable to create account right now. Please try again.'
          : 'Unable to create account right now. Please try again.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit} noValidate>
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700" htmlFor="register-name">
          Full name
        </label>
        <input
          id="register-name"
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="E.g. Jane Doe"
          autoComplete="name"
          required
          className={inputBase}
        />
      </div>
      {isAdminCreatingTenant ? (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700" htmlFor="register-tenant-name">
            School/Organization name
          </label>
          <input
            id="register-tenant-name"
            name="tenantName"
            type="text"
            value={tenantName}
            onChange={(event) => setTenantName(event.target.value)}
            placeholder="E.g. New Horizon Senior Secondary School"
            autoComplete="organization"
            required={isAdminCreatingTenant}
            className={inputBase}
          />
          <p className="text-xs text-gray-500">
            This will create a new organization account. You will be the administrator.
          </p>
        </div>
      ) : null}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700" htmlFor="register-email">
          Work email
        </label>
        <input
          id="register-email"
          name="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="principal@school.edu"
          autoComplete="email"
          required
          className={inputBase}
        />
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700" htmlFor="register-password">
          Password
        </label>
        <div className="relative">
          <input
            id="register-password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Create a secure password"
            autoComplete="new-password"
            required
            minLength={6}
            className={passwordInputBase}
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center px-2 py-1 text-xs font-medium text-[#234E70] transition-colors hover:text-[#1ABC9C] focus:outline-none focus:ring-2 focus:ring-[#1ABC9C]/20 rounded"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>
      {error ? (
        <p
          role="alert"
          className="rounded-md border border-red-500/60 bg-red-900/20 px-3 py-2 text-xs text-red-200"
        >
          {error}
        </p>
      ) : null}
      <div className="flex flex-col gap-3">
        <Button
          type="submit"
          loading={submitting}
          className="w-full !bg-[#1ABC9C] !text-white hover:!bg-[#149A82] focus-visible:!outline-[#1ABC9C]"
        >
          {submitLabel}
        </Button>
        {onSwitchToLogin ? (
          <button
            type="button"
            className="w-full inline-flex items-center justify-center rounded-md border border-transparent bg-[#F5A623] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition-colors hover:bg-[#E0951F] focus:outline-none focus:ring-2 focus:ring-[#F5A623]/20"
            onClick={onSwitchToLogin}
          >
            Back to sign in
          </button>
        ) : null}
      </div>
    </form>
  );
}

export default RegisterForm;
