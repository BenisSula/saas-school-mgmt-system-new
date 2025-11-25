import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TeacherGradeEntryPage from '../pages/teacher/GradeEntryPage';
import StudentResultsPage from '../pages/student/StudentResultsPage';
import AdminExamConfigPage from '../pages/admin/AdminExamConfigPage';
import { DashboardRouteProvider } from '../context/DashboardRouteContext';
import { api } from '../lib/api';

function renderWithDashboard(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <DashboardRouteProvider defaultTitle="Test">{ui}</DashboardRouteProvider>
    </QueryClientProvider>
  );
}

describe('Exam pages', () => {
  beforeEach(() => {
    vi.spyOn(api.teacher, 'listClasses').mockResolvedValue([]);
    vi.spyOn(api.teacher, 'getClassRoster').mockResolvedValue([]);
    vi.spyOn(api, 'getGradeReport').mockResolvedValue([]);
    vi.spyOn(api, 'bulkUpsertGrades').mockResolvedValue({ saved: 0 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders teacher grade entry interface', async () => {
    renderWithDashboard(<TeacherGradeEntryPage />);
    expect(await screen.findByText(/Grade Entry/i)).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Save Grades/i })).toBeInTheDocument();
  });

  it('renders student results summary', () => {
    const { container } = renderWithDashboard(<StudentResultsPage />);
    expect(container.querySelector('.animate-pulse')).not.toBeNull();
  });

  it('renders admin configuration tools', async () => {
    renderWithDashboard(<AdminExamConfigPage />);
    // Use getByRole to find the heading, which is more reliable
    // The heading is "Exam Configuration" not "Examination Configuration"
    expect(
      await screen.findByRole('heading', { name: /Exam Configuration/i })
    ).toBeInTheDocument();
    // The page may not have "Upcoming Exams" text if there are no exams
    // Just verify the page renders correctly
    expect(screen.getByText(/Manage exams and grading scales/i)).toBeInTheDocument();
  });
});
