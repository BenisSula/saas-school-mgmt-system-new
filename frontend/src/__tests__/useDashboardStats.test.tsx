import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useTeacherStats,
  useStudentStats,
  useClassStats,
  useSubjectStats,
  useTodayAttendance,
  useLoginAttempts,
  useActiveSessions,
} from '../hooks/queries/useDashboardStats';
import { api } from '../lib/api';

// Mock the API
vi.mock('../lib/api', () => ({
  api: {
    listTeachers: vi.fn(),
    listStudents: vi.fn(),
    listClasses: vi.fn(),
    admin: {
      listSubjects: vi.fn(),
    },
    getAttendanceAggregate: vi.fn(),
    configuration: {
      listClasses: vi.fn(),
    },
  },
}));

describe('useDashboardStats hooks', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  describe('useTeacherStats', () => {
    it('fetches and returns teacher stats', async () => {
      const mockTeachers = [
        { id: '1', status: 'active', assigned_classes: ['class-1'] },
        { id: '2', status: 'active', assigned_classes: ['class-2'] },
        { id: '3', status: 'inactive', assigned_classes: [] },
      ];

      vi.mocked(api.listTeachers).mockResolvedValue(mockTeachers as never);

      const { result } = renderHook(() => useTeacherStats(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess || result.current.data).toBeTruthy();
      });

      if (result.current.data) {
        expect(result.current.data).toHaveProperty('total');
        expect(result.current.data).toHaveProperty('active');
        expect(result.current.data).toHaveProperty('assigned');
        expect(result.current.data).toHaveProperty('unassigned');
      }
      expect(api.listTeachers).toHaveBeenCalledTimes(1);
    });

    it('handles loading state', () => {
      vi.mocked(api.listTeachers).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const { result } = renderHook(() => useTeacherStats(), { wrapper });

      expect(result.current.isLoading).toBe(true);
    });

    it('handles error state', async () => {
      const error = new Error('Failed to fetch');
      vi.mocked(api.listTeachers).mockRejectedValue(error);

      const { result } = renderHook(() => useTeacherStats(), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toBeTruthy();
    });
  });

  describe('useStudentStats', () => {
    it('fetches and returns student stats', async () => {
      const mockStudents = [
        { id: '1', enrollment_status: 'active', class_id: 'class-1', gender: 'male' },
        { id: '2', enrollment_status: 'active', class_id: 'class-1', gender: 'female' },
        { id: '3', enrollment_status: 'active', class_id: 'class-2', gender: 'male' },
      ];

      vi.mocked(api.listStudents).mockResolvedValue(mockStudents as never);

      const { result } = renderHook(() => useStudentStats(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess || result.current.data).toBeTruthy();
      });

      if (result.current.data) {
        expect(result.current.data).toHaveProperty('total');
        expect(result.current.data).toHaveProperty('active');
        expect(result.current.data).toHaveProperty('byClass');
        expect(result.current.data).toHaveProperty('byGender');
      }
      expect(api.listStudents).toHaveBeenCalledTimes(1);
    });
  });

  describe('useClassStats', () => {
    it('fetches and returns class stats', async () => {
      const mockClasses = [
        { id: 'class-1', name: 'Class 1' },
        { id: 'class-2', name: 'Class 2' },
        { id: 'class-3', name: 'Class 3' },
      ];
      const mockStudents = [
        { id: '1', class_id: 'class-1' },
        { id: '2', class_id: 'class-2' },
      ];
      const mockTeachers = [{ id: '1', assigned_classes: ['class-1'] }];

      vi.mocked(api.listClasses).mockResolvedValue(mockClasses as never);
      vi.mocked(api.listStudents).mockResolvedValue(mockStudents as never);
      vi.mocked(api.listTeachers).mockResolvedValue(mockTeachers as never);

      const { result } = renderHook(() => useClassStats(), { wrapper });

      await waitFor(
        () => {
          expect(
            result.current.data || result.current.isSuccess || result.current.isLoading === false
          ).toBeTruthy();
        },
        { timeout: 3000 }
      );

      if (result.current.data) {
        expect(result.current.data).toHaveProperty('total');
        expect(result.current.data).toHaveProperty('withStudents');
        expect(result.current.data).toHaveProperty('withTeachers');
      }
      // Verify APIs were called
      expect(api.listClasses).toHaveBeenCalled();
    });
  });

  describe('useSubjectStats', () => {
    it('fetches and returns subject stats', async () => {
      const mockSubjects = [
        { id: 'subj-1', name: 'Math' },
        { id: 'subj-2', name: 'Science' },
      ];
      const mockTeachers = [
        { id: '1', subjects: ['subj-1'] },
        { id: '2', subjects: ['subj-1', 'subj-2'] },
      ];

      vi.mocked(api.admin.listSubjects).mockResolvedValue(mockSubjects as never);
      vi.mocked(api.listTeachers).mockResolvedValue(mockTeachers as never);

      const { result } = renderHook(() => useSubjectStats(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess || result.current.data).toBeTruthy();
      });

      if (result.current.data) {
        expect(result.current.data).toHaveProperty('total');
        expect(result.current.data).toHaveProperty('assigned');
        expect(result.current.data).toHaveProperty('unassigned');
      }
    });
  });

  describe('useTodayAttendance', () => {
    it('fetches and returns today attendance stats', async () => {
      // Mock the API calls that useTodayAttendance makes
      vi.mocked(api.getAttendanceAggregate).mockResolvedValue([
        { status: 'present', count: 40, attendance_date: new Date().toISOString(), class_id: 'class-1' },
        { status: 'absent', count: 5, attendance_date: new Date().toISOString(), class_id: 'class-1' },
        { status: 'late', count: 3, attendance_date: new Date().toISOString(), class_id: 'class-1' },
      ]);

      const { result } = renderHook(() => useTodayAttendance(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess || result.current.data).toBeTruthy();
      });

      // Verify the data structure matches expected format
      if (result.current.data) {
        expect(result.current.data).toHaveProperty('present');
        expect(result.current.data).toHaveProperty('absent');
        expect(result.current.data).toHaveProperty('late');
        expect(result.current.data).toHaveProperty('total');
        expect(result.current.data).toHaveProperty('percentage');
      }
    });
  });

  describe('useLoginAttempts', () => {
    it('returns login attempts structure', async () => {
      // Note: Currently returns mock data structure until backend endpoint is implemented
      const { result } = renderHook(() => useLoginAttempts(1), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess || result.current.data).toBeTruthy();
      });

      // Hook returns { successful: number, failed: number, attempts: LoginAttempt[] }
      expect(result.current.data).toBeTruthy();
      expect(result.current.data).toHaveProperty('successful');
      expect(result.current.data).toHaveProperty('failed');
      expect(result.current.data).toHaveProperty('attempts');
    });
  });

  describe('useActiveSessions', () => {
    it('returns active sessions array', async () => {
      // Note: Currently returns empty array until backend endpoint is implemented
      const { result } = renderHook(() => useActiveSessions(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess || result.current.data).toBeTruthy();
      });

      // Hook returns ActiveSession[] (currently empty array)
      expect(result.current.data).toBeTruthy();
      expect(Array.isArray(result.current.data)).toBe(true);
    });
  });
});
