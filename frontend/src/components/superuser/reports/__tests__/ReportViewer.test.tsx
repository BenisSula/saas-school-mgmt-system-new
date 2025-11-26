import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReportViewer } from '../ReportViewer';
import { api } from '../../../../lib/api';
import { BrandProvider } from '../../../../components/ui/BrandProvider';

// Mock the API
vi.mock('../../../../lib/api', () => ({
  api: {
    reports: {
      executeReport: vi.fn(),
      executeCustomReport: vi.fn(),
      exportReport: vi.fn(),
    },
    getBranding: vi.fn().mockResolvedValue({
      primaryColor: '#000000',
      secondaryColor: '#ffffff',
      logoUrl: null,
    }),
  },
}));

// Mock window.open consistently
const mockWindowOpen = vi.fn();

describe('ReportViewer', () => {
  const defaultProps = {
    reportId: 'report-123',
  };

  beforeAll(() => {
    Object.defineProperty(window, 'open', {
      writable: true,
      configurable: true,
      value: mockWindowOpen,
    });
  });

  afterAll(() => {
    delete (window as { open?: unknown }).open;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockWindowOpen.mockClear();
    // Ensure getBranding is always mocked
    if (typeof api.getBranding === 'function') {
      vi.spyOn(api, 'getBranding').mockResolvedValue({
        primary_color: '#000000',
        secondary_color: '#ffffff',
        logo_url: null,
      });
    }
  });

  describe('Rendering', () => {
    it('shows loading state initially', () => {
      vi.spyOn(api.reports, 'executeReport').mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(
        <BrandProvider>
          <ReportViewer {...defaultProps} />
        </BrandProvider>
      );

      expect(screen.getByText('Loading report...')).toBeInTheDocument();
    });

    it('displays report data when loaded', async () => {
      const mockData = [
        { id: '1', name: 'John Doe', score: 95 },
        { id: '2', name: 'Jane Smith', score: 87 },
      ];
      const mockColumns = [
        { name: 'name', label: 'Name', type: 'string' },
        { name: 'score', label: 'Score', type: 'number' },
      ];

      vi.spyOn(api.reports, 'executeCustomReport').mockRejectedValue(new Error('Not custom'));
      vi.spyOn(api.reports, 'executeReport').mockResolvedValue({
        executionId: 'exec-123',
        data: mockData,
        columns: mockColumns,
        rowCount: mockData.length,
        executionTimeMs: 100,
      });

      render(
        <BrandProvider>
          <ReportViewer {...defaultProps} />
        </BrandProvider>
      );

      // Wait for component to transition from loading to loaded state
      await waitFor(
        () => {
          expect(screen.getByText('Report Results')).toBeInTheDocument();
          expect(screen.queryByText('Loading report...')).not.toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      // Wait for table to render with data
      await waitFor(
        () => {
          // Check for table headers
          const nameHeader = screen.getByText('Name');
          const scoreHeader = screen.getByText('Score');
          expect(nameHeader).toBeInTheDocument();
          expect(scoreHeader).toBeInTheDocument();

          // Verify data is displayed
          expect(screen.getByText('John Doe')).toBeInTheDocument();
          expect(screen.getByText('95')).toBeInTheDocument();
          expect(screen.getByText('Jane Smith')).toBeInTheDocument();
          expect(screen.getByText('87')).toBeInTheDocument();
        },
        { timeout: 5000 }
      );
    });

    it('displays error message when report fails to load', async () => {
      const errorMessage = 'Report not found';
      vi.spyOn(api.reports, 'executeCustomReport').mockRejectedValue(new Error(errorMessage));
      vi.spyOn(api.reports, 'executeReport').mockRejectedValue(new Error(errorMessage));

      render(
        <BrandProvider>
          <ReportViewer {...defaultProps} />
        </BrandProvider>
      );

      await waitFor(
        () => {
          // The error message format is "Report not found: {error message}"
          expect(screen.getByText(/Report not found/i)).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });
  });

  describe('Report Execution', () => {
    it('executes report definition with parameters', async () => {
      const mockData = [{ id: '1', value: 'test' }];
      const mockColumns = [{ name: 'value', label: 'Value', type: 'string' }];

      // Mock custom report to fail first
      vi.spyOn(api.reports, 'executeCustomReport').mockRejectedValue(new Error('Not custom'));

      const executeReportSpy = vi.spyOn(api.reports, 'executeReport').mockResolvedValue({
        executionId: 'exec-123',
        data: mockData,
        columns: mockColumns,
        rowCount: mockData.length,
        executionTimeMs: 100,
      });

      render(
        <BrandProvider>
          <ReportViewer reportId="report-123" parameters={{ filter: 'active' }} />
        </BrandProvider>
      );

      await waitFor(
        () => {
          expect(executeReportSpy).toHaveBeenCalledWith('report-123', { filter: 'active' });
        },
        { timeout: 3000 }
      );
    });

    it('tries custom report first, then falls back to report definition', async () => {
      const mockData = [{ id: '1', value: 'test' }];
      const mockColumns = [{ name: 'value', label: 'Value', type: 'string' }];

      const executeCustomReportSpy = vi
        .spyOn(api.reports, 'executeCustomReport')
        .mockRejectedValue(new Error('Not a custom report'));

      const executeReportSpy = vi.spyOn(api.reports, 'executeReport').mockResolvedValue({
        executionId: 'exec-123',
        data: mockData,
        columns: mockColumns,
        rowCount: mockData.length,
        executionTimeMs: 100,
      });

      render(
        <BrandProvider>
          <ReportViewer {...defaultProps} />
        </BrandProvider>
      );

      await waitFor(() => {
        expect(executeCustomReportSpy).toHaveBeenCalledWith('report-123');
        expect(executeReportSpy).toHaveBeenCalledWith('report-123', {});
      });
    });

    it('uses custom report result when available', async () => {
      const mockData = [{ id: '1', value: 'custom' }];
      const mockColumns = [{ name: 'value', label: 'Value', type: 'string' }];

      const executeCustomReportSpy = vi
        .spyOn(api.reports, 'executeCustomReport')
        .mockResolvedValue({
          executionId: 'custom-exec-123',
          data: mockData,
          columns: mockColumns,
          rowCount: mockData.length,
          executionTimeMs: 100,
        });

      const executeReportSpy = vi.spyOn(api.reports, 'executeReport');

      render(
        <BrandProvider>
          <ReportViewer {...defaultProps} />
        </BrandProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Report Results')).toBeInTheDocument();
      });

      // Should call executeCustomReport
      expect(executeCustomReportSpy).toHaveBeenCalledWith('report-123');
      // Should not call executeReport if custom report succeeds
      expect(executeReportSpy).not.toHaveBeenCalled();
    });
  });

  describe('Export Functionality', () => {
    beforeEach(async () => {
      const mockData = [{ id: '1', name: 'Test' }];
      const mockColumns = [{ name: 'name', label: 'Name', type: 'string' }];

      // Mock both custom and regular report execution
      vi.spyOn(api.reports, 'executeCustomReport').mockRejectedValue(new Error('Not custom'));
      vi.spyOn(api.reports, 'executeReport').mockResolvedValue({
        executionId: 'exec-123',
        data: mockData,
        columns: mockColumns,
        rowCount: mockData.length,
        executionTimeMs: 100,
      });
    });

    it('exports report as CSV', async () => {
      const user = userEvent.setup();
      const exportSpy = vi
        .spyOn(api.reports, 'exportReport')
        .mockResolvedValue({ url: 'https://example.com/export.csv', expiresAt: '2025-01-01' });

      render(
        <BrandProvider>
          <ReportViewer {...defaultProps} />
        </BrandProvider>
      );

      // Wait for component to fully load - ensure async state transition is complete
      await waitFor(
        () => {
          expect(screen.getByText('Report Results')).toBeInTheDocument();
          expect(screen.queryByText('Loading report...')).not.toBeInTheDocument();
          expect(screen.queryByText(/Failed to load|error/i)).not.toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      // Wait for export buttons to be available - ensure component has fully rendered
      await waitFor(
        () => {
          const buttons = screen.getAllByRole('button');
          const exportButtons = buttons.filter((btn) =>
            /Export (CSV|PDF|Excel)/i.test(btn.textContent || '')
          );
          expect(exportButtons.length).toBeGreaterThan(0);
        },
        { timeout: 5000 }
      );

      const csvButton = screen.getByRole('button', { name: /Export CSV/i });
      await user.click(csvButton);

      await waitFor(() => {
        expect(exportSpy).toHaveBeenCalledWith('exec-123', 'csv');
        expect(mockWindowOpen).toHaveBeenCalledWith('https://example.com/export.csv', '_blank');
      });
    });

    it('exports report as PDF', async () => {
      const user = userEvent.setup();
      const exportSpy = vi
        .spyOn(api.reports, 'exportReport')
        .mockResolvedValue({ url: 'https://example.com/export.pdf', expiresAt: '2025-01-01' });

      render(
        <BrandProvider>
          <ReportViewer {...defaultProps} />
        </BrandProvider>
      );

      await waitFor(
        () => {
          expect(screen.getByText('Report Results')).toBeInTheDocument();
          expect(screen.queryByText('Loading report...')).not.toBeInTheDocument();
          expect(screen.queryByText(/Failed to load|error/i)).not.toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      await waitFor(
        () => {
          const buttons = screen.getAllByRole('button');
          const exportButtons = buttons.filter((btn) =>
            /Export (CSV|PDF|Excel)/i.test(btn.textContent || '')
          );
          expect(exportButtons.length).toBeGreaterThan(0);
        },
        { timeout: 5000 }
      );

      const pdfButton = screen.getByRole('button', { name: /Export PDF/i });
      await user.click(pdfButton);

      await waitFor(() => {
        expect(exportSpy).toHaveBeenCalledWith('exec-123', 'pdf');
        expect(mockWindowOpen).toHaveBeenCalledWith('https://example.com/export.pdf', '_blank');
      });
    });

    it('exports report as Excel', async () => {
      const user = userEvent.setup();
      const exportSpy = vi
        .spyOn(api.reports, 'exportReport')
        .mockResolvedValue({ url: 'https://example.com/export.xlsx', expiresAt: '2025-01-01' });

      render(
        <BrandProvider>
          <ReportViewer {...defaultProps} />
        </BrandProvider>
      );

      await waitFor(
        () => {
          expect(screen.getByText('Report Results')).toBeInTheDocument();
          expect(screen.queryByText('Loading report...')).not.toBeInTheDocument();
          expect(screen.queryByText(/Failed to load|error/i)).not.toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      await waitFor(
        () => {
          const buttons = screen.getAllByRole('button');
          const exportButtons = buttons.filter((btn) =>
            /Export (CSV|PDF|Excel)/i.test(btn.textContent || '')
          );
          expect(exportButtons.length).toBeGreaterThan(0);
        },
        { timeout: 5000 }
      );

      const excelButton = screen.getByRole('button', { name: /Export Excel/i });
      await user.click(excelButton);

      await waitFor(() => {
        expect(exportSpy).toHaveBeenCalledWith('exec-123', 'excel');
        expect(mockWindowOpen).toHaveBeenCalledWith('https://example.com/export.xlsx', '_blank');
      });
    });

    // Note: JSON export button is not in the component, only CSV, PDF, and Excel

    it('disables export buttons when exporting', async () => {
      const user = userEvent.setup();
      let resolveExport: (value: { url: string; expiresAt: string }) => void;
      const exportPromise = new Promise<{ url: string; expiresAt: string }>((resolve) => {
        resolveExport = resolve;
      });

      vi.spyOn(api.reports, 'exportReport').mockReturnValue(exportPromise);

      render(
        <BrandProvider>
          <ReportViewer {...defaultProps} />
        </BrandProvider>
      );

      // Wait for component to fully load - ensure async state transition is complete
      await waitFor(
        () => {
          expect(screen.getByText('Report Results')).toBeInTheDocument();
          expect(screen.queryByText('Loading report...')).not.toBeInTheDocument();
          expect(screen.queryByText(/Failed to load|error/i)).not.toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      // Wait for export buttons to be available - ensure component has fully rendered
      await waitFor(
        () => {
          const buttons = screen.getAllByRole('button');
          const exportButtons = buttons.filter((btn) =>
            /Export (CSV|PDF|Excel)/i.test(btn.textContent || '')
          );
          expect(exportButtons.length).toBeGreaterThan(0);
        },
        { timeout: 5000 }
      );

      const csvButton = screen.getByRole('button', { name: /Export CSV/i });
      await user.click(csvButton);

      // Button should be disabled during export
      await waitFor(() => {
        expect(csvButton).toBeDisabled();
      });

      // Resolve the export
      resolveExport!({ url: 'https://example.com/export.csv', expiresAt: '2025-01-01' });
      await waitFor(() => {
        expect(csvButton).not.toBeDisabled();
      });
    });

    it('displays error when export fails', async () => {
      const user = userEvent.setup();
      const errorMessage = 'Export failed';
      vi.spyOn(api.reports, 'exportReport').mockRejectedValue(new Error(errorMessage));

      render(
        <BrandProvider>
          <ReportViewer {...defaultProps} />
        </BrandProvider>
      );

      // Wait for component to fully load - ensure async state transition is complete
      await waitFor(
        () => {
          expect(screen.getByText('Report Results')).toBeInTheDocument();
          expect(screen.queryByText('Loading report...')).not.toBeInTheDocument();
          expect(screen.queryByText(/Failed to load|error/i)).not.toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      // Wait for export buttons to be available - ensure component has fully rendered
      await waitFor(
        () => {
          const buttons = screen.getAllByRole('button');
          const exportButtons = buttons.filter((btn) =>
            /Export (CSV|PDF|Excel)/i.test(btn.textContent || '')
          );
          expect(exportButtons.length).toBeGreaterThan(0);
        },
        { timeout: 5000 }
      );

      const csvButton = screen.getByRole('button', { name: /Export CSV/i });
      await user.click(csvButton);

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });
    });

    it('does not export when executionId is not available', async () => {
      const user = userEvent.setup();
      // Mock a report execution that doesn't return executionId
      vi.spyOn(api.reports, 'executeCustomReport').mockRejectedValue(new Error('Not custom'));
      vi.spyOn(api.reports, 'executeReport').mockResolvedValue({
        executionId: null as unknown as string,
        data: [],
        columns: [],
        rowCount: 0,
        executionTimeMs: 0,
      });

      const exportSpy = vi.spyOn(api.reports, 'exportReport');

      render(
        <BrandProvider>
          <ReportViewer {...defaultProps} />
        </BrandProvider>
      );

      // Wait for component to fully load - ensure async state transition is complete
      await waitFor(
        () => {
          expect(screen.getByText('Report Results')).toBeInTheDocument();
          expect(screen.queryByText('Loading report...')).not.toBeInTheDocument();
          expect(screen.queryByText(/Failed to load|error/i)).not.toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      // Wait for export buttons to be available - ensure component has fully rendered
      await waitFor(
        () => {
          const buttons = screen.getAllByRole('button');
          const exportButtons = buttons.filter((btn) =>
            /Export (CSV|PDF|Excel)/i.test(btn.textContent || '')
          );
          expect(exportButtons.length).toBeGreaterThan(0);
        },
        { timeout: 5000 }
      );

      const csvButton = screen.getByRole('button', { name: /Export CSV/i });
      await user.click(csvButton);

      // Should not call export if executionId is null
      // Wait a bit to ensure the function has time to check executionId
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(exportSpy).not.toHaveBeenCalled();
    });
  });

  describe('Data Display', () => {
    it('renders table with report data', async () => {
      const mockData = [
        { id: '1', name: 'John Doe', age: 25 },
        { id: '2', name: 'Jane Smith', age: 30 },
      ];
      const mockColumns = [
        { name: 'name', label: 'Name', type: 'string' },
        { name: 'age', label: 'Age', type: 'number' },
      ];

      vi.spyOn(api.reports, 'executeCustomReport').mockRejectedValue(new Error('Not custom'));
      vi.spyOn(api.reports, 'executeReport').mockResolvedValue({
        executionId: 'exec-123',
        data: mockData,
        columns: mockColumns,
        rowCount: mockData.length,
        executionTimeMs: 100,
      });

      render(
        <BrandProvider>
          <ReportViewer {...defaultProps} />
        </BrandProvider>
      );

      // Wait for component to fully load
      await waitFor(
        () => {
          expect(screen.getByText('Report Results')).toBeInTheDocument();
          expect(screen.queryByText('Loading report...')).not.toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      // Wait for table to render with headers and data
      await waitFor(
        () => {
          // Check for table headers
          expect(screen.getByText('Name')).toBeInTheDocument();
          expect(screen.getByText('Age')).toBeInTheDocument();

          // Check for table data - the component renders data as strings in table cells
          const table = screen.getByRole('table');
          expect(table).toBeInTheDocument();

          // Check for data values in the table
          expect(screen.getByText('John Doe')).toBeInTheDocument();
          expect(screen.getByText('25')).toBeInTheDocument();
          expect(screen.getByText('Jane Smith')).toBeInTheDocument();
          expect(screen.getByText('30')).toBeInTheDocument();
        },
        { timeout: 5000 }
      );
    });

    it('handles empty report data', async () => {
      vi.spyOn(api.reports, 'executeCustomReport').mockRejectedValue(new Error('Not custom'));
      vi.spyOn(api.reports, 'executeReport').mockResolvedValue({
        executionId: 'exec-123',
        data: [],
        columns: [],
        rowCount: 0,
        executionTimeMs: 0,
      });

      render(
        <BrandProvider>
          <ReportViewer {...defaultProps} />
        </BrandProvider>
      );

      await waitFor(
        () => {
          expect(screen.getByText('Report Results')).toBeInTheDocument();
          expect(screen.queryByText('Loading report...')).not.toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      // When data is empty and columns are empty, check for the component rendering
      await waitFor(
        () => {
          // The component should render, even with empty data
          expect(screen.getByText('Total rows: 0')).toBeInTheDocument();
        },
        { timeout: 5000 }
      );
    });
  });
});
