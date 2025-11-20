import type { StudentInput } from '../validators/studentValidator';
import type { TeacherInput } from '../validators/teacherValidator';

/**
 * Profile data structure from registration forms
 */
export interface RegistrationProfileData {
  fullName?: string;
  gender?: 'male' | 'female' | 'other';
  address?: string;
  // Student-specific fields
  dateOfBirth?: string;
  parentGuardianName?: string;
  parentGuardianContact?: string;
  studentId?: string;
  classId?: string;
  // Teacher-specific fields
  phone?: string;
  qualifications?: string;
  yearsOfExperience?: number;
  subjects?: string[];
  teacherId?: string;
  role?: string;
}

/**
 * Split full name into first and last name
 * Handles edge cases like single names, multiple middle names, etc.
 */
export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim();
  if (!trimmed) {
    return { firstName: '', lastName: '' };
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0] || '', lastName: '' };
  }

  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' ') || ''
  };
}

/**
 * Transform registration profile data to StudentInput
 * Used for both immediate profile creation (admin) and pending profile processing (approval)
 */
export function transformToStudentInput(profileData: RegistrationProfileData): StudentInput {
  const { firstName, lastName } = splitFullName(profileData.fullName || '');

  return {
    firstName,
    lastName,
    dateOfBirth: profileData.dateOfBirth,
    classId: profileData.classId,
    admissionNumber: profileData.studentId,
    parentContacts: profileData.parentGuardianName
      ? [
          {
            name: profileData.parentGuardianName,
            relationship: 'parent',
            phone: profileData.parentGuardianContact || ''
          }
        ]
      : undefined
  };
}

/**
 * Transform registration profile data to TeacherInput
 * Used for both immediate profile creation (admin) and pending profile processing (approval)
 */
export function transformToTeacherInput(
  profileData: RegistrationProfileData,
  userEmail: string
): TeacherInput {
  return {
    name: profileData.fullName || '',
    email: userEmail,
    subjects: profileData.subjects || [],
    assignedClasses: [] // Can be assigned later by admin
  };
}
