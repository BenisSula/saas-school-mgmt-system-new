import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SystemAlerts } from '../components/admin/SystemAlerts';

describe('SystemAlerts', () => {
  it('renders nothing when no alerts are provided', () => {
    const { container } = render(<SystemAlerts />);
    expect(container.firstChild).toBeNull();
  });

  it('renders custom alerts', () => {
    const alerts = [
      {
        id: 'custom-1',
        type: 'error' as const,
        title: 'Custom Error',
        message: 'This is a custom error message',
      },
    ];

    render(<SystemAlerts alerts={alerts} />);

    expect(screen.getByText(/System Alerts/i)).toBeInTheDocument();
    // Use getAllByText since StatusBanner may render title in multiple places
    const customErrorElements = screen.getAllByText(/Custom Error/i);
    expect(customErrorElements.length).toBeGreaterThan(0);
    expect(screen.getByText(/This is a custom error message/i)).toBeInTheDocument();
  });

  it('renders expired passwords alert when showExpiredPasswords is true', () => {
    render(<SystemAlerts showExpiredPasswords={true} />);

    expect(screen.getByText(/System Alerts/i)).toBeInTheDocument();
    // Use getAllByText since StatusBanner may render title in multiple places
    const expiredPasswordElements = screen.getAllByText(/Expired Passwords/i);
    expect(expiredPasswordElements.length).toBeGreaterThan(0);
    expect(screen.getByText(/Some users have expired passwords/i)).toBeInTheDocument();
  });

  it('renders unauthorized attempts alert when showUnauthorizedAttempts is true', () => {
    render(<SystemAlerts showUnauthorizedAttempts={true} />);

    expect(screen.getByText(/Unauthorized Login Attempts/i)).toBeInTheDocument();
    expect(screen.getByText(/Multiple failed login attempts detected/i)).toBeInTheDocument();
  });

  it('renders tenant errors alert when showTenantErrors is true', () => {
    render(<SystemAlerts showTenantErrors={true} />);

    expect(screen.getByText(/Tenant Errors/i)).toBeInTheDocument();
    expect(screen.getByText(/Some tenant operations are failing/i)).toBeInTheDocument();
  });

  it('renders sync failures alert when showSyncFailures is true', () => {
    render(<SystemAlerts showSyncFailures={true} />);

    // Use getAllByText since StatusBanner may render title in multiple places
    const syncFailureElements = screen.getAllByText(/Sync Failures/i);
    expect(syncFailureElements.length).toBeGreaterThan(0);
    expect(screen.getByText(/Data synchronization issues detected/i)).toBeInTheDocument();
  });

  it('renders term warnings alert when showTermWarnings is true', () => {
    render(<SystemAlerts showTermWarnings={true} />);

    // Use getAllByText since StatusBanner may render title in multiple places
    const termWarningElements = screen.getAllByText(/Academic Term/i);
    expect(termWarningElements.length).toBeGreaterThan(0);
    expect(screen.getByText(/Current academic term is ending soon/i)).toBeInTheDocument();
  });

  it('renders multiple alerts when multiple flags are true', () => {
    render(
      <SystemAlerts
        showExpiredPasswords={true}
        showUnauthorizedAttempts={true}
        showTermWarnings={true}
      />
    );

    // Use getAllByText since StatusBanner may render titles in multiple places
    const expiredPasswordElements = screen.getAllByText(/Expired Passwords/i);
    expect(expiredPasswordElements.length).toBeGreaterThan(0);
    expect(screen.getByText(/Unauthorized Login Attempts/i)).toBeInTheDocument();
    const termWarningElements = screen.getAllByText(/Academic Term/i);
    expect(termWarningElements.length).toBeGreaterThan(0);
  });

  it('combines custom alerts with default alerts', () => {
    const customAlerts = [
      {
        id: 'custom-1',
        type: 'info' as const,
        title: 'Custom Info',
        message: 'Custom message',
      },
    ];

    render(<SystemAlerts alerts={customAlerts} showExpiredPasswords={true} />);

    expect(screen.getByText(/Custom Info/i)).toBeInTheDocument();
    // Expired Passwords alert should be present when showExpiredPasswords is true
    // Use getAllByText since StatusBanner may render title in multiple places
    const expiredPasswordElements = screen.getAllByText(/Expired Passwords/i);
    expect(expiredPasswordElements.length).toBeGreaterThan(0);
  });

  it('applies custom className', () => {
    const { container } = render(
      <SystemAlerts showExpiredPasswords={true} className="custom-class" />
    );

    const alertsContainer = container.querySelector('.custom-class');
    expect(alertsContainer).toBeInTheDocument();
  });

  it('renders alerts with correct status types', () => {
    const alerts = [
      {
        id: 'error-alert',
        type: 'error' as const,
        title: 'Error Alert',
        message: 'Error message',
      },
      {
        id: 'warning-alert',
        type: 'warning' as const,
        title: 'Warning Alert',
        message: 'Warning message',
      },
      {
        id: 'info-alert',
        type: 'info' as const,
        title: 'Info Alert',
        message: 'Info message',
      },
    ];

    render(<SystemAlerts alerts={alerts} />);

    expect(screen.getByText(/Error Alert/i)).toBeInTheDocument();
    expect(screen.getByText(/Warning Alert/i)).toBeInTheDocument();
    expect(screen.getByText(/Info Alert/i)).toBeInTheDocument();
  });
});
