import { useEffect } from 'react';
import type { AuthResponse, Role } from '../../lib/api';
import { useRegisterForm } from '../../hooks/useRegisterForm';
import { TextInput, PasswordInput, ErrorBanner } from '../shared';
import { AuthSelect } from './fields/AuthSelect';
import { AuthDatePicker } from './fields/AuthDatePicker';
import { AuthMultiSelect } from './fields/AuthMultiSelect';
import { AuthSubmitButton } from './fields/AuthSubmitButton';
import { TenantSelector } from './fields/TenantSelector';
import { FormSection } from './FormSection';

// Common subject options (can be fetched from API later)
const SUBJECT_OPTIONS = [
  { label: 'Mathematics', value: 'mathematics' },
  { label: 'English', value: 'english' },
  { label: 'Science', value: 'science' },
  { label: 'Physics', value: 'physics' },
  { label: 'Chemistry', value: 'chemistry' },
  { label: 'Biology', value: 'biology' },
  { label: 'History', value: 'history' },
  { label: 'Geography', value: 'geography' },
  { label: 'Computer Science', value: 'computer-science' },
  { label: 'Physical Education', value: 'physical-education' },
  { label: 'Art', value: 'art' },
  { label: 'Music', value: 'music' }
];

const GENDER_OPTIONS = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Other', value: 'other' }
];

