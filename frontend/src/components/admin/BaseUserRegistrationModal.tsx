import { useState } from 'react';
import { ModalShell } from '../../components/shared';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { ErrorBanner } from '../../components/shared';
import { CommonFields, StudentFields, TeacherFields, HODFields } from './registration';
import type {
  CommonFieldsProps,
  StudentFieldsProps,
  TeacherFieldsProps,
  HODFieldsProps
} from './registration';

export interface BaseUserRegistrationFormData {
  // Common fields
  email: string;
  fullName: string;
  password: string;
  confirmPassword: string;
  gender: string;
  address: string;
  // Student fields
  dateOfBirth: string;
  studentId: string;
  classId: string;
  parentGuardianName: string;
  parentGuardianContact: string;
  // Teacher/HOD fields
  phone: string;
  teacherId: string;
  qualifications: string;
  yearsOfExperience: string;
  subjects: string[];
  // HOD fields
  departmentId: string;
}

export interface BaseUserRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: BaseUserRegistrationFormData & { role: 'student' | 'teacher' | 'hod' }) => Promise<void>;
  defaultRole?: 'student' | 'teacher' | 'hod';
  submitting?: boolean;
  error?: string | null;
  fieldErrors?: Record<string, string>;
  onErrorDismiss?: () => void;
  onFieldErrorClear?: (field: string) => void;
  // HOD-specific props
  departments?: Array<{ id: string; name: string }>;
  loadingDepartments?: boolean;
  // Subject options
  subjectOptions?: Array<{ label: string; value: string }>;
}

/**
 * Base User Registration Modal Component
 * 
 * Provides a reusable modal structure for user registration
 * with role-specific field rendering
 */
export function BaseUserRegistrationModal({
  isOpen,
  onClose,
  onSubmit,
  defaultRole = 'student',
  submitting = false,
  error = null,
  fieldErrors = {},
  onErrorDismiss,
  onFieldErrorClear,
  departments = [],
  loadingDepartments = false,
  subjectOptions
}: BaseUserRegistrationModalProps) {
  const [role, setRole] = useState<'student' | 'teacher' | 'hod'>(defaultRole);
  const [formData, setFormData] = useState<BaseUserRegistrationFormData>({
    email: '',
    fullName: '',
    password: '',
    confirmPassword: '',
    gender: '',
    address: '',
    dateOfBirth: '',
    studentId: '',
    classId: '',
    parentGuardianName: '',
    parentGuardianContact: '',
    phone: '',
    teacherId: '',
    qualifications: '',
    yearsOfExperience: '',
    subjects: [],
    departmentId: ''
  });

  const isStudent = role === 'student';
  const isHOD = role === 'hod';

  const handleFieldChange = <K extends keyof BaseUserRegistrationFormData>(
    field: K,
    value: BaseUserRegistrationFormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await onSubmit({ ...formData, role });
  };

  const handleRoleChange = (newRole: 'student' | 'teacher' | 'hod') => {
    setRole(newRole);
    // Reset role-specific fields when switching roles
    if (newRole !== 'hod') {
      handleFieldChange('departmentId', '');
    }
    if (newRole !== 'student') {
      handleFieldChange('dateOfBirth', '');
      handleFieldError('dateOfBirth');
      handleFieldChange('studentId', '');
      handleFieldError('studentId');
      handleFieldChange('classId', '');
      handleFieldError('classId');
      handleFieldChange('parentGuardianName', '');
      handleFieldError('parentGuardianName');
      handleFieldChange('parentGuardianContact', '');
      handleFieldError('parentGuardianContact');
    }
  };

  const handleFieldError = (field: string) => {
    onFieldErrorClear?.(field);
  };

  const commonFieldsProps: CommonFieldsProps = {
    email: formData.email,
    fullName: formData.fullName,
    password: formData.password,
    confirmPassword: formData.confirmPassword,
    gender: formData.gender,
    address: formData.address,
    fieldErrors,
    onEmailChange: (value) => handleFieldChange('email', value),
    onFullNameChange: (value) => handleFieldChange('fullName', value),
    onPasswordChange: (value) => handleFieldChange('password', value),
    onConfirmPasswordChange: (value) => handleFieldChange('confirmPassword', value),
    onGenderChange: (value) => handleFieldChange('gender', value),
    onAddressChange: (value) => handleFieldChange('address', value),
    onClearFieldError: handleFieldError
  };

  const studentFieldsProps: StudentFieldsProps = {
    dateOfBirth: formData.dateOfBirth,
    studentId: formData.studentId,
    classId: formData.classId,
    parentGuardianName: formData.parentGuardianName,
    parentGuardianContact: formData.parentGuardianContact,
    fieldErrors,
    onDateOfBirthChange: (value) => handleFieldChange('dateOfBirth', value),
    onStudentIdChange: (value) => handleFieldChange('studentId', value),
    onClassIdChange: (value) => handleFieldChange('classId', value),
    onParentGuardianNameChange: (value) => handleFieldChange('parentGuardianName', value),
    onParentGuardianContactChange: (value) => handleFieldChange('parentGuardianContact', value),
    onClearFieldError: handleFieldError
  };

  const teacherFieldsProps: TeacherFieldsProps = {
    phone: formData.phone,
    teacherId: formData.teacherId,
    qualifications: formData.qualifications,
    yearsOfExperience: formData.yearsOfExperience,
    subjects: formData.subjects,
    fieldErrors,
    onPhoneChange: (value) => handleFieldChange('phone', value),
    onTeacherIdChange: (value) => handleFieldChange('teacherId', value),
    onQualificationsChange: (value) => handleFieldChange('qualifications', value),
    onYearsOfExperienceChange: (value) => handleFieldChange('yearsOfExperience', value),
    onSubjectsChange: (value) => handleFieldChange('subjects', value),
    onClearFieldError: handleFieldError,
    subjectOptions
  };

  const hodFieldsProps: HODFieldsProps = {
    departmentId: formData.departmentId,
    departments,
    loadingDepartments,
    fieldErrors,
    onDepartmentIdChange: (value) => handleFieldChange('departmentId', value),
    onClearFieldError: handleFieldError
  };

  return (
    <ModalShell
      title="Register New User"
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      footer={
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={submitting}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button type="submit" loading={submitting} disabled={submitting} className="flex-1">
            Register User
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-[var(--brand-muted)] mb-4">
          Create a new user account with profile. The user will be immediately active and can sign in.
        </p>

        {/* Role Selection */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-[var(--brand-surface-contrast)]">
            User Role <span className="text-red-500">*</span>
          </label>
          <Select
            value={role}
            onChange={(e) => handleRoleChange(e.target.value as 'student' | 'teacher' | 'hod')}
            options={[
              { label: 'Student', value: 'student' },
              { label: 'Teacher', value: 'teacher' },
              { label: 'Head of Department (HOD)', value: 'hod' }
            ]}
          />
        </div>

        {/* Common Fields */}
        <CommonFields {...commonFieldsProps} />

        {/* Student-Specific Fields */}
        {isStudent && <StudentFields {...studentFieldsProps} />}

        {/* HOD-Specific Fields */}
        {isHOD && <HODFields {...hodFieldsProps} />}

        {/* Teacher/HOD-Specific Fields */}
        {!isStudent && <TeacherFields {...teacherFieldsProps} />}

        {/* Error Banner */}
        {error && <ErrorBanner message={error} onDismiss={onErrorDismiss || (() => {})} />}
      </form>
    </ModalShell>
  );
}

export default BaseUserRegistrationModal;

