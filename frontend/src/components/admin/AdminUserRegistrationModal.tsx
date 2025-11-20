import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { userApi } from '../../lib/api/userApi';
import { CredentialDisplayModal } from './CredentialDisplayModal';
import { BaseUserRegistrationModal, type BaseUserRegistrationFormData } from './BaseUserRegistrationModal';
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

/**
 * Admin User Registration Modal (Refactored)
 * 
 * Uses BaseUserRegistrationModal for UI structure
 * Handles validation, submission, and credential display
 */
export function AdminUserRegistrationModal({
  onClose,
  onSuccess,
  defaultRole = 'student'
}: AdminUserRegistrationModalProps) {
  const [isOpen, setIsOpen] = useState(true);
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
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [currentRole, setCurrentRole] = useState<'student' | 'teacher' | 'hod'>(defaultRole);

  // Load departments when HOD role is selected
  useEffect(() => {
    if (currentRole === 'hod' && departments.length === 0) {
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
  }, [currentRole, departments.length]);

  const validateForm = (
    formData: BaseUserRegistrationFormData,
    role: 'student' | 'teacher' | 'hod'
  ): boolean => {
    try {
      let schema;
      let formDataToValidate: unknown;

      const normalizedEmail = sanitizeText(formData.email).toLowerCase();

      if (role === 'student') {
        formDataToValidate = {
          email: normalizedEmail,
          password: formData.password,
          confirmPassword: formData.confirmPassword,
          role: 'student',
          fullName: formData.fullName,
          gender: formData.gender || undefined,
          dateOfBirth: formData.dateOfBirth || undefined,
          parentGuardianName: formData.parentGuardianName || undefined,
          parentGuardianContact: formData.parentGuardianContact || undefined,
          studentId: formData.studentId || undefined,
          classId: formData.classId || undefined,
          address: formData.address || undefined
        };
        schema = studentRegistrationSchema;
      } else {
        formDataToValidate = {
          email: normalizedEmail,
          password: formData.password,
          confirmPassword: formData.confirmPassword,
          role: 'teacher',
          fullName: formData.fullName,
          gender: formData.gender || undefined,
          phone: formData.phone || undefined,
          qualifications: formData.qualifications || undefined,
          yearsOfExperience: formData.yearsOfExperience ? parseInt(formData.yearsOfExperience, 10) : 0,
          subjects: formData.subjects,
          teacherId: formData.teacherId || undefined,
          address: formData.address || undefined
        };
        schema = teacherRegistrationSchema;
      }

      schema.parse(formDataToValidate);
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

  const handleSubmit = async (data: BaseUserRegistrationFormData & { role: 'student' | 'teacher' | 'hod' }) => {
    if (submitting) return;

    setError(null);
    setCurrentRole(data.role);

    if (!validateForm(data, data.role)) {
      setError('Please correct the errors in the form.');
      return;
    }

    setSubmitting(true);

    try {
      const normalizedEmail = sanitizeText(data.email).toLowerCase();
      const isStudent = data.role === 'student';
      const isHOD = data.role === 'hod';

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
        password: data.password,
        role: data.role,
        fullName: data.fullName,
        ...(data.gender ? { gender: data.gender as 'male' | 'female' | 'other' } : {}),
        ...(data.address ? { address: data.address } : {})
      };

      if (isStudent) {
        if (data.dateOfBirth) payload.dateOfBirth = data.dateOfBirth;
        if (data.parentGuardianName) payload.parentGuardianName = data.parentGuardianName;
        if (data.parentGuardianContact) payload.parentGuardianContact = data.parentGuardianContact;
        if (data.studentId) payload.studentId = data.studentId;
        if (data.classId) payload.classId = data.classId;
      } else {
        if (data.phone) payload.phone = data.phone;
        if (data.qualifications) payload.qualifications = data.qualifications;
        if (data.yearsOfExperience) payload.yearsOfExperience = parseInt(data.yearsOfExperience, 10);
        if (data.subjects.length > 0) payload.subjects = data.subjects;
        if (data.teacherId) payload.teacherId = data.teacherId;
        // HOD-specific field
        if (isHOD && data.departmentId) payload.departmentId = data.departmentId;
      }

      await userApi.createUser({
        email: normalizedEmail,
        password: data.password,
        role: data.role,
        profile: payload
      });
      
      // Store credentials to show in modal
      setCreatedCredentials({
        email: normalizedEmail,
        password: data.password,
        fullName: data.fullName,
        role: data.role
      });
      
      // Show credential modal
      setShowCredentialModal(true);
      setIsOpen(false);
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

  const handleClose = () => {
    setIsOpen(false);
    onClose();
  };

  const handleCredentialModalClose = () => {
    setShowCredentialModal(false);
    setCreatedCredentials(null);
    setError(null);
    setFieldErrors({});
    onSuccess();
  };

  return (
    <>
      <BaseUserRegistrationModal
        isOpen={isOpen}
        onClose={handleClose}
        onSubmit={handleSubmit}
        defaultRole={defaultRole}
        submitting={submitting}
        error={error}
        fieldErrors={fieldErrors}
        departments={departments}
        loadingDepartments={loadingDepartments}
        subjectOptions={SUBJECT_OPTIONS}
        onErrorDismiss={() => setError(null)}
        onFieldErrorClear={(field) => {
          setFieldErrors((prev) => {
            const next = { ...prev };
            delete next[field];
            return next;
          });
        }}
      />

      {/* Credential Display Modal */}
      {showCredentialModal && createdCredentials && (
        <CredentialDisplayModal
          isOpen={showCredentialModal}
          onClose={handleCredentialModalClose}
          credentials={createdCredentials}
        />
      )}
    </>
  );
}

export default AdminUserRegistrationModal;

