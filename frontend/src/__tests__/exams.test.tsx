import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, it, expect } from 'vitest';
import TeacherGradeEntryPage from '../pages/TeacherGradeEntryPage';
import StudentResultsPage from '../pages/student/StudentResultsPage';
import AdminExamConfigPage from '../pages/AdminExamConfigPage';
import { DashboardRouteProvider } from '../context/DashboardRouteContext';

function renderWithDashboard(ui: ReactElement) {
  return render(<DashboardRouteProvider defaultTitle="Test">{ui}</DashboardRouteProvider>);
}

describe('Exam pages', () => {
  it('renders teacher grade entry interface', () => {
    renderWithDashboard(<TeacherGradeEntryPage />);
    expect(screen.getByText(/Grade Entry/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save Grades/i })).toBeInTheDocument();
  });

  it('renders student results summary', () => {
    const { container } = renderWithDashboard(<StudentResultsPage />);
    expect(container.querySelector('.animate-pulse')).not.toBeNull();
  });

  it('renders admin configuration tools', () => {
    renderWithDashboard(<AdminExamConfigPage />);
    expect(screen.getByText(/Examination Configuration/i)).toBeInTheDocument();
    expect(screen.getByText(/Upcoming Exams/i)).toBeInTheDocument();
  });
});
