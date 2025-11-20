import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import TeacherGradeEntryPage from '../pages/TeacherGradeEntryPage';
import StudentResultsPage from '../pages/student/StudentResultsPage';
import AdminExamConfigPage from '../pages/admin/AdminExamConfigPage';
import { DashboardRouteProvider } from '../context/DashboardRouteContext';
import { api } from '../lib/api';

function renderWithDashboard(ui: ReactElement) {
  return render(<DashboardRouteProvider defaultTitle="Test">{ui}</DashboardRouteProvider>);
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
    expect(
      await screen.findByRole('heading', { name: /Examination Configuration/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/Upcoming Exams/i)).toBeInTheDocument();
  });
});
