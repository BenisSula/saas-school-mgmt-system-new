/**
 * React Query hooks for Admin Announcements
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { toast } from 'sonner';
import { unwrapApiResponse } from '../../../lib/apiResponseUtils';

export interface Announcement {
  id: string;
  title: string;
  content: string;
  targetRoles: string[];
  priority: string;
  createdBy: string;
  createdAt: string;
  expiresAt: string | null;
}

export interface CreateAnnouncementInput {
  title: string;
  content: string;
  targetRoles: Array<'admin' | 'hod' | 'teacher' | 'student'>;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  expiresAt?: string;
}

export interface AnnouncementFilters {
  limit?: number;
  offset?: number;
  targetRole?: 'admin' | 'hod' | 'teacher' | 'student';
}

export function useAnnouncements(filters?: AnnouncementFilters) {
  return useQuery({
    queryKey: ['admin', 'announcements', filters],
    queryFn: async () => {
      const response = await api.admin.listAnnouncements(filters);
      return unwrapApiResponse(response);
    },
    staleTime: 30000, // 30 seconds
  });
}

export function useCreateAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAnnouncementInput) => api.admin.createAnnouncement(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'announcements'] });
      toast.success('Announcement created successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create announcement');
    },
  });
}
