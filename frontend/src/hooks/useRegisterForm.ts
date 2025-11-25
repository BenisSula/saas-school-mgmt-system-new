import { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { sanitizeText } from '../lib/sanitize';
import { useAuthForm } from './useAuthForm';
import type { AuthResponse, Role } from '../lib/api';
import type { TenantLookupResult } from '../lib/api';
import { studentRegistrationSchema, teacherRegistrationSchema } from '../lib/validators/authSchema';
import type { ZodError } from 'zod';

// RBAC: Only student and teacher can self-register
const ALLOWED_SELF_REGISTER_ROLES: Role[] = ['student', 'teacher'];

export interface UseRegisterFormOptions {
  defaultRole?: Role;
  defaultTenantId?: string;
  initialValues?: {
    name?: string;
    email?: string;
  };
  onSuccess?: (auth: AuthResponse) => void;
  onPending?: (auth: AuthResponse) => void;
}

export interface RegisterFormValues extends Record<string, unknown> {
  email: string;
  password: string;
  confirmPassword: string;
  fullName: string;
  gender: string;
  address: string;
  // Student fields
  dateOfBirth: string;
  parentGuardianName: string;
  parentGuardianContact: string;
  studentId: string;
  classId: string;
  // Teacher fields
  phone: string;
  qualifications: string;
  yearsOfExperience: string;
  subjects: string[];
  teacherId: string;
}

/**
 * Hook for registration form logic
 * Handles role-based validation, tenant selection, and submission
 */
export function useRegisterForm(options: UseRegisterFormOptions = {}) {
  const { register } = useAuth();
  const {
    defaultRole = 'student',
    defaultTenantId,
    initialValues = {},
    onSuccess,
    onPending,
  } = options;

  const [selectedTenant, setSelectedTenant] = useState<TenantLookupResult | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(defaultTenantId || null);

  // RBAC: Validate role is allowed for self-registration
  const validatedRole = useMemo(
    () => (ALLOWED_SELF_REGISTER_ROLES.includes(defaultRole) ? defaultRole : 'student'),
    [defaultRole]
  );

  const isStudent = validatedRole === 'student';
  const isTeacher = validatedRole === 'teacher';

  const normalizedEmail = useMemo(
    () => sanitizeText(initialValues.email || '').toLowerCase(),
    [initialValues.email]
  );

  const handleTenantSelect = (id: string | null, tenant: TenantLookupResult | null) => {
    setTenantId(id);
    setSelectedTenant(tenant);
  };

  const validate = useMemo(
    () =>
      (values: RegisterFormValues): Record<string, string> | null => {
        try {
          let schema;
          let formData: unknown;

          const resolvedTenantId = tenantId || defaultTenantId;

          if (isStudent) {
            formData = {
              email: sanitizeText(values.email).toLowerCase(),
              password: values.password,
              confirmPassword: values.confirmPassword,
              role: 'student',
              tenantId: resolvedTenantId,
              fullName: values.fullName,
              gender: values.gender,
              dateOfBirth: values.dateOfBirth,
              parentGuardianName: values.parentGuardianName,
              parentGuardianContact: values.parentGuardianContact,
              studentId: values.studentId || undefined,
              classId: values.classId || undefined,
              address: values.address,
            };
            schema = studentRegistrationSchema;
          } else if (isTeacher) {
            formData = {
              email: sanitizeText(values.email).toLowerCase(),
              password: values.password,
              confirmPassword: values.confirmPassword,
              role: 'teacher',
              tenantId: resolvedTenantId,
              fullName: values.fullName,
              gender: values.gender,
              phone: values.phone,
              qualifications: values.qualifications,
              yearsOfExperience: values.yearsOfExperience
                ? parseInt(values.yearsOfExperience, 10)
                : 0,
              subjects: values.subjects,
              teacherId: values.teacherId || undefined,
              address: values.address,
            };
            schema = teacherRegistrationSchema;
          } else {
            return {
              role: 'Invalid role for registration. Only student and teacher can self-register.',
            };
          }

          // Security: Ensure tenantId is provided for student/teacher
          if ((isStudent || isTeacher) && !resolvedTenantId) {
            return { tenantId: 'Please select your school/institution to continue registration.' };
          }

          schema.parse(formData);
          return null;
        } catch (err) {
          if (err && typeof err === 'object' && 'errors' in err) {
            const zodError = err as unknown as ZodError;
            const errors: Record<string, string> = {};
            zodError.issues.forEach((error) => {
              if (error.path.length > 0) {
                errors[error.path[0] as string] = error.message;
              }
            });
            return errors;
          }
          return { general: 'Validation failed. Please check your input.' };
        }
      },
    [tenantId, defaultTenantId, isStudent, isTeacher]
  );

  const handleSubmit = async (values: RegisterFormValues): Promise<AuthResponse> => {
    const resolvedTenantId = tenantId || defaultTenantId;

    // Security: Ensure tenantId is provided for student/teacher
    if ((isStudent || isTeacher) && !resolvedTenantId) {
      throw new Error('Please select your school/institution to continue registration.');
    }

    // Build profile data based on role
    const profileData: Record<string, unknown> = {
      fullName: values.fullName,
      gender: values.gender || undefined,
      address: values.address || undefined,
    };

    if (isStudent) {
      profileData.dateOfBirth = values.dateOfBirth || undefined;
      profileData.parentGuardianName = values.parentGuardianName || undefined;
      profileData.parentGuardianContact = values.parentGuardianContact || undefined;
      profileData.studentId = values.studentId || undefined;
      profileData.classId = values.classId || undefined;
    } else if (isTeacher) {
      profileData.phone = values.phone || undefined;
      profileData.qualifications = values.qualifications || undefined;
      profileData.yearsOfExperience = values.yearsOfExperience
        ? parseInt(values.yearsOfExperience, 10)
        : undefined;
      profileData.subjects = values.subjects.length > 0 ? values.subjects : undefined;
      profileData.teacherId = values.teacherId || undefined;
    }

    const payload = {
      email: sanitizeText(values.email).toLowerCase(),
      password: values.password,
      role: validatedRole,
      ...(resolvedTenantId ? { tenantId: resolvedTenantId } : {}),
      profile: Object.keys(profileData).length > 0 ? profileData : undefined,
    };

    const auth = await register(payload);

    // Handle pending status
    if (auth.user.status && auth.user.status !== 'active') {
      if (onPending) {
        onPending(auth);
      }
      return auth;
    }

    if (onSuccess) {
      onSuccess(auth);
    }

    return auth;
  };

  const form = useAuthForm<RegisterFormValues>({
    initialValues: {
      email: initialValues.email || '',
      password: '',
      confirmPassword: '',
      fullName: initialValues.name || '',
      gender: '',
      address: '',
      dateOfBirth: '',
      parentGuardianName: '',
      parentGuardianContact: '',
      studentId: '',
      classId: '',
      phone: '',
      qualifications: '',
      yearsOfExperience: '',
      subjects: [],
      teacherId: '',
    },
    onSubmit: handleSubmit,
    validate,
  });

  return {
    ...form,
    validatedRole,
    isStudent,
    isTeacher,
    normalizedEmail,
    selectedTenant,
    tenantId,
    setTenantId,
    handleTenantSelect,
  };
}
