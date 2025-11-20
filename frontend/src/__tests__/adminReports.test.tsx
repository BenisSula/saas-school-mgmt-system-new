import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdminReportsPage from '../pages/admin/AdminReportsPage';

describe('AdminReportsPage', () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({})
  });
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => []
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = originalFetch;
  });

  it('runs attendance report with provided filters', async () => {
    render(<AdminReportsPage />);

    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2025-01-01' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2025-01-31' } });
    fireEvent.change(screen.getByLabelText('Class ID'), { target: { value: 'grade-10' } });
    const [attendanceRunButton] = screen.getAllByRole('button', { name: /Run report/i });
    fireEvent.click(attendanceRunButton);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(
          '/reports/attendance?from=2025-01-01&to=2025-01-31&class_id=grade-10'
        ),
        expect.anything()
      )
    );
  });

  it('requests grade and fee reports', async () => {
    render(<AdminReportsPage />);

    // Grade report requires exam ID
    fireEvent.change(screen.getByLabelText('Exam ID'), { target: { value: 'exam-123' } });
    const reportButtons = screen.getAllByRole('button', { name: /Run report/i });
    fireEvent.click(reportButtons[1]);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/reports/grades?exam_id=exam-123'),
        expect.anything()
      )
    );

    // Fee report
    fireEvent.change(screen.getByDisplayValue('All statuses'), { target: { value: 'pending' } });
    fireEvent.click(reportButtons[2]);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/reports/fees?status=pending'),
        expect.anything()
      )
    );
  });
});
