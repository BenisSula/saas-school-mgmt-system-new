import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';
import { sanitizeText } from '../../lib/sanitize';

export interface LoginFormProps {
  onSuccess?: () => void;
  onSwitchToRegister?: () => void;
  initialValues?: {
    email?: string;
    password?: string;
  };
}

export function LoginForm({ onSuccess, onSwitchToRegister, initialValues }: LoginFormProps) {
  const { login } = useAuth();
  const [email, setEmail] = useState(initialValues?.email ?? '');
  const [password, setPassword] = useState(initialValues?.password ?? '');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmedEmail = useMemo(() => sanitizeText(email).toLowerCase(), [email]);

  const inputBase =
    'mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-base text-gray-900 shadow-sm transition-colors duration-150 focus:border-[#1ABC9C] focus:outline-none focus:ring-2 focus:ring-[#1ABC9C]/20';

  const passwordInputBase =
    'mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-3 pr-20 text-base text-gray-900 shadow-sm transition-colors duration-150 focus:border-[#1ABC9C] focus:outline-none focus:ring-2 focus:ring-[#1ABC9C]/20';

  useEffect(() => {
    if (initialValues) {
      setEmail(initialValues.email ?? '');
      setPassword(initialValues.password ?? '');
    }
  }, [initialValues]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;

    if (!trimmedEmail) {
      setError('Please enter your email address.');
      return;
    }

    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await login({ email: trimmedEmail, password });
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message.trim() || 'Unable to sign in right now. Please try again.'
          : 'Unable to sign in right now. Please try again.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit} noValidate>
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700" htmlFor="auth-email">
          Email
        </label>
        <input
          id="auth-email"
          name="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@school.edu"
          autoComplete="email"
          required
          className={inputBase}
        />
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700" htmlFor="auth-password">
          Password
        </label>
        <div className="relative">
          <input
            id="auth-password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            required
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
          className="bg-[#234E70] hover:brightness-110 focus-visible:outline-[#234E70]"
        >
          Sign in
        </Button>
        {onSwitchToRegister ? (
          <p className="text-xs text-slate-500">
            New to the platform?{' '}
            <button
              type="button"
              className="font-semibold text-[#234E70] transition hover:text-[#1ABC9C]"
              onClick={onSwitchToRegister}
            >
              Create an account
            </button>
          </p>
        ) : null}
      </div>
    </form>
  );
}

export default LoginForm;
