import React, { useState, useMemo, useEffect } from 'react';
import { X } from 'lucide-react';
import { api } from '../../lib/api';
import { userApi } from '../../lib/api/userApi';
import { CredentialDisplayModal } from './CredentialDisplayModal';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { TextInput, PasswordInput, ErrorBanner } from '../shared';
import { AuthDatePicker } from '../auth/fields/AuthDatePicker';
import { AuthMultiSelect } from '../auth/fields/AuthMultiSelect';
import { sanitizeText } from '../../lib/sanitize';
import {
  studentRegistrationSchema,
  teacherRegistrationSchema
} from '../../lib/validators/authSchema';
import type { ZodError } from 'zod';

export interface AdminUserRegistrationModalProps {
  onClose: () => void;
  onSuccess: () => void;
  defaultRole?: 'student' | 'teacher' | 'hod';
}

const SUBJECT_OPTIONS = [
  { label: 'Mathematics', value: 'mathematics' },
  { label: 'English', value: 'english' },
  { label: 'Science', value: 'science' },
  { label: 'Social Studies', value: 'social_studies' },
  { label: 'Physical Education', value: 'physical_education' },
  { label: 'Arts', value: 'arts' },
  { label: 'Music', value: 'music' },
  { label: 'Computer Science', value: 'computer_science' }
];

