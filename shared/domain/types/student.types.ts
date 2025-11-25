/**
 * Student Domain Types
 * 
 * Types related to the Student domain, shared between frontend and backend.
 */

export interface Student {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string | null;
  classId?: string | null;
  classUuid?: string | null;
  admissionNumber?: string | null;
  parentContacts?: Array<{
    name: string;
    relationship: string;
    phone?: string;
    email?: string;
  }>;
  enrollmentStatus?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface StudentInput {
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  classId?: string;
  admissionNumber?: string;
  parentContacts?: Array<{
    name: string;
    relationship: string;
    phone?: string;
    email?: string;
  }>;
}

export interface StudentFilters {
  enrollmentStatus?: string;
  classId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

