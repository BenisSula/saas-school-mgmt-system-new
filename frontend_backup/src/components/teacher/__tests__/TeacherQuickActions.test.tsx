/**
 * Tests for TeacherQuickActions component
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { TeacherQuickActions } from '../TeacherQuickActions';

describe('TeacherQuickActions', () => {
  it('renders all quick action buttons', () => {
    render(
      <BrowserRouter>
        <TeacherQuickActions />
      </BrowserRouter>
    );

    expect(screen.getByText('Mark Attendance')).toBeInTheDocument();
    expect(screen.getByText('Enter Grades')).toBeInTheDocument();
    expect(screen.getByText('View Students')).toBeInTheDocument();
    expect(screen.getByText('Class Resources')).toBeInTheDocument();
    expect(screen.getByText('Announcements')).toBeInTheDocument();
  });

  it('has correct links for each action', () => {
    render(
      <BrowserRouter>
        <TeacherQuickActions />
      </BrowserRouter>
    );

    const attendanceLink = screen.getByText('Mark Attendance').closest('a');
    expect(attendanceLink).toHaveAttribute('href', '/dashboard/teacher/attendance');

    const gradesLink = screen.getByText('Enter Grades').closest('a');
    expect(gradesLink).toHaveAttribute('href', '/dashboard/teacher/grades');

    const studentsLink = screen.getByText('View Students').closest('a');
    expect(studentsLink).toHaveAttribute('href', '/dashboard/teacher/students');
  });
});

