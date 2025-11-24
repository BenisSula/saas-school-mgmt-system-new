import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import StudentResultsPage from '../pages/student/StudentResultsPage';
import { BrandProvider } from '../components/ui/BrandProvider';
import { DashboardRouteProvider } from '../context/DashboardRouteContext';
import { AuthProvider } from '../context/AuthContext';
import * as AuthContextModule from '../context/AuthContext';
import { api } from '../lib/api';

type MockAuthModule = {
  __mockAuthState: {
    user: { id: string; role: string };
  };
};

const mockAuthState = (AuthContextModule as unknown as MockAuthModule).__mockAuthState;

function renderStudentResults() {
  return render(
    <DashboardRouteProvider defaultTitle="Student dashboard">
      <BrandProvider>
        <AuthProvider>
          <StudentResultsPage />
        </AuthProvider>
      </BrandProvider>
    </DashboardRouteProvider>
  );
}

describe('Student results synchronization', () => {
  beforeEach(() => {
    mockAuthState.user.role = 'student';
    mockAuthState.user.id = 'student-001';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('updates displayed results when another exam is selected', async () => {
    const user = userEvent.setup();

    vi.spyOn(api.student, 'listExamSummaries').mockResolvedValue([
      {
        examId: 'exam-1',
        name: 'Midterm Assessment',
        examDate: '2025-03-10',
        averageScore: 72,
        subjectCount: 2,
      },
      {
        examId: 'exam-2',
        name: 'Final Assessment',
        examDate: '2025-06-15',
        averageScore: 85,
        subjectCount: 2,
      },
    ]);

    vi.spyOn(api.student, 'listSubjects').mockResolvedValue([
      {
        subjectId: 'subject-math',
        name: 'Mathematics',
        code: 'MATH',
        dropRequested: false,
        dropStatus: 'none',
        dropRequestedAt: null,
      },
      {
        subjectId: 'subject-eng',
        name: 'English',
        code: 'ENG',
        dropRequested: false,
        dropStatus: 'none',
        dropRequestedAt: null,
      },
    ]);

    const getResultMock = vi.spyOn(api, 'getStudentResult');
    getResultMock.mockResolvedValueOnce({
      student_id: 'student-001',
      exam_id: 'exam-1',
      overall_score: 180,
      grade: 'A',
      remarks: null,
      breakdown: [
        { subject: 'Mathematics', score: 95, grade: 'A' },
        { subject: 'English', score: 85, grade: 'B' },
      ],
    });
    getResultMock.mockResolvedValueOnce({
      student_id: 'student-001',
      exam_id: 'exam-2',
      overall_score: 150,
      grade: 'B',
      remarks: null,
      breakdown: [
        { subject: 'Mathematics', score: 78, grade: 'B' },
        { subject: 'English', score: 72, grade: 'B' },
      ],
    });

    renderStudentResults();

    expect(await screen.findByText(/Exam performance/i)).toBeInTheDocument();
    expect(await screen.findByText(/Overall percentage: 90%/i)).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/Exam/i), 'exam-2');

    await waitFor(() => expect(getResultMock).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(/Overall percentage: 75%/i)).toBeInTheDocument();
    expect(screen.getByText(/Subject breakdown/i)).toBeInTheDocument();
    expect(screen.getByText(/Mathematics/i)).toBeInTheDocument();
  });
});
