import { useEffect } from 'react';
import { useLoginForm } from '../../hooks/useLoginForm';
import { TextInput, PasswordInput, ErrorBanner } from '../shared';
import { AuthSubmitButton } from './fields/AuthSubmitButton';

export interface LoginFormProps {
  onSuccess?: () => void;
  onSwitchToRegister?: () => void;
  initialValues?: {
    email?: string;
    password?: string;
  };
}

export function LoginForm({ onSuccess, onSwitchToRegister, initialValues }: LoginFormProps) {

  const { values, setValue, fieldErrors, generalError, setGeneralError, submitting, handleSubmit } =
    useLoginForm({
      initialValues,
      onSuccess
    });

  useEffect(() => {
    if (initialValues) {
      if (initialValues.email !== undefined) {
        setValue('email', initialValues.email);
      }
      if (initialValues.password !== undefined) {
        setValue('password', initialValues.password);
      }
    }
  }, [initialValues, setValue]);

  return (
    <form className="space-y-4 sm:space-y-6" onSubmit={handleSubmit} noValidate>
      {/* Server Error Banner */}
      <ErrorBanner message={generalError || ''} onDismiss={() => setGeneralError(null)} />

      {/* Email Field */}
      <TextInput
        id="auth-email"
        name="email"
        type="email"
        label="Email"
        value={values.email}
        onChange={(event) => setValue('email', event.target.value)}
        placeholder="you@school.edu"
        autoComplete="email"
        required
        error={fieldErrors.email}
        helperText="Enter your registered email address"
      />

      {/* Password Field */}
      <PasswordInput
        id="auth-password"
        name="password"
        label="Password"
        value={values.password}
        onChange={(event) => setValue('password', event.target.value)}
        placeholder="••••••••"
        autoComplete="current-password"
        required
        error={fieldErrors.password}
        showToggle={true}
      />

      {/* Submit Button */}
      <div className="space-y-3">
        <AuthSubmitButton loading={submitting} variant="primary">
          Sign in
        </AuthSubmitButton>

        {onSwitchToRegister && (
          <p className="text-center text-sm text-[var(--brand-muted)]">
            New to the platform?{' '}
            <button
              type="button"
              onClick={onSwitchToRegister}
              className="font-semibold text-[var(--brand-primary)] transition-colors hover:text-[var(--brand-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 rounded"
            >
              Create an account
            </button>
          </p>
        )}
      </div>
    </form>
  );
}

export default LoginForm;
