import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, it, expect } from 'vitest';
import StudentFeesPage from '../pages/student/StudentFeesPage';
import AdminInvoicePage from '../pages/admin/InvoicePage';
import { DashboardRouteProvider } from '../context/DashboardRouteContext';

function renderWithDashboard(ui: ReactElement) {
  return render(<DashboardRouteProvider defaultTitle="Test">{ui}</DashboardRouteProvider>);
}

describe('Fee pages', () => {
  it('renders student fee dashboard', () => {
    renderWithDashboard(<StudentFeesPage />);
    expect(screen.getByRole('heading', { level: 1, name: /Fee overview/i })).toBeInTheDocument();
    expect(screen.getByText(/Outstanding Balance/i)).toBeInTheDocument();
    expect(screen.getByText(/Loading invoices…/i)).toBeInTheDocument();
  });

  it('allows admin to add invoice items', async () => {
    renderWithDashboard(<AdminInvoicePage />);
    expect(screen.getByText(/Invoice Generation/i)).toBeInTheDocument();
    // First, open the modal by clicking "Create Invoice"
    const createInvoiceButton = screen.getByRole('button', { name: /Create Invoice/i });
    fireEvent.click(createInvoiceButton);
    // Wait for the modal to appear and find the "Add Item" button
    const addItemButton = await waitFor(() => screen.getByRole('button', { name: /Add Item/i }));
    fireEvent.click(addItemButton);
    // Wait for the new input to appear - check for inputs with "Item" in the label
    await waitFor(() => {
      const textInputs = screen.getAllByLabelText(/Item \d+ Description/i);
      expect(textInputs.length).toBeGreaterThan(1);
    });
  });
});
