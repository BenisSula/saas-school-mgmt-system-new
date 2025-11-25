import React, { useState, useMemo } from 'react';
import { X } from 'lucide-react';
import { api } from '../../lib/api';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { AuthInput } from '../auth/fields/AuthInput';
import { AuthMultiSelect } from '../auth/fields/AuthMultiSelect';
import { AuthErrorBanner } from '../auth/fields/AuthErrorBanner';
import { sanitizeText } from '../../lib/sanitize';
import { teacherRegistrationSchema } from '../../lib/validators/authSchema';
import type { ZodError } from 'zod';
import { useQuery } from '../../hooks/useQuery';
import { queryKeys } from '../../hooks/useQuery';
import { toast } from 'sonner';

export interface CreateHODModalProps {
  onClose: () => void;
  onSuccess: () => void;
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

export function CreateHODModal({ onClose, onSuccess }: CreateHODModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [gender, setGender] = useState<string>('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [qualifications, setQualifications] = useState('');
  const [yearsOfExperience, setYearsOfExperience] = useState<string>('');
  const [subjects, setSubjects] = useState<string[]>([]);
  const [teacherId, setTeacherId] = useState('');
  const [department, setDepartment] = useState<string>('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const normalizedEmail = useMemo(() => sanitizeText(email).toLowerCase(), [email]);

  // Fetch subjects for department dropdown
  const { data: subjectsData = [] } = useQuery(
    queryKeys.admin.subjects(),
    () => api.admin.listSubjects(),
    { staleTime: 60000 }
  );

  const departmentOptions = useMemo(() => {
    const subjectNames = subjectsData.map((s) => s.name);
    const uniqueSubjects = Array.from(new Set([...subjectNames, ...SUBJECT_OPTIONS.map((s) => s.label)]));
    return uniqueSubjects.map((name) => ({ label: name, value: name }));
  }, [subjectsData]);

  const clearFieldError = (field: string) => {
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const validateForm = (): boolean => {
    try {
      const formData = {
        email: normalizedEmail,
        password,
        confirmPassword,
        role: 'teacher' as const,
        fullName,
        gender: gender || undefined,
        phone: phone || undefined,
        qualifications: qualifications || undefined,
        yearsOfExperience: yearsOfExperience ? parseInt(yearsOfExperience, 10) : 0,
        subjects,
        teacherId: teacherId || undefined,
        address: address || undefined
      };
      teacherRegistrationSchema.parse(formData);
      
      if (!department) {
        setFieldErrors((prev) => ({ ...prev, department: 'Department is required for HOD' }));
        return false;
      }
      
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
      // Step 1: Create teacher account
      const teacherPayload = {
        email: normalizedEmail,
        password,
        role: 'teacher' as const,
        fullName,
        ...(gender ? { gender: gender as 'male' | 'female' | 'other' } : {}),
        ...(address ? { address } : {}),
        ...(phone ? { phone } : {}),
        ...(qualifications ? { qualifications } : {}),
        ...(yearsOfExperience ? { yearsOfExperience: parseInt(yearsOfExperience, 10) } : {}),
        ...(subjects.length > 0 ? { subjects } : {}),
        ...(teacherId ? { teacherId } : {})
      };

      const result = await api.registerUser(teacherPayload);
      
      // Step 2: Assign HOD role
      try {
        await api.updateUserRole(result.userId, 'hod');
      } catch (roleError) {
        // If role assignment fails, we still have the teacher account
        console.error('[CreateHODModal] Failed to assign HOD role:', roleError);
        toast.warning('Teacher account created, but HOD role assignment failed. You can assign it manually.');
      }

      // Step 3: Assign department
      if (department && result.userId) {
        try {
          await api.admin.assignHODDepartment(result.userId, department);
        } catch (deptError) {
          console.error('[CreateHODModal] Failed to assign department:', deptError);
          toast.warning('HOD created, but department assignment failed. You can assign it manually.');
        }
      }

      toast.success('HOD created successfully!');
      // Invalidate queries to refresh data
      // The onSuccess callback will handle this via React Query
      onSuccess();
    } catch (err) {
      let message = 'Failed to create HOD. Please try again.';
      if (err instanceof Error) {
        message = err.message.trim() || message;
      } else if (typeof err === 'string') {
        message = err.trim() || message;
      }
      console.error('[CreateHODModal] Creation error:', err);
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
            Create Head of Department
          </h2>
          <p className="mt-2 text-sm text-[var(--brand-muted)]">
            Create a new teacher account and assign HOD role with department. The HOD will be immediately active.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Common Fields */}
          <div className="grid gap-4 sm:grid-cols-2">
            <AuthInput
              label="Email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                clearFieldError('email');
              }}
              placeholder="hod@school.edu"
              required
              error={fieldErrors.email}
            />
            <AuthInput
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
            <AuthInput
              label="Password"
              name="password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                clearFieldError('password');
              }}
              placeholder="••••••••"
              required
              error={fieldErrors.password}
            />
            <AuthInput
              label="Confirm Password"
              name="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                clearFieldError('confirmPassword');
              }}
              placeholder="••••••••"
              required
              error={fieldErrors.confirmPassword}
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
            <AuthInput
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

          {/* Teacher-Specific Fields */}
          <div className="grid gap-4 sm:grid-cols-2">
            <AuthInput
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
            <AuthInput
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

          <AuthInput
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
            <AuthInput
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

          {/* HOD-Specific: Department */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-[var(--brand-surface-contrast)]">
              Department <span className="text-red-500">*</span>
            </label>
            <Select
              value={department}
              onChange={(e) => {
                setDepartment(e.target.value);
                clearFieldError('department');
              }}
              options={[
                { label: 'Select department', value: '' },
                ...departmentOptions
              ]}
              required
            />
            {fieldErrors.department && (
              <p className="text-xs text-red-500">{fieldErrors.department}</p>
            )}
            <p className="text-xs text-[var(--brand-muted)]">
              The department this HOD will oversee
            </p>
          </div>

          {error && <AuthErrorBanner message={error} onDismiss={() => setError(null)} />}

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
              Create HOD
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

