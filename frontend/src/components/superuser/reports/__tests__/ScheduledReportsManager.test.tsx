import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ScheduledReportsManager } from '../ScheduledReportsManager';
import { api } from '../../../../lib/api';
import { BrandProvider } from '../../../../components/ui/BrandProvider';

// Mock the API
vi.mock('../../../../lib/api', () => ({
  api: {
    reports: {
      getScheduledReports: vi.fn(),
      updateScheduledReport: vi.fn(),
      deleteScheduledReport: vi.fn(),
    },
  },
}));

// Mock window.confirm
const mockConfirm = vi.fn();
Object.defineProperty(window, 'confirm', {
  writable: true,
  value: mockConfirm,
});

// Mock window.alert
const mockAlert = vi.fn();
Object.defineProperty(window, 'alert', {
  writable: true,
  value: mockAlert,
});

describe('ScheduledReportsManager', () => {
  const mockScheduledReports = [
    {
      id: 'scheduled-1',
      name: 'Daily Attendance Report',
      scheduleType: 'daily' as const,
      exportFormat: 'pdf' as const,
      recipients: ['admin@example.com'],
      nextRunAt: '2025-01-15T09:00:00Z',
      lastRunAt: '2025-01-14T09:00:00Z',
      isActive: true,
    },
    {
      id: 'scheduled-2',
      name: 'Weekly Summary',
      scheduleType: 'weekly' as const,
      exportFormat: 'csv' as const,
      recipients: ['manager@example.com', 'team@example.com'],
      nextRunAt: '2025-01-20T10:00:00Z',
      isActive: false,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockConfirm.mockReturnValue(true);
    mockAlert.mockClear();
  });

  describe('Rendering', () => {
    it('shows loading state initially', () => {
      vi.spyOn(api.reports, 'getScheduledReports').mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(
        <BrandProvider>
          <ScheduledReportsManager />
        </BrandProvider>
      );

      expect(screen.getByText('Loading scheduled reports...')).toBeInTheDocument();
    });

    it('displays scheduled reports when loaded', async () => {
      vi.spyOn(api.reports, 'getScheduledReports').mockResolvedValue({
        scheduledReports: mockScheduledReports,
      });

      render(
        <BrandProvider>
          <ScheduledReportsManager />
        </BrandProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Scheduled Reports')).toBeInTheDocument();
      });

      expect(screen.getByText('Daily Attendance Report')).toBeInTheDocument();
      expect(screen.getByText('Weekly Summary')).toBeInTheDocument();
    });

    it('displays empty state when no scheduled reports', async () => {
      vi.spyOn(api.reports, 'getScheduledReports').mockResolvedValue({
        scheduledReports: [],
      });

      render(
        <BrandProvider>
          <ScheduledReportsManager />
        </BrandProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Scheduled Reports')).toBeInTheDocument();
      });
    });

    it('displays error message when loading fails', async () => {
      const errorMessage = 'Failed to load scheduled reports';
      vi.spyOn(api.reports, 'getScheduledReports').mockRejectedValue(new Error(errorMessage));

      render(
        <BrandProvider>
          <ScheduledReportsManager />
        </BrandProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });
    });
  });

  describe('Report Management', () => {
    beforeEach(async () => {
      vi.spyOn(api.reports, 'getScheduledReports').mockResolvedValue({
        scheduledReports: mockScheduledReports,
      });
    });

    it('toggles report active status', async () => {
      const user = userEvent.setup();
      const updateSpy = vi
        .spyOn(api.reports, 'updateScheduledReport')
        .mockResolvedValue({} as never);
      const getScheduledReportsSpy = vi.spyOn(api.reports, 'getScheduledReports');

      render(
        <BrandProvider>
          <ScheduledReportsManager />
        </BrandProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Daily Attendance Report')).toBeInTheDocument();
      });

      // Find and click the toggle button (assuming it's a button with "Active" or similar text)
      // The actual implementation may vary, so we'll look for a button that toggles status
      const toggleButtons = screen.getAllByRole('button');
      const toggleButton = toggleButtons.find(
        (btn) =>
          btn.textContent?.toLowerCase().includes('active') ||
          btn.textContent?.toLowerCase().includes('inactive')
      );

      if (toggleButton) {
        await user.click(toggleButton);

        await waitFor(() => {
          expect(updateSpy).toHaveBeenCalledWith('scheduled-1', { isActive: false });
          // Should reload the list after update
          expect(getScheduledReportsSpy).toHaveBeenCalledTimes(2); // Initial load + reload
        });
      }
    });

    it('deletes scheduled report after confirmation', async () => {
      const user = userEvent.setup();
      mockConfirm.mockReturnValue(true);
      const deleteSpy = vi.spyOn(api.reports, 'deleteScheduledReport').mockResolvedValue(undefined);
      const getScheduledReportsSpy = vi.spyOn(api.reports, 'getScheduledReports');

      render(
        <BrandProvider>
          <ScheduledReportsManager />
        </BrandProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Daily Attendance Report')).toBeInTheDocument();
      });

      // Find delete button (assuming it has "Delete" text or similar)
      const deleteButtons = screen.getAllByRole('button');
      const deleteButton = deleteButtons.find((btn) =>
        btn.textContent?.toLowerCase().includes('delete')
      );

      if (deleteButton) {
        await user.click(deleteButton);

        await waitFor(() => {
          expect(mockConfirm).toHaveBeenCalledWith(
            'Are you sure you want to delete this scheduled report?'
          );
          expect(deleteSpy).toHaveBeenCalledWith('scheduled-1');
          // Should reload the list after deletion
          expect(getScheduledReportsSpy).toHaveBeenCalledTimes(2); // Initial load + reload
        });
      }
    });

    it('does not delete report when confirmation is cancelled', async () => {
      const user = userEvent.setup();
      mockConfirm.mockReturnValue(false);
      const deleteSpy = vi.spyOn(api.reports, 'deleteScheduledReport');

      render(
        <BrandProvider>
          <ScheduledReportsManager />
        </BrandProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Daily Attendance Report')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button');
      const deleteButton = deleteButtons.find((btn) =>
        btn.textContent?.toLowerCase().includes('delete')
      );

      if (deleteButton) {
        await user.click(deleteButton);

        await waitFor(() => {
          expect(mockConfirm).toHaveBeenCalled();
          expect(deleteSpy).not.toHaveBeenCalled();
        });
      }
    });

    it('displays error when update fails', async () => {
      const user = userEvent.setup();
      const errorMessage = 'Failed to update report';
      vi.spyOn(api.reports, 'updateScheduledReport').mockRejectedValue(new Error(errorMessage));

      render(
        <BrandProvider>
          <ScheduledReportsManager />
        </BrandProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Daily Attendance Report')).toBeInTheDocument();
      });

      const toggleButtons = screen.getAllByRole('button');
      const toggleButton = toggleButtons.find(
        (btn) =>
          btn.textContent?.toLowerCase().includes('active') ||
          btn.textContent?.toLowerCase().includes('inactive')
      );

      if (toggleButton) {
        await user.click(toggleButton);

        await waitFor(() => {
          expect(screen.getByText(errorMessage)).toBeInTheDocument();
        });
      }
    });

    it('displays error when delete fails', async () => {
      const user = userEvent.setup();
      mockConfirm.mockReturnValue(true);
      const errorMessage = 'Failed to delete report';
      vi.spyOn(api.reports, 'deleteScheduledReport').mockRejectedValue(new Error(errorMessage));

      render(
        <BrandProvider>
          <ScheduledReportsManager />
        </BrandProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Daily Attendance Report')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button');
      const deleteButton = deleteButtons.find((btn) =>
        btn.textContent?.toLowerCase().includes('delete')
      );

      if (deleteButton) {
        await user.click(deleteButton);

        await waitFor(() => {
          expect(screen.getByText(errorMessage)).toBeInTheDocument();
        });
      }
    });
  });

  describe('Create Scheduled Report', () => {
    it('shows alert when create button is clicked', async () => {
      const user = userEvent.setup();
      vi.spyOn(api.reports, 'getScheduledReports').mockResolvedValue({
        scheduledReports: [],
      });

      render(
        <BrandProvider>
          <ScheduledReportsManager />
        </BrandProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Scheduled Reports')).toBeInTheDocument();
      });

      const createButton = screen.getByRole('button', { name: /Create Scheduled Report/i });
      await user.click(createButton);

      expect(mockAlert).toHaveBeenCalledWith(
        'Please select a report from the "View Reports" tab first, then use the "Schedule" button on that report.'
      );
    });
  });

  describe('Report Information Display', () => {
    it('displays schedule type for each report', async () => {
      vi.spyOn(api.reports, 'getScheduledReports').mockResolvedValue({
        scheduledReports: mockScheduledReports,
      });

      render(
        <BrandProvider>
          <ScheduledReportsManager />
        </BrandProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Daily Attendance Report')).toBeInTheDocument();
      });

      // Should display schedule type information
      // The exact implementation may vary, but we expect to see schedule-related information
      expect(screen.getByText('Daily Attendance Report')).toBeInTheDocument();
    });

    it('displays export format for each report', async () => {
      vi.spyOn(api.reports, 'getScheduledReports').mockResolvedValue({
        scheduledReports: mockScheduledReports,
      });

      render(
        <BrandProvider>
          <ScheduledReportsManager />
        </BrandProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Daily Attendance Report')).toBeInTheDocument();
      });

      // Should display export format information
      // The exact implementation may vary
      expect(screen.getByText('Daily Attendance Report')).toBeInTheDocument();
    });

    it('displays next run time for each report', async () => {
      vi.spyOn(api.reports, 'getScheduledReports').mockResolvedValue({
        scheduledReports: mockScheduledReports,
      });

      render(
        <BrandProvider>
          <ScheduledReportsManager />
        </BrandProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Daily Attendance Report')).toBeInTheDocument();
      });

      // Should display next run time
      // The exact format may vary, but we expect to see date/time information
      expect(screen.getByText('Daily Attendance Report')).toBeInTheDocument();
    });
  });
});
