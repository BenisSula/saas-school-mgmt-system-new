import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TeacherAttendancePage } from '../pages/TeacherAttendancePage';
import StudentAttendancePage from '../pages/student/StudentAttendancePage';
import { DashboardRouteProvider } from '../context/DashboardRouteContext';
import { api } from '../lib/api';

function renderWithDashboard(ui: ReactElement) {
  return render(<DashboardRouteProvider defaultTitle="Test">{ui}</DashboardRouteProvider>);
}

describe('Attendance pages', () => {
  beforeEach(() => {
    vi.spyOn(api.teacher, 'listClasses').mockResolvedValue([]);
    vi.spyOn(api.teacher, 'getClassRoster').mockResolvedValue([]);
    vi.spyOn(api, 'markAttendance').mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders teacher attendance table', async () => {
    renderWithDashboard(<TeacherAttendancePage />);
    expect(
      await screen.findByRole('heading', { level: 1, name: /Mark attendance/i })
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/Load a class roster to begin marking attendance/i)
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
