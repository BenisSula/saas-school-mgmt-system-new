import React from 'react';
import { StatusBanner } from '../ui/StatusBanner';
import { AlertCircle, Shield, Lock, Calendar, RefreshCw } from 'lucide-react';

export interface SystemAlert {
  id: string;
  type: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  icon?: React.ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
}

export interface SystemAlertsProps {
  alerts?: SystemAlert[];
  showExpiredPasswords?: boolean;
  showUnauthorizedAttempts?: boolean;
  showTenantErrors?: boolean;
  showSyncFailures?: boolean;
  showTermWarnings?: boolean;
  className?: string;
}

export function SystemAlerts({
  alerts = [],
  showExpiredPasswords = false,
  showUnauthorizedAttempts = false,
  showTenantErrors = false,
  showSyncFailures = false,
  showTermWarnings = false,
  className = ''
}: SystemAlertsProps) {
  const defaultAlerts: SystemAlert[] = [];

  // Add default alerts based on props
  if (showExpiredPasswords) {
    defaultAlerts.push({
      id: 'expired-passwords',
      type: 'warning',
      title: 'Expired Passwords',
      message: 'Some users have expired passwords. Please remind them to update their passwords.',
      icon: <Lock className="h-4 w-4" />
    });
  }

  if (showUnauthorizedAttempts) {
    defaultAlerts.push({
      id: 'unauthorized-attempts',
      type: 'error',
      title: 'Unauthorized Login Attempts',
      message: 'Multiple failed login attempts detected. Review security logs.',
      icon: <Shield className="h-4 w-4" />
    });
  }

  if (showTenantErrors) {
    defaultAlerts.push({
      id: 'tenant-errors',
      type: 'error',
      title: 'Tenant Errors',
      message: 'Some tenant operations are failing. Check system logs.',
      icon: <AlertCircle className="h-4 w-4" />
    });
  }

  if (showSyncFailures) {
    defaultAlerts.push({
      id: 'sync-failures',
      type: 'warning',
      title: 'Sync Failures',
      message: 'Data synchronization issues detected. Some data may be out of sync.',
      icon: <RefreshCw className="h-4 w-4" />
    });
  }

  if (showTermWarnings) {
    defaultAlerts.push({
      id: 'term-warnings',
      type: 'info',
      title: 'Academic Term',
      message: 'Current academic term is ending soon. Prepare for next term setup.',
      icon: <Calendar className="h-4 w-4" />
    });
  }

  const allAlerts = [...defaultAlerts, ...alerts];

  if (allAlerts.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <h3 className="text-lg font-semibold text-[var(--brand-surface-contrast)]">System Alerts</h3>
      {allAlerts.map((alert) => (
        <StatusBanner
          key={alert.id}
          status={alert.type === 'warning' ? 'error' : alert.type}
          message={
            <div className="flex items-start gap-2">
              {alert.icon && <span className="mt-0.5">{alert.icon}</span>}
              <div>
                <p className="font-semibold">{alert.title}</p>
                <p className="text-sm">{alert.message}</p>
              </div>
            </div>
          }
          onDismiss={alert.dismissible ? alert.onDismiss : undefined}
        />
      ))}
    </div>
  );
}

export default SystemAlerts;

