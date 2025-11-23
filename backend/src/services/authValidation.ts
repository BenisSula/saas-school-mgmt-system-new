import { Role } from '../config/permissions';
import {
  validateEmailFormat,
  validateRole,
  sanitizeTenantName,
  ValidationError,
  ALLOWED_ROLES
} from '../middleware/validation';
import { validatePassword, getDefaultPasswordPolicy } from '../services/security/passwordPolicyService';

export interface SignUpInputRaw {
  email: string;
  password: string;
  role: string;
  tenantId?: string;
  tenantName?: string;
  profile?: {
    fullName?: string;
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
  };
}

export interface SignUpInputNormalized {
  email: string;
  password: string;
  role: Role;
  tenantId?: string;
  tenantName?: string;
  profile?: SignUpInputRaw['profile'];
}

/**
 * Validates signup input and returns normalized data
 * Throws ValidationError for validation failures
 */
export function validateSignupInput(input: SignUpInputRaw): SignUpInputNormalized {
  // Validate email
  if (!input.email || typeof input.email !== 'string') {
    throw new ValidationError('Email is required', 'email');
  }

  const normalizedEmail = input.email.trim().toLowerCase();
  if (!validateEmailFormat(normalizedEmail)) {
    throw new ValidationError('Invalid email format', 'email');
  }

  // Validate password
  if (!input.password || typeof input.password !== 'string') {
    throw new ValidationError('Password is required', 'password');
  }

  // Use password policy service for validation (canonical)
  const defaultPolicy = getDefaultPasswordPolicy();
  const passwordValidation = validatePassword(input.password, defaultPolicy);
  if (!passwordValidation.isValid) {
    throw new ValidationError(
      `Password validation failed: ${passwordValidation.errors.join(', ')}`,
      'password'
    );
  }

  // Validate role
  if (!input.role || typeof input.role !== 'string') {
    throw new ValidationError('Role is required', 'role');
  }

  if (!validateRole(input.role)) {
    throw new ValidationError(
      `Invalid role. Allowed roles: ${ALLOWED_ROLES.join(', ')}`,
      'role'
    );
  }

  const role = input.role as Role;

  // RBAC: Validate role is allowed for self-registration
  const allowedSelfRegisterRoles: Role[] = ['student', 'teacher', 'admin'];
  if (!allowedSelfRegisterRoles.includes(role)) {
    throw new ValidationError(
      `Role '${role}' is not allowed for self-registration. Please contact an administrator.`,
      'role'
    );
  }

  // Additional RBAC: Admin can register with either tenantName (new org) or tenantId (existing org)
  if (role === 'admin' && !input.tenantName && !input.tenantId) {
    throw new ValidationError(
      'Admin registration requires either creating a new organization (tenantName) or joining an existing one (tenantId)',
      'tenantName'
    );
  }

  // Student and teacher require tenantId
  if ((role === 'student' || role === 'teacher') && !input.tenantId) {
    throw new ValidationError(
      'tenantId is required for student and teacher registration',
      'tenantId'
    );
  }

  // Sanitize tenant name if provided
  let sanitizedTenantName: string | undefined;
  if (input.tenantName) {
    try {
      sanitizedTenantName = sanitizeTenantName(input.tenantName);
    } catch (error) {
      throw new ValidationError(
        error instanceof Error ? error.message : 'Invalid tenant name',
        'tenantName'
      );
    }
  }

  return {
    email: normalizedEmail,
    password: input.password,
    role,
    tenantId: input.tenantId,
    tenantName: sanitizedTenantName,
    profile: input.profile
  };
}

/**
 * Normalizes signup payload for consistent processing
 */
export function normalizeSignupPayload(
  input: SignUpInputNormalized
): SignUpInputNormalized {
  return {
    email: input.email.toLowerCase().trim(),
    password: input.password, // Keep as-is (will be hashed later)
    role: input.role,
    tenantId: input.tenantId?.trim(),
    tenantName: input.tenantName?.trim(),
    profile: input.profile
  };
}

