/**
 * Phase 7 Teacher Hooks
 * React Query hooks for teacher attendance, grades, resources, and announcements
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { toast } from 'sonner';

// ========== ATTENDANCE HOOKS ==========

export function useTeacherAttendance(params?: {
  classId?: string;
  date?: string;
  from?: string;
  to?: string;
}) {
  return useQuery({
    queryKey: ['teacher', 'attendance', params],
    queryFn: () => api.teachers.getAttendance(params),
    enabled: !!params?.classId || !!params?.date || !!params?.from,
  });
}

export function useMarkAttendance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (
      records: Array<{
        studentId: string;
        classId: string;
        status: 'present' | 'absent' | 'late';
        date: string;
      }>
    ) => api.teachers.markAttendance(records),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher', 'attendance'] });
      toast.success('Attendance marked successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to mark attendance');
    },
  });
}

export function useBulkMarkAttendance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (
      records: Array<{
        studentId: string;
        classId: string;
        status: 'present' | 'absent' | 'late';
        date: string;
      }>
    ) => api.teachers.bulkMarkAttendance(records),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher', 'attendance'] });
      toast.success('Attendance marked successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to mark attendance');
    },
  });
}

// ========== GRADES HOOKS ==========

export function useTeacherGrades(params?: {
  classId?: string;
  subjectId?: string;
  examId?: string;
  term?: string;
}) {
  return useQuery({
    queryKey: ['teacher', 'grades', params],
    queryFn: () => api.teachers.getGrades(params),
    enabled: !!params?.classId,
  });
}

export function useSubmitGrades() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (
      grades: Array<{
        studentId: string;
        classId: string;
        subjectId?: string;
        examId?: string;
        score: number;
        remarks?: string;
        term?: string;
      }>
    ) => api.teachers.submitGrades(grades),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher', 'grades'] });
      toast.success('Grades submitted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to submit grades');
    },
  });
}

export function useUpdateGrade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      gradeId,
      updates,
    }: {
      gradeId: string;
      updates: { score?: number; remarks?: string };
    }) => api.teachers.updateGrade(gradeId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher', 'grades'] });
      toast.success('Grade updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update grade');
    },
  });
}

// ========== RESOURCES HOOKS ==========

export function useClassResources(classId: string | undefined) {
  return useQuery({
    queryKey: ['teacher', 'resources', classId],
    queryFn: () => api.teachers.getResources(classId!),
    enabled: !!classId,
  });
}

export function useUploadResource() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (formData: FormData) => api.teachers.uploadResource(formData),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['teacher', 'resources', data.class_id] });
      toast.success('Resource uploaded successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to upload resource');
    },
  });
}

export function useDeleteResource() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (resourceId: string) => api.teachers.deleteResource(resourceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher', 'resources'] });
      toast.success('Resource deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete resource');
    },
  });
}

// ========== ANNOUNCEMENTS HOOKS ==========

export function usePostAnnouncement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (announcement: {
      classId: string;
      message: string;
      attachments?: Array<{ filename: string; url: string }>;
    }) => api.teachers.postAnnouncement(announcement),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['teacher', 'announcements', data.class_id] });
      queryClient.invalidateQueries({ queryKey: ['student', 'announcements', data.class_id] });
      toast.success('Announcement posted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to post announcement');
    },
  });
}

// ========== EXPORT HOOKS ==========

export function useExportAttendance() {
  return useMutation({
    mutationFn: (params: {
      classId: string;
      format?: 'pdf' | 'excel' | 'xlsx';
      date?: string;
      from?: string;
      to?: string;
    }) => api.teachers.exportAttendance(params),
    onSuccess: (blob, variables) => {
      const format = variables.format || 'pdf';
      const extension = format === 'excel' || format === 'xlsx' ? 'xlsx' : 'pdf';
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance_${variables.classId}_${new Date().toISOString().split('T')[0]}.${extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('Export downloaded successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to export attendance');
    },
  });
}

export function useExportGrades() {
  return useMutation({
    mutationFn: (params: {
      classId: string;
      format?: 'pdf' | 'excel' | 'xlsx';
      subjectId?: string;
      examId?: string;
      term?: string;
    }) => api.teachers.exportGrades(params),
    onSuccess: (blob, variables) => {
      const format = variables.format || 'pdf';
      const extension = format === 'excel' || format === 'xlsx' ? 'xlsx' : 'pdf';
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `grades_${variables.classId}_${new Date().toISOString().split('T')[0]}.${extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('Export downloaded successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to export grades');
    },
  });
}
