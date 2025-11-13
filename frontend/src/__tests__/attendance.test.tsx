import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, it, expect } from 'vitest';
import { TeacherAttendancePage } from '../pages/TeacherAttendancePage';
import StudentAttendancePage from '../pages/student/StudentAttendancePage';
import { DashboardRouteProvider } from '../context/DashboardRouteContext';

function renderWithDashboard(ui: ReactElement) {
  return render(<DashboardRouteProvider defaultTitle="Test">{ui}</DashboardRouteProvider>);
}

describe('Attendance pages', () => {
  it('renders teacher attendance table', () => {
    renderWithDashboard(<TeacherAttendancePage />);
    expect(screen.getByRole('heading', { level: 1, name: /Mark attendance/i })).toBeInTheDocument();
    expect(
      screen.getByText(/Load a class roster to begin marking attendance/i)
    ).toBeInTheDocument();
  });

  it('renders student attendance summary', () => {
    renderWithDashboard(<StudentAttendancePage />);
    expect(
      screen.getByRole('heading', { level: 1, name: /Attendance history/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/Attendance rate/i)).toBeInTheDocument();
  });
});
