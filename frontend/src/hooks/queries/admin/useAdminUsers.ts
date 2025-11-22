/**
 * React Query hooks for Admin User Management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { toast } from 'sonner';
import { unwrapApiResponse } from '../../../lib/apiResponseUtils';

export interface AdminUser {
  id: string;
  email: string;
  role: string;
  status: string;
  isVerified: boolean;
  createdAt: string;
}

export interface CreateHODInput {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  departmentId?: string;
  qualifications?: string;
  yearsOfExperience?: number;
  subjects?: string[];
}

export interface CreateTeacherInput {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  qualifications?: string;
  yearsOfExperience?: number;
  subjects?: string[];
  teacherId?: string;
}

export interface CreateStudentInput {
  email: string;
  password: string;
  fullName: string;
  gender?: 'male' | 'female' | 'other';
  dateOfBirth?: string;
  parentGuardianName?: string;
  parentGuardianContact?: string;
  studentId?: string;
  classId?: string;
}

export function useAdminUsers(filters?: { role?: string; status?: string }) {
  return useQuery({
    queryKey: ['admin', 'users', filters],
    queryFn: async () => {
      const response = await api.admin.listUsers(filters);
      return unwrapApiResponse(response);
    },
    staleTime: 30000, // 30 seconds
  });
}

export function useCreateHOD() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateHODInput) => api.admin.createHOD(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'hods'] });
      toast.success('HOD created successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create HOD');
    },
  });
}

export function useCreateTeacher() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTeacherInput) => api.admin.createTeacher(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'teachers'] });
      toast.success('Teacher created successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create teacher');
    },
  });
}

export function useCreateStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateStudentInput) => api.admin.createStudent(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'students'] });
      toast.success('Student created successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create student');
    },
  });
}

export function useDisableUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.admin.disableUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      toast.success('User disabled successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to disable user');
    },
  });
}

export function useEnableUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.admin.enableUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      toast.success('User enabled successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to enable user');
    },
  });
}

