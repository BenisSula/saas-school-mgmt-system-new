import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, it, expect } from 'vitest';
import StudentFeesPage from '../pages/student/StudentFeesPage';
import AdminInvoicePage from '../pages/AdminInvoicePage';
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

  it('allows admin to add invoice items', () => {
    renderWithDashboard(<AdminInvoicePage />);
    expect(screen.getByText(/Invoice Generation/i)).toBeInTheDocument();
    const addItemButton = screen.getByRole('button', { name: /Add Item/i });
    fireEvent.click(addItemButton);
    const textInputs = screen.getAllByPlaceholderText(/Description/i);
    expect(textInputs.length).toBeGreaterThan(1);
  });
});
