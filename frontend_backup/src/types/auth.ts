import type { Role } from '../lib/api';
import type {
  StudentRegistrationInput,
  TeacherRegistrationInput,
  AdminRegistrationInput
} from '../lib/validators/authSchema';

// Extended registration payload that includes profile data
export interface ExtendedRegisterPayload {
  // Base auth fields
  email: string;
  password: string;
  role: Role;
  tenantId?: string;
  tenantName?: string;

  // Profile fields (role-specific)
  profile?: StudentProfilePayload | TeacherProfilePayload | AdminProfilePayload;
}

// Student profile payload (matches backend StudentInput structure)
export interface StudentProfilePayload {
  firstName: string;
  lastName: string;
  dateOfBirth?: string; // YYYY-MM-DD format
  classId?: string;
  admissionNumber?: string;
  parentContacts?: Array<{
    name: string;
    relationship: string;
    phone: string;
  }>;
  gender?: 'male' | 'female' | 'other';
  address?: string;
}

// Teacher profile payload (matches backend TeacherInput structure)
export interface TeacherProfilePayload {
  name: string;
  email: string;
  subjects: string[];
  assignedClasses?: string[];
  gender?: 'male' | 'female' | 'other';
  phone?: string;
  qualifications?: string;
  yearsOfExperience?: number;
  teacherId?: string;
  address?: string;
}

// Admin profile payload
export interface AdminProfilePayload {
  fullName: string;
  phone?: string;
  address?: string;
}

// Form state types
export interface StudentRegistrationFormData extends StudentRegistrationInput {
  // Additional form-only fields
  confirmPassword: string;
}

export interface TeacherRegistrationFormData extends TeacherRegistrationInput {
  // Additional form-only fields
  confirmPassword: string;
}

export interface AdminRegistrationFormData extends AdminRegistrationInput {
  // Additional form-only fields
  confirmPassword: string;
}

// Helper type to extract profile from registration input
export type RegistrationFormData =
  | StudentRegistrationFormData
  | TeacherRegistrationFormData
  | AdminRegistrationFormData;