export function AdminUserRegistrationModal({
  onClose,
  onSuccess,
  defaultRole = 'student'
}: AdminUserRegistrationModalProps) {
  const [role, setRole] = useState<'student' | 'teacher' | 'hod'>(defaultRole);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [gender, setGender] = useState<string>('');
  const [address, setAddress] = useState('');

  // Student fields
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [parentGuardianName, setParentGuardianName] = useState('');
  const [parentGuardianContact, setParentGuardianContact] = useState('');
  const [studentId, setStudentId] = useState('');
  const [classId, setClassId] = useState('');

  // Teacher/HOD fields
  const [phone, setPhone] = useState('');
  const [qualifications, setQualifications] = useState('');
  const [yearsOfExperience, setYearsOfExperience] = useState<string>('');
  const [subjects, setSubjects] = useState<string[]>([]);
  const [teacherId, setTeacherId] = useState('');
  // HOD fields
  const [departmentId, setDepartmentId] = useState<string>('');
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingDepartments, setLoadingDepartments] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showCredentialModal, setShowCredentialModal] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{
    email: string;
    password: string;
    fullName: string;
    role: string;
  } | null>(null);

  const isStudent = role === 'student';
  const isHOD = role === 'hod';
  const normalizedEmail = useMemo(() => sanitizeText(email).toLowerCase(), [email]);

  // Load departments when HOD role is selected
  useEffect(() => {
    if (isHOD && departments.length === 0) {
      setLoadingDepartments(true);
      api.listDepartments()
        .then((depts) => {
          setDepartments(depts);
        })
        .catch((err) => {
          console.error('[AdminUserRegistrationModal] Failed to load departments:', err);
          setError('Failed to load departments. Please try again.');
        })
        .finally(() => {
          setLoadingDepartments(false);
        });
    }
  }, [isHOD, departments.length]);

  const clearFieldError = (field: string) => {
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const validateForm = (): boolean => {
    try {
      let schema;
      let formData: unknown;

      if (isStudent) {
        formData = {
          email: normalizedEmail,
          password,
          confirmPassword,
          role: 'student',
          fullName,
          gender: gender || undefined,
          dateOfBirth: dateOfBirth || undefined,
          parentGuardianName: parentGuardianName || undefined,
          parentGuardianContact: parentGuardianContact || undefined,
          studentId: studentId || undefined,
          classId: classId || undefined,
          address: address || undefined
        };
        schema = studentRegistrationSchema;
      } else {
        formData = {
          email: normalizedEmail,
          password,
          confirmPassword,
          role: 'teacher',
          fullName,
          gender: gender || undefined,
          phone: phone || undefined,
          qualifications: qualifications || undefined,
          yearsOfExperience: yearsOfExperience ? parseInt(yearsOfExperience, 10) : 0,
          subjects,
          teacherId: teacherId || undefined,
          address: address || undefined
        };
        schema = teacherRegistrationSchema;
      }

      schema.parse(formData);
      setFieldErrors({});
      return true;
    } catch (err) {
      if (err && typeof err === 'object' && 'errors' in err) {
        const zodError = err as unknown as ZodError;
        const errors: Record<string, string> = {};
        zodError.issues.forEach((error) => {
          if (error.path.length > 0) {
            errors[error.path[0] as string] = error.message;
          }
        });
        setFieldErrors(errors);
      }
      return false;
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;

    setError(null);

    if (!validateForm()) {
      setError('Please correct the errors in the form.');
      return;
    }

    setSubmitting(true);

    try {
      const payload: {
        email: string;
        password: string;
        role: 'student' | 'teacher' | 'hod';
        fullName: string;
        gender?: 'male' | 'female' | 'other';
        address?: string;
        dateOfBirth?: string;
        parentGuardianName?: string;
        parentGuardianContact?: string;
        studentId?: string;
        classId?: string;
        phone?: string;
        qualifications?: string;
        yearsOfExperience?: number;
        subjects?: string[];
        teacherId?: string;
        departmentId?: string;
      } = {
        email: normalizedEmail,
        password,
        role,
        fullName,
        ...(gender ? { gender: gender as 'male' | 'female' | 'other' } : {}),
        ...(address ? { address } : {})
      };

      if (isStudent) {
        if (dateOfBirth) payload.dateOfBirth = dateOfBirth;
        if (parentGuardianName) payload.parentGuardianName = parentGuardianName;
        if (parentGuardianContact) payload.parentGuardianContact = parentGuardianContact;
        if (studentId) payload.studentId = studentId;
        if (classId) payload.classId = classId;
      } else {
        if (phone) payload.phone = phone;
        if (qualifications) payload.qualifications = qualifications;
        if (yearsOfExperience) payload.yearsOfExperience = parseInt(yearsOfExperience, 10);
        if (subjects.length > 0) payload.subjects = subjects;
        if (teacherId) payload.teacherId = teacherId;
        // HOD-specific field
        if (isHOD && departmentId) payload.departmentId = departmentId;
      }

      await userApi.createUser({
        email: normalizedEmail,
        password: password,
        role: role,
        profile: payload
      });
      
      // Store credentials to show in modal
      setCreatedCredentials({
        email: normalizedEmail,
        password: password, // Store plain password before it's hashed
        fullName: fullName,
        role: role
      });
      
      // Show credential modal
      setShowCredentialModal(true);
      
      // Don't call onSuccess yet - wait for user to close credential modal
    } catch (err) {
      let message = 'Failed to register user. Please try again.';
      if (err instanceof Error) {
        message = err.message.trim() || message;
      } else if (typeof err === 'string') {
        message = err.trim() || message;
      }
      console.error('[AdminUserRegistrationModal] Registration error:', err);
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-auto rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-2 text-[var(--brand-muted)] transition-colors hover:bg-[var(--brand-surface)]/50 hover:text-[var(--brand-surface-contrast)]"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <header className="mb-6">
          <h2 className="text-2xl font-semibold text-[var(--brand-surface-contrast)]">
            Register New User
          </h2>
          <p className="mt-2 text-sm text-[var(--brand-muted)]">
            Create a new user account with profile. The user will be immediately active and can sign
            in.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Role Selection */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-[var(--brand-surface-contrast)]">
              User Role <span className="text-red-500">*</span>
            </label>
            <Select
              value={role}
              onChange={(e) => {
                setRole(e.target.value as 'student' | 'teacher' | 'hod');
                setFieldErrors({});
                setError(null);
                // Reset department when switching roles
                if (e.target.value !== 'hod') {
                  setDepartmentId('');
                }
              }}
              options={[
                { label: 'Student', value: 'student' },
                { label: 'Teacher', value: 'teacher' },
                { label: 'Head of Department (HOD)', value: 'hod' }
              ]}
            />
          </div>

          {/* Common Fields */}
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput
              label="Email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                clearFieldError('email');
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
                setFullName(e.target.value);
                clearFieldError('fullName');
              }}
              placeholder="John Doe"
              required
              error={fieldErrors.fullName}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <PasswordInput
              label="Password"
              name="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                clearFieldError('password');
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
                setConfirmPassword(e.target.value);
                clearFieldError('confirmPassword');
              }}
              placeholder="••••••••"
              required
              error={fieldErrors.confirmPassword}
              showToggle={true}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-[var(--brand-surface-contrast)]">
                Gender
              </label>
              <Select
                value={gender}
                onChange={(e) => {
                  setGender(e.target.value);
                  clearFieldError('gender');
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
                setAddress(e.target.value);
                clearFieldError('address');
              }}
              placeholder="123 Main St, City"
              error={fieldErrors.address}
            />
          </div>

          {/* Student-Specific Fields */}
          {isStudent && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <AuthDatePicker
                  label="Date of Birth"
                  value={dateOfBirth}
                  onChange={(e) => {
                    setDateOfBirth(e.target.value);
                    clearFieldError('dateOfBirth');
                  }}
                  error={fieldErrors.dateOfBirth}
                />
                <TextInput
                  label="Student ID"
                  name="studentId"
                  type="text"
                  value={studentId}
                  onChange={(e) => {
                    setStudentId(e.target.value);
                    clearFieldError('studentId');
                  }}
                  placeholder="STU-2025-001"
                  error={fieldErrors.studentId}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <TextInput
                  label="Class/Grade"
                  name="classId"
                  type="text"
                  value={classId}
                  onChange={(e) => {
                    setClassId(e.target.value);
                    clearFieldError('classId');
                  }}
                  placeholder="Grade 10"
                  error={fieldErrors.classId}
                />
                <TextInput
                  label="Parent/Guardian Name"
                  name="parentGuardianName"
                  type="text"
                  value={parentGuardianName}
                  onChange={(e) => {
                    setParentGuardianName(e.target.value);
                    clearFieldError('parentGuardianName');
                  }}
                  placeholder="Parent Name"
                  error={fieldErrors.parentGuardianName}
                />
              </div>

              <TextInput
                label="Parent/Guardian Contact"
                name="parentGuardianContact"
                type="tel"
                value={parentGuardianContact}
                onChange={(e) => {
                  setParentGuardianContact(e.target.value);
                  clearFieldError('parentGuardianContact');
                }}
                placeholder="+1234567890"
                error={fieldErrors.parentGuardianContact}
              />
            </>
          )}

          {/* HOD-Specific Fields */}
          {isHOD && (
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-[var(--brand-surface-contrast)]">
                Department <span className="text-red-500">*</span>
              </label>
              <Select
                value={departmentId}
                onChange={(e) => {
                  setDepartmentId(e.target.value);
                  clearFieldError('departmentId');
                }}
                disabled={loadingDepartments}
                options={[
                  { label: loadingDepartments ? 'Loading departments...' : 'Select department', value: '' },
                  ...departments.map((dept) => ({ label: dept.name, value: dept.id }))
                ]}
              />
              {fieldErrors.departmentId && (
                <p className="text-xs text-red-500">{fieldErrors.departmentId}</p>
              )}
            </div>
          )}

          {/* Teacher/HOD-Specific Fields */}
          {!isStudent && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextInput
                  label="Phone Number"
                  name="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    clearFieldError('phone');
                  }}
                  placeholder="+1234567890"
                  error={fieldErrors.phone}
                />
                <TextInput
                  label="Teacher ID"
                  name="teacherId"
                  type="text"
                  value={teacherId}
                  onChange={(e) => {
                    setTeacherId(e.target.value);
                    clearFieldError('teacherId');
                  }}
                  placeholder="TCH-2025-001"
                  error={fieldErrors.teacherId}
                />
              </div>

              <TextInput
                label="Qualifications"
                name="qualifications"
                type="text"
                value={qualifications}
                onChange={(e) => {
                  setQualifications(e.target.value);
                  clearFieldError('qualifications');
                }}
                placeholder="B.Ed, M.Sc Mathematics"
                error={fieldErrors.qualifications}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <TextInput
                  label="Years of Experience"
                  name="yearsOfExperience"
                  type="number"
                  value={yearsOfExperience}
                  onChange={(e) => {
                    setYearsOfExperience(e.target.value);
                    clearFieldError('yearsOfExperience');
                  }}
                  placeholder="5"
                  min="0"
                  max="50"
                  error={fieldErrors.yearsOfExperience}
                />
                <AuthMultiSelect
                  label="Subjects Taught"
                  options={SUBJECT_OPTIONS}
                  value={subjects}
                  onChange={(value) => {
                    setSubjects(value);
                    clearFieldError('subjects');
                  }}
                  placeholder="Select subjects"
                  error={fieldErrors.subjects}
                />
              </div>
            </>
          )}

          {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

          <div className="flex gap-3 pt-4">
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
        </form>
      </div>

      {/* Credential Display Modal */}
      {showCredentialModal && createdCredentials && (
        <CredentialDisplayModal
          isOpen={showCredentialModal}
          onClose={() => {
            setShowCredentialModal(false);
            setCreatedCredentials(null);
            // Clear form and close modal
            setEmail('');
            setPassword('');
            setConfirmPassword('');
            setFullName('');
            setGender('');
            setAddress('');
            setDateOfBirth('');
            setParentGuardianName('');
            setParentGuardianContact('');
            setStudentId('');
            setClassId('');
            setPhone('');
            setQualifications('');
            setYearsOfExperience('');
            setSubjects([]);
            setTeacherId('');
            setDepartmentId('');
            setError(null);
            setFieldErrors({});
            onSuccess();
          }}
          credentials={createdCredentials}
        />
      )}
    </div>
  );
}
