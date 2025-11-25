import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ScheduleReportModal } from '../ScheduleReportModal';
import { api } from '../../../../lib/api';
import { BrandProvider } from '../../../../components/ui/BrandProvider';

// Mock the API
vi.mock('../../../../lib/api', () => ({
  api: {
    reports: {
      createScheduledReport: vi.fn(),
    },
  },
}));

describe('ScheduleReportModal', () => {
  const defaultProps = {
    reportId: 'report-123',
    reportName: 'Test Report',
    isOpen: true,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders modal when isOpen is true', () => {
      render(
        <BrandProvider>
          <ScheduleReportModal {...defaultProps} />
        </BrandProvider>
      );

      expect(screen.getByText('Schedule Report')).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Enter schedule name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Select schedule type/i)).toBeInTheDocument();
    });

    it('does not render modal when isOpen is false', () => {
      render(
        <BrandProvider>
          <ScheduleReportModal {...defaultProps} isOpen={false} />
        </BrandProvider>
      );

      expect(screen.queryByText('Schedule Report')).not.toBeInTheDocument();
    });

    it('displays report name in schedule name field', async () => {
      render(
        <BrandProvider>
          <ScheduleReportModal {...defaultProps} reportName="Student Attendance Report" />
        </BrandProvider>
      );

      const nameInput = screen.getByPlaceholderText(/Enter schedule name/i) as HTMLInputElement;
      await waitFor(() => {
        expect(nameInput.value).toBe('Student Attendance Report - Scheduled');
      });
    });

    it('renders all schedule type options', () => {
      render(
        <BrandProvider>
          <ScheduleReportModal {...defaultProps} />
        </BrandProvider>
      );

      const scheduleTypeSelect = screen.getByLabelText(
        /Select schedule type/i
      ) as HTMLSelectElement;
      expect(scheduleTypeSelect.value).toBe('daily');

      const options = Array.from(scheduleTypeSelect.options).map((opt) => opt.value);
      expect(options).toContain('daily');
      expect(options).toContain('weekly');
      expect(options).toContain('monthly');
      expect(options).toContain('custom');
    });

    it('renders all export format options', () => {
      render(
        <BrandProvider>
          <ScheduleReportModal {...defaultProps} />
        </BrandProvider>
      );

      const exportFormatSelect = screen.getByLabelText(
        /Select export format/i
      ) as HTMLSelectElement;
      const options = Array.from(exportFormatSelect.options).map((opt) => opt.value);
      expect(options).toContain('pdf');
      expect(options).toContain('csv');
      expect(options).toContain('excel');
      expect(options).toContain('json');
    });
  });

  describe('Schedule Type Configuration', () => {
    it('shows time input for daily schedule', () => {
      render(
        <BrandProvider>
          <ScheduleReportModal {...defaultProps} />
        </BrandProvider>
      );

      expect(screen.getByLabelText(/Time for daily schedule/i)).toBeInTheDocument();
      expect(screen.queryByText(/Day of Week/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Day of Month/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Cron Expression/i)).not.toBeInTheDocument();
    });

    it('shows day of week and time for weekly schedule', async () => {
      const user = userEvent.setup();
      render(
        <BrandProvider>
          <ScheduleReportModal {...defaultProps} />
        </BrandProvider>
      );

      const scheduleTypeSelect = screen.getByLabelText(/Select schedule type/i);
      await user.selectOptions(scheduleTypeSelect, 'weekly');

      expect(screen.getByText(/Day of Week/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Time for weekly schedule/i)).toBeInTheDocument();
      expect(screen.queryByLabelText(/Day of Month/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/Cron Expression/i)).not.toBeInTheDocument();
    });

    it('shows day of month and time for monthly schedule', async () => {
      const user = userEvent.setup();
      render(
        <BrandProvider>
          <ScheduleReportModal {...defaultProps} />
        </BrandProvider>
      );

      const scheduleTypeSelect = screen.getByLabelText(/Select schedule type/i);
      await user.selectOptions(scheduleTypeSelect, 'monthly');

      expect(screen.getByText(/Day of Month/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Time for monthly schedule/i)).toBeInTheDocument();
      expect(screen.queryByLabelText(/Day of Week/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/Cron Expression/i)).not.toBeInTheDocument();
    });

    it('shows cron expression input for custom schedule', async () => {
      const user = userEvent.setup();
      render(
        <BrandProvider>
          <ScheduleReportModal {...defaultProps} />
        </BrandProvider>
      );

      const scheduleTypeSelect = screen.getByLabelText(/Select schedule type/i);
      await user.selectOptions(scheduleTypeSelect, 'custom');

      expect(screen.getByText(/Cron Expression/i)).toBeInTheDocument();
      expect(screen.queryByLabelText(/Time/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/Day of Week/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/Day of Month/i)).not.toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('shows error when name is empty', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <BrandProvider>
          <ScheduleReportModal {...defaultProps} />
        </BrandProvider>
      );

      const nameInput = screen.getByPlaceholderText(/Enter schedule name/i);
      await user.clear(nameInput);

      const recipientsInput = screen.getByPlaceholderText(
        /email1@example.com, email2@example.com/i
      );
      await user.type(recipientsInput, 'test@example.com');

      // Directly submit the form to bypass HTML5 validation
      const form = container.querySelector('form');
      if (form) {
        const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
        form.dispatchEvent(submitEvent);
      }

      await waitFor(() => {
        expect(screen.getByText('Name is required')).toBeInTheDocument();
      });

      expect(api.reports.createScheduledReport).not.toHaveBeenCalled();
    });

    it('shows error when no recipients are provided', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <BrandProvider>
          <ScheduleReportModal {...defaultProps} />
        </BrandProvider>
      );

      // Fill the name field (required by HTML5)
      const nameInput = screen.getByPlaceholderText(/Enter schedule name/i);
      await user.type(nameInput, 'Test Schedule');

      // The recipients field is empty, but HTML5 validation might prevent submission
      // So we'll directly trigger the form's onSubmit handler by submitting the form
      const form = container.querySelector('form');
      if (form) {
        // Create a submit event and dispatch it directly to bypass HTML5 validation
        const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
        form.dispatchEvent(submitEvent);
      }

      // The form should submit and trigger our custom validation
      await waitFor(
        () => {
          expect(screen.getByText(/At least one recipient email is required/i)).toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      expect(api.reports.createScheduledReport).not.toHaveBeenCalled();
    });

    it('shows error for invalid email addresses', async () => {
      const user = userEvent.setup();
      render(
        <BrandProvider>
          <ScheduleReportModal {...defaultProps} />
        </BrandProvider>
      );

      const recipientsInput = screen.getByPlaceholderText(
        /email1@example.com, email2@example.com/i
      );
      await user.clear(recipientsInput);
      await user.type(recipientsInput, 'invalid-email, another-invalid');

      const submitButton = screen.getByRole('button', { name: /Create Schedule/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Invalid email addresses/i)).toBeInTheDocument();
      });

      expect(api.reports.createScheduledReport).not.toHaveBeenCalled();
    });

    it('validates email format correctly', async () => {
      const user = userEvent.setup();
      render(
        <BrandProvider>
          <ScheduleReportModal {...defaultProps} />
        </BrandProvider>
      );

      const recipientsInput = screen.getByPlaceholderText(
        /email1@example.com, email2@example.com/i
      );
      await user.clear(recipientsInput);
      await user.type(recipientsInput, 'valid@example.com, invalid-email');

      const submitButton = screen.getByRole('button', { name: /Create Schedule/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Invalid email addresses/i)).toBeInTheDocument();
      });
    });
  });

  describe('Form Submission', () => {
    it('submits daily schedule with correct payload', async () => {
      const user = userEvent.setup();
      const mockCreateScheduledReport = vi
        .spyOn(api.reports, 'createScheduledReport')
        .mockResolvedValue({ id: 'scheduled-123' });

      render(
        <BrandProvider>
          <ScheduleReportModal {...defaultProps} />
        </BrandProvider>
      );

      const nameInput = screen.getByPlaceholderText(/Enter schedule name/i);
      await user.clear(nameInput);
      await user.type(nameInput, 'Daily Report Schedule');

      const timeInput = screen.getByLabelText(/Time for daily schedule/i);
      await user.clear(timeInput);
      await user.type(timeInput, '14:30');

      const recipientsInput = screen.getByPlaceholderText(
        /email1@example.com, email2@example.com/i
      );
      await user.clear(recipientsInput);
      await user.type(recipientsInput, 'admin@example.com, manager@example.com');

      const submitButton = screen.getByRole('button', { name: /Create Schedule/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockCreateScheduledReport).toHaveBeenCalledWith({
          reportDefinitionId: 'report-123',
          name: 'Daily Report Schedule',
          scheduleType: 'daily',
          scheduleConfig: {
            time: '14:30',
          },
          exportFormat: 'pdf',
          recipients: ['admin@example.com', 'manager@example.com'],
        });
      });

      expect(defaultProps.onSuccess).toHaveBeenCalled();
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('submits weekly schedule with correct payload', async () => {
      const user = userEvent.setup();
      const mockCreateScheduledReport = vi
        .spyOn(api.reports, 'createScheduledReport')
        .mockResolvedValue({ id: 'scheduled-123' });

      render(
        <BrandProvider>
          <ScheduleReportModal {...defaultProps} />
        </BrandProvider>
      );

      const scheduleTypeSelect = screen.getByLabelText(/Select schedule type/i);
      await user.selectOptions(scheduleTypeSelect, 'weekly');

      const dayOfWeekSelect = await screen.findByText(/Day of Week/i).then(() => {
        const label = screen.getByText(/Day of Week/i);
        return label.parentElement?.querySelector('select') as HTMLSelectElement;
      });
      await user.selectOptions(dayOfWeekSelect, '3'); // Wednesday

      const timeInput = screen.getByLabelText(/Time for weekly schedule/i);
      await user.clear(timeInput);
      await user.type(timeInput, '10:00');

      const recipientsInput = screen.getByPlaceholderText(
        /email1@example.com, email2@example.com/i
      );
      await user.clear(recipientsInput);
      await user.type(recipientsInput, 'team@example.com');

      const submitButton = screen.getByRole('button', { name: /Create Schedule/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockCreateScheduledReport).toHaveBeenCalledWith({
          reportDefinitionId: 'report-123',
          name: expect.stringContaining('Scheduled'),
          scheduleType: 'weekly',
          scheduleConfig: {
            dayOfWeek: 3,
            time: '10:00',
          },
          exportFormat: 'pdf',
          recipients: ['team@example.com'],
        });
      });
    });

    it('submits monthly schedule with correct payload', async () => {
      const user = userEvent.setup();
      const mockCreateScheduledReport = vi
        .spyOn(api.reports, 'createScheduledReport')
        .mockResolvedValue({ id: 'scheduled-123' });

      render(
        <BrandProvider>
          <ScheduleReportModal {...defaultProps} />
        </BrandProvider>
      );

      const scheduleTypeSelect = screen.getByLabelText(/Select schedule type/i);
      await user.selectOptions(scheduleTypeSelect, 'monthly');

      const dayOfMonthInput =
        screen.getByLabelText(/Day of month/i) || screen.getByPlaceholderText(/1-31/i);
      await user.clear(dayOfMonthInput);
      await user.type(dayOfMonthInput, '15');

      const timeInput = screen.getByLabelText(/Time for monthly schedule/i);
      await user.clear(timeInput);
      await user.type(timeInput, '09:00');

      const recipientsInput = screen.getByPlaceholderText(
        /email1@example.com, email2@example.com/i
      );
      await user.clear(recipientsInput);
      await user.type(recipientsInput, 'executive@example.com');

      const submitButton = screen.getByRole('button', { name: /Create Schedule/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockCreateScheduledReport).toHaveBeenCalledWith({
          reportDefinitionId: 'report-123',
          name: expect.stringContaining('Scheduled'),
          scheduleType: 'monthly',
          scheduleConfig: {
            dayOfMonth: 15,
            time: '09:00',
          },
          exportFormat: 'pdf',
          recipients: ['executive@example.com'],
        });
      });
    });

    it('submits custom schedule with cron expression', async () => {
      const user = userEvent.setup();
      const mockCreateScheduledReport = vi
        .spyOn(api.reports, 'createScheduledReport')
        .mockResolvedValue({ id: 'scheduled-123' });

      render(
        <BrandProvider>
          <ScheduleReportModal {...defaultProps} />
        </BrandProvider>
      );

      const scheduleTypeSelect = screen.getByLabelText(/Select schedule type/i);
      await user.selectOptions(scheduleTypeSelect, 'custom');

      const cronInput = screen.getByPlaceholderText('0 9 * * *') as HTMLInputElement;
      await user.clear(cronInput);
      await user.type(cronInput, '0 8 * * 1-5'); // 8 AM on weekdays

      const recipientsInput = screen.getByPlaceholderText(
        /email1@example.com, email2@example.com/i
      );
      await user.clear(recipientsInput);
      await user.type(recipientsInput, 'devops@example.com');

      const submitButton = screen.getByRole('button', { name: /Create Schedule/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockCreateScheduledReport).toHaveBeenCalledWith({
          reportDefinitionId: 'report-123',
          name: expect.stringContaining('Scheduled'),
          scheduleType: 'custom',
          scheduleConfig: {
            cron: '0 8 * * 1-5',
          },
          exportFormat: 'pdf',
          recipients: ['devops@example.com'],
        });
      });
    });

    it('submits with selected export format', async () => {
      const user = userEvent.setup();
      const mockCreateScheduledReport = vi
        .spyOn(api.reports, 'createScheduledReport')
        .mockResolvedValue({ id: 'scheduled-123' });

      render(
        <BrandProvider>
          <ScheduleReportModal {...defaultProps} />
        </BrandProvider>
      );

      const exportFormatSelect = screen.getByLabelText(/Select export format/i);
      await user.selectOptions(exportFormatSelect, 'csv');

      const recipientsInput = screen.getByPlaceholderText(
        /email1@example.com, email2@example.com/i
      );
      await user.clear(recipientsInput);
      await user.type(recipientsInput, 'analyst@example.com');

      const submitButton = screen.getByRole('button', { name: /Create Schedule/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockCreateScheduledReport).toHaveBeenCalledWith(
          expect.objectContaining({
            exportFormat: 'csv',
          })
        );
      });
    });

    it('handles multiple recipients with comma separation', async () => {
      const user = userEvent.setup();
      const mockCreateScheduledReport = vi
        .spyOn(api.reports, 'createScheduledReport')
        .mockResolvedValue({ id: 'scheduled-123' });

      render(
        <BrandProvider>
          <ScheduleReportModal {...defaultProps} />
        </BrandProvider>
      );

      const recipientsInput = screen.getByPlaceholderText(
        /email1@example.com, email2@example.com/i
      );
      await user.clear(recipientsInput);
      await user.type(
        recipientsInput,
        'user1@example.com, user2@example.com,  user3@example.com  '
      );

      const submitButton = screen.getByRole('button', { name: /Create Schedule/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockCreateScheduledReport).toHaveBeenCalledWith(
          expect.objectContaining({
            recipients: ['user1@example.com', 'user2@example.com', 'user3@example.com'],
          })
        );
      });
    });
  });

  describe('Error Handling', () => {
    it('displays error message when API call fails', async () => {
      const user = userEvent.setup();
      const errorMessage = 'Failed to create scheduled report';
      vi.spyOn(api.reports, 'createScheduledReport').mockRejectedValue(new Error(errorMessage));

      render(
        <BrandProvider>
          <ScheduleReportModal {...defaultProps} />
        </BrandProvider>
      );

      const recipientsInput = screen.getByPlaceholderText(
        /email1@example.com, email2@example.com/i
      );
      await user.clear(recipientsInput);
      await user.type(recipientsInput, 'test@example.com');

      const submitButton = screen.getByRole('button', { name: /Create Schedule/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });

      expect(defaultProps.onSuccess).not.toHaveBeenCalled();
      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });

    it('displays generic error message for non-Error exceptions', async () => {
      const user = userEvent.setup();
      vi.spyOn(api.reports, 'createScheduledReport').mockRejectedValue('String error');

      render(
        <BrandProvider>
          <ScheduleReportModal {...defaultProps} />
        </BrandProvider>
      );

      const recipientsInput = screen.getByPlaceholderText(
        /email1@example.com, email2@example.com/i
      );
      await user.clear(recipientsInput);
      await user.type(recipientsInput, 'test@example.com');

      const submitButton = screen.getByRole('button', { name: /Create Schedule/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Failed to create scheduled report')).toBeInTheDocument();
      });
    });

    it('shows loading state during submission', async () => {
      const user = userEvent.setup();
      let resolvePromise: (value: { id: string }) => void;
      const promise = new Promise<{ id: string }>((resolve) => {
        resolvePromise = resolve;
      });
      vi.spyOn(api.reports, 'createScheduledReport').mockReturnValue(promise);

      render(
        <BrandProvider>
          <ScheduleReportModal {...defaultProps} />
        </BrandProvider>
      );

      const recipientsInput = screen.getByPlaceholderText(
        /email1@example.com, email2@example.com/i
      );
      await user.clear(recipientsInput);
      await user.type(recipientsInput, 'test@example.com');

      const submitButton = screen.getByRole('button', { name: /Create Schedule/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Creating.../i })).toBeInTheDocument();
      });

      expect(submitButton).toBeDisabled();

      // Resolve the promise
      resolvePromise!({ id: 'scheduled-123' });
      await waitFor(() => {
        expect(defaultProps.onSuccess).toHaveBeenCalled();
      });
    });
  });

  describe('User Interactions', () => {
    it('closes modal when close button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <BrandProvider>
          <ScheduleReportModal {...defaultProps} />
        </BrandProvider>
      );

      const closeButton = screen.getByLabelText('Close');
      await user.click(closeButton);

      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('closes modal when cancel button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <BrandProvider>
          <ScheduleReportModal {...defaultProps} />
        </BrandProvider>
      );

      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      await user.click(cancelButton);

      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('allows editing all form fields', async () => {
      const user = userEvent.setup();
      render(
        <BrandProvider>
          <ScheduleReportModal {...defaultProps} />
        </BrandProvider>
      );

      const nameInput = screen.getByPlaceholderText(/Enter schedule name/i);
      await user.clear(nameInput);
      await user.type(nameInput, 'Custom Schedule Name');
      expect((nameInput as HTMLInputElement).value).toBe('Custom Schedule Name');

      const scheduleTypeSelect = screen.getByLabelText(/Select schedule type/i);
      await user.selectOptions(scheduleTypeSelect, 'weekly');
      expect((scheduleTypeSelect as HTMLSelectElement).value).toBe('weekly');

      const exportFormatSelect = screen.getByLabelText(/Select export format/i);
      await user.selectOptions(exportFormatSelect, 'excel');
      expect((exportFormatSelect as HTMLSelectElement).value).toBe('excel');
    });
  });
});
