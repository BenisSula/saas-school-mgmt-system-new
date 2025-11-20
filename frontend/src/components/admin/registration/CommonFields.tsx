import { TextInput, PasswordInput } from '../../shared';
import { Select } from '../../ui/Select';

export interface CommonFieldsProps {
  email: string;
  fullName: string;
  password: string;
  confirmPassword: string;
  gender: string;
  address: string;
  fieldErrors: Record<string, string>;
  onEmailChange: (value: string) => void;
  onFullNameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onGenderChange: (value: string) => void;
  onAddressChange: (value: string) => void;
  onClearFieldError: (field: string) => void;
}

/**
 * Common form fields shared across all user roles
 * Extracted for reusability and modularity
 */
export function CommonFields({
  email,
  fullName,
  password,
  confirmPassword,
  gender,
  address,
  fieldErrors,
  onEmailChange,
  onFullNameChange,
  onPasswordChange,
  onConfirmPasswordChange,
  onGenderChange,
  onAddressChange,
  onClearFieldError
}: CommonFieldsProps) {
  return (
    <>
      {/* Email and Full Name */}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput
          label="Email"
          name="email"
          type="email"
          value={email}
          onChange={(e) => {
            onEmailChange(e.target.value);
            onClearFieldError('email');
          }}
          placeholder="user@school.edu"
          required
          error={fieldErrors.email}
        />
        <TextInput
          label="Full Name"
          name="fullName"
          type="text"
          value={fullName}
          onChange={(e) => {
            onFullNameChange(e.target.value);
            onClearFieldError('fullName');
          }}
          placeholder="John Doe"
          required
          error={fieldErrors.fullName}
        />
      </div>

      {/* Password Fields */}
      <div className="grid gap-4 sm:grid-cols-2">
        <PasswordInput
          label="Password"
          name="password"
          value={password}
          onChange={(e) => {
            onPasswordChange(e.target.value);
            onClearFieldError('password');
          }}
          placeholder="••••••••"
          required
          error={fieldErrors.password}
          showToggle={true}
        />
        <PasswordInput
          label="Confirm Password"
          name="confirmPassword"
          value={confirmPassword}
          onChange={(e) => {
            onConfirmPasswordChange(e.target.value);
            onClearFieldError('confirmPassword');
          }}
          placeholder="••••••••"
          required
          error={fieldErrors.confirmPassword}
          showToggle={true}
        />
      </div>

      {/* Gender and Address */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-[var(--brand-surface-contrast)]">
            Gender
          </label>
          <Select
            value={gender}
            onChange={(e) => {
              onGenderChange(e.target.value);
              onClearFieldError('gender');
            }}
            options={[
              { label: 'Select gender', value: '' },
              { label: 'Male', value: 'male' },
              { label: 'Female', value: 'female' },
              { label: 'Other', value: 'other' }
            ]}
          />
        </div>
        <TextInput
          label="Address"
          name="address"
          type="text"
          value={address}
          onChange={(e) => {
            onAddressChange(e.target.value);
            onClearFieldError('address');
          }}
          placeholder="123 Main St, City"
          error={fieldErrors.address}
        />
      </div>
    </>
  );
}

export default CommonFields;