// Ensure default role is in allowed list
const getDefaultRole = (): Role => {
  const envRole = import.meta.env.VITE_DEFAULT_ROLE as Role | undefined;
  const allowedRoles: Role[] = ['student', 'teacher'];
  if (envRole && allowedRoles.includes(envRole)) {
    return envRole;
  }
  return 'student'; // Safe default
};

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
  defaultRole = getDefaultRole(),
  defaultTenantId,
  initialValues,
  submitLabel = 'Create account'
}: RegisterFormProps) {

  const {
    values,
    setValue,
    fieldErrors,
    generalError,
    setGeneralError,
    submitting,
    handleSubmit,
    isStudent,
    isTeacher,
    tenantId,
    handleTenantSelect
  } = useRegisterForm({
    defaultRole,
    defaultTenantId,
    initialValues,
    onSuccess,
    onPending
  });

  useEffect(() => {
    if (initialValues) {
      if (initialValues.name !== undefined) {
        setValue('fullName', initialValues.name);
      }
      if (initialValues.email !== undefined) {
        setValue('email', initialValues.email);
      }
    }
  }, [initialValues, setValue]);

  return (
    <form className="space-y-4 sm:space-y-6" onSubmit={handleSubmit} noValidate>
      {/* Server Error Banner */}
      <ErrorBanner message={generalError || ''} onDismiss={() => setGeneralError(null)} />

      {/* Tenant/School Selection - Required for student and teacher */}
      {(isStudent || isTeacher) && (
        <TenantSelector
          value={tenantId}
          onChange={handleTenantSelect}
          error={fieldErrors.tenantId}
          helperText="Search for your school using registration code or school name"
          required
        />
      )}

      {/* Common Fields Section */}
      <FormSection title="Account Information">
        <TextInput
          id="register-full-name"
          name="fullName"
          label="Full name"
          value={values.fullName}
          onChange={(event) => setValue('fullName', event.target.value)}
          placeholder="E.g. Jane Doe"
          autoComplete="name"
          required
          error={fieldErrors.fullName}
          helperText="Enter your full name as it should appear on your account"
        />

        <TextInput
          id="register-email"
          name="email"
          type="email"
          label="Work email"
          value={values.email}
          onChange={(event) => setValue('email', event.target.value)}
          placeholder="principal@school.edu"
          autoComplete="email"
          required
          error={fieldErrors.email}
          helperText="Use your work or school email address"
        />

        <PasswordInput
          id="register-password"
          name="password"
          label="Password"
          value={values.password}
          onChange={(event) => setValue('password', event.target.value)}
          placeholder="Create a secure password"
          autoComplete="new-password"
          required
          error={fieldErrors.password}
          helperText="Must be at least 8 characters with uppercase, lowercase, number, and special character"
          showToggle={true}
        />

        <PasswordInput
          id="register-confirm-password"
          name="confirmPassword"
          label="Confirm password"
          value={values.confirmPassword}
          onChange={(event) => setValue('confirmPassword', event.target.value)}
          placeholder="Re-enter your password"
          autoComplete="new-password"
          required
          error={fieldErrors.confirmPassword}
          helperText="Must match your password"
          showToggle={true}
        />
      </FormSection>

      {/* Student-specific fields */}
      {isStudent && (
        <FormSection title="Student Information">
          <AuthSelect
            id="register-gender"
            name="gender"
            label="Gender"
            options={GENDER_OPTIONS}
            value={values.gender}
            onChange={(event) => setValue('gender', event.target.value)}
            required
            error={fieldErrors.gender}
            helperText="Select your gender"
          />

          <AuthDatePicker
            id="register-date-of-birth"
            name="dateOfBirth"
            label="Date of birth"
            value={values.dateOfBirth}
            onChange={(event) => setValue('dateOfBirth', event.target.value)}
            required
            error={fieldErrors.dateOfBirth}
            helperText="Enter your date of birth (YYYY-MM-DD)"
            max={
              new Date(new Date().setFullYear(new Date().getFullYear() - 5))
                .toISOString()
                .split('T')[0]
            }
          />

          <TextInput
            id="register-parent-guardian-name"
            name="parentGuardianName"
            label="Parent/Guardian name"
            value={values.parentGuardianName}
            onChange={(event) => setValue('parentGuardianName', event.target.value)}
            placeholder="E.g. John Doe"
            required
            error={fieldErrors.parentGuardianName}
            helperText="Enter the name of your parent or guardian"
          />

          <TextInput
            id="register-parent-guardian-contact"
            name="parentGuardianContact"
            label="Parent/Guardian contact"
            type="tel"
            value={values.parentGuardianContact}
            onChange={(event) => setValue('parentGuardianContact', event.target.value)}
            placeholder="+1234567890"
            required
            error={fieldErrors.parentGuardianContact}
            helperText="Enter phone number with country code"
          />

          <TextInput
            id="register-student-id"
            name="studentId"
            label="Student ID (optional)"
            value={values.studentId}
            onChange={(event) => setValue('studentId', event.target.value)}
            placeholder="Auto-generated if not provided"
            error={fieldErrors.studentId}
            helperText="Leave blank to auto-generate"
          />

          <TextInput
            id="register-class-id"
            name="classId"
            label="Class / Grade"
            value={values.classId}
            onChange={(event) => setValue('classId', event.target.value)}
            placeholder="E.g. Grade 12, Class A"
            required
            error={fieldErrors.classId}
            helperText="Enter your current class or grade"
          />

          <TextInput
            id="register-address"
            name="address"
            label="Address"
            value={values.address}
            onChange={(event) => setValue('address', event.target.value)}
            placeholder="Enter your full address"
            required
            error={fieldErrors.address}
            helperText="Enter your complete residential address"
          />
        </FormSection>
      )}

      {/* Teacher-specific fields */}
      {isTeacher && (
        <FormSection title="Teacher Information">
          <AuthSelect
            id="register-gender"
            name="gender"
            label="Gender"
            options={GENDER_OPTIONS}
            value={values.gender}
            onChange={(event) => setValue('gender', event.target.value)}
            required
            error={fieldErrors.gender}
            helperText="Select your gender"
          />

          <TextInput
            id="register-phone"
            name="phone"
            label="Phone number"
            type="tel"
            value={values.phone}
            onChange={(event) => setValue('phone', event.target.value)}
            placeholder="+1234567890"
            required
            error={fieldErrors.phone}
            helperText="Enter phone number with country code"
          />

          <TextInput
            id="register-qualifications"
            name="qualifications"
            label="Qualifications"
            value={values.qualifications}
            onChange={(event) => setValue('qualifications', event.target.value)}
            placeholder="E.g. B.Ed, M.Sc Mathematics"
            required
            error={fieldErrors.qualifications}
            helperText="Enter your educational qualifications"
          />

          <TextInput
            id="register-years-of-experience"
            name="yearsOfExperience"
            label="Years of experience"
            type="number"
            value={values.yearsOfExperience}
            onChange={(event) => setValue('yearsOfExperience', event.target.value)}
            placeholder="0"
            min="0"
            max="50"
            required
            error={fieldErrors.yearsOfExperience}
            helperText="Enter number of years of teaching experience"
          />

          <AuthMultiSelect
            label="Subject(s) taught"
            options={SUBJECT_OPTIONS}
            value={values.subjects}
            onChange={(value) => setValue('subjects', value)}
            placeholder="Select subjects you teach"
            required
            error={fieldErrors.subjects}
            helperText="Select all subjects you are qualified to teach"
          />

          <TextInput
            id="register-teacher-id"
            name="teacherId"
            label="Teacher ID (optional)"
            value={values.teacherId}
            onChange={(event) => setValue('teacherId', event.target.value)}
            placeholder="Auto-generated if not provided"
            error={fieldErrors.teacherId}
            helperText="Leave blank to auto-generate"
          />

          <TextInput
            id="register-address"
            name="address"
            label="Address"
            value={values.address}
            onChange={(event) => setValue('address', event.target.value)}
            placeholder="Enter your full address"
            required
            error={fieldErrors.address}
            helperText="Enter your complete residential address"
          />
        </FormSection>
      )}

      {/* Submit Button */}
      <div className="space-y-3">
        <AuthSubmitButton loading={submitting} variant="accent">
          {submitLabel}
        </AuthSubmitButton>

        {onSwitchToLogin && (
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="w-full inline-flex items-center justify-center rounded-lg border border-[var(--brand-border)] bg-transparent px-4 py-3 text-sm font-semibold text-[var(--brand-secondary)] transition-colors hover:bg-[var(--brand-surface)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--brand-secondary)]/20"
          >
            Already have an account? Sign in
          </button>
        )}
      </div>
    </form>
  );
}

export default RegisterForm;
