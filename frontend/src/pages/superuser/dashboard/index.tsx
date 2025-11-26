import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { RouteMeta } from '../../../components/layout/RouteMeta';
import { DashboardSkeleton } from '../../../components/ui/DashboardSkeleton';
import { StatusBanner } from '../../../components/ui/StatusBanner';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { StatCard } from '../../../components/charts/StatCard';
import { PieChart } from '../../../components/charts/PieChart';
import { BarChart } from '../../../components/charts/BarChart';
import { LineChart } from '../../../components/charts/LineChart';
import { useSuperuserOverview } from '../../../hooks/queries/useSuperuserQueries';
import {
  usePlatformActiveSessions,
  useFailedLoginAttempts,
  useRecentCriticalAuditLogs,
  useTenantBreakdown,
  useDeviceBreakdown,
  useSessionDistribution,
} from '../../../hooks/queries/useDashboardData';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../hooks/useQuery';
import { api } from '../../../lib/api';
import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  Users,
  Activity,
  Shield,
  Key,
  FileText,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  LogIn,
  Smartphone,
  Monitor,
} from 'lucide-react';
import { formatNumber } from '../../../lib/utils/data';
import { formatDate } from '../../../lib/utils/date';
import {
  toPieChartData,
  toBarChartData,
  formatDeviceType,
  formatTenantName,
} from '../../../lib/utils/charts';

interface AlertItem {
  id: string;
  type: 'suspicious_login' | 'multiple_ip' | 'failed_attempts' | 'session_anomaly';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  timestamp: string;
  userId?: string;
  userEmail?: string;
}

export default function SuperuserDashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    data: overview,
    isLoading: overviewLoading,
    error: overviewError,
  } = useSuperuserOverview();

  // Real-time data hooks
  const { data: activeSessionsData, isLoading: sessionsLoading } = usePlatformActiveSessions();
  const { data: failedLoginCount, isLoading: failedLoginsLoading } = useFailedLoginAttempts();
  const { data: criticalAuditLogs } = useRecentCriticalAuditLogs();
  const { data: tenantBreakdown, isLoading: tenantsLoading } = useTenantBreakdown();
  const { data: deviceBreakdown, isLoading: deviceLoading } = useDeviceBreakdown();
  const { data: sessionDistribution, isLoading: distributionLoading } = useSessionDistribution();

  // Fetch recent audit logs for alerts - focus on security-related events
  const { data: auditLogs } = useQuery({
    queryKey: ['superuser', 'dashboard', 'audit-logs'],
    queryFn: async () => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const result = await api.superuser.getPlatformAuditLogs({
        limit: 50,
        severity: 'warning', // Focus on warnings and above
        startDate: oneHourAgo,
      });
      return result.logs;
    },
    enabled: true,
    staleTime: 30000,
    refetchInterval: 60000, // Refetch every minute for real-time alerts
  });

  // Calculate real active sessions count
  const activeSessionsCount = activeSessionsData?.total || 0;

  // Generate alerts from real audit log data
  const alerts: AlertItem[] = useMemo(() => {
    const generatedAlerts: AlertItem[] = [];

    if (!auditLogs || auditLogs.length === 0) {
      return [];
    }

    // Group audit logs by type for analysis
    const failedLoginAttempts = auditLogs.filter(
      (log) =>
        log.action === 'LOGIN_ATTEMPT_FAILED' || log.action?.toLowerCase().includes('login_failed')
    );

    const criticalEvents = auditLogs.filter(
      (log) => log.severity === 'critical' || log.severity === 'error'
    );

    const securityEvents = auditLogs.filter(
      (log) =>
        log.action?.toLowerCase().includes('password') ||
        log.action?.toLowerCase().includes('session') ||
        log.action?.toLowerCase().includes('security') ||
        (log.tags &&
          Array.isArray(log.tags) &&
          log.tags.some((tag: string) => tag.toLowerCase().includes('security')))
    );

    // Alert 1: Multiple failed login attempts
    if (failedLoginAttempts.length >= 5) {
      const uniqueEmails = new Set(
        failedLoginAttempts.map((log) => log.details?.email || log.userEmail).filter(Boolean)
      );

      generatedAlerts.push({
        id: 'alert-failed-logins',
        type: 'failed_attempts',
        severity: failedLoginAttempts.length >= 10 ? 'high' : 'medium',
        title: 'Multiple Failed Login Attempts',
        description: `${failedLoginAttempts.length} failed login attempts detected from ${uniqueEmails.size} ${uniqueEmails.size === 1 ? 'account' : 'accounts'} in the last hour`,
        timestamp: (() => {
          const firstAttempt = failedLoginAttempts[0];
          const ts = firstAttempt?.timestamp || firstAttempt?.createdAt;
          return ts ? (typeof ts === 'string' ? ts : ts.toISOString()) : new Date().toISOString();
        })(),
        userEmail: Array.from(uniqueEmails)[0] as string | undefined,
      });
    }

    // Alert 2: Critical security events
    if (criticalEvents.length > 0) {
      criticalEvents.slice(0, 3).forEach((event, index) => {
        const eventTimestamp = event.timestamp || event.createdAt || new Date().toISOString();
        const eventDetails = event.details || {};
        generatedAlerts.push({
          id: `alert-critical-${index}`,
          type: 'suspicious_login',
          severity: 'critical',
          title: event.action || 'Critical Security Event',
          description: (typeof eventDetails === 'object' && eventDetails !== null
            ? eventDetails.message ||
              eventDetails.reason ||
              'A critical security event has been detected'
            : 'A critical security event has been detected') as string,
          timestamp:
            typeof eventTimestamp === 'string' ? eventTimestamp : eventTimestamp.toISOString(),
          userId: event.userId || undefined,
          userEmail: event.userEmail || undefined,
        });
      });
    }

    // Alert 3: Suspicious activity patterns
    if (securityEvents.length >= 3) {
      const recentSecurityEvents = securityEvents
        .filter((event) => {
          const eventTime = event.timestamp || event.createdAt;
          if (!eventTime) return false;
          const eventDate = typeof eventTime === 'string' ? new Date(eventTime) : eventTime;
          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
          return eventDate > oneHourAgo;
        })
        .slice(0, 5);

      if (recentSecurityEvents.length >= 3) {
        const firstEvent = recentSecurityEvents[0];
        const eventTimestamp =
          firstEvent?.timestamp || firstEvent?.createdAt || new Date().toISOString();
        generatedAlerts.push({
          id: 'alert-security-pattern',
          type: 'session_anomaly',
          severity: 'medium',
          title: 'Unusual Security Activity',
          description: `${recentSecurityEvents.length} security-related events detected in the last hour`,
          timestamp:
            typeof eventTimestamp === 'string' ? eventTimestamp : eventTimestamp.toISOString(),
        });
      }
    }

    // Sort by severity and timestamp (most critical and recent first)
    generatedAlerts.sort((a, b) => {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const severityDiff = (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);
      if (severityDiff !== 0) return severityDiff;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    return generatedAlerts.slice(0, 5); // Limit to 5 most critical/recent
  }, [auditLogs]);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.superuser.overview() });
    queryClient.invalidateQueries({ queryKey: ['superuser', 'dashboard'] });
  };

  // Prepare chart data
  const deviceChartData = useMemo(() => {
    if (!deviceBreakdown) return [];
    return toPieChartData(
      [
        { type: 'mobile', count: deviceBreakdown.mobile },
        { type: 'tablet', count: deviceBreakdown.tablet },
        { type: 'desktop', count: deviceBreakdown.desktop },
        { type: 'unknown', count: deviceBreakdown.unknown },
      ],
      (item) => formatDeviceType(item.type),
      (item) => item.count
    );
  }, [deviceBreakdown]);

  const tenantChartData = useMemo(() => {
    if (!tenantBreakdown) return [];
    const topTenants = [...tenantBreakdown].sort((a, b) => b.userCount - a.userCount).slice(0, 5);
    return toBarChartData(
      topTenants,
      (tenant) => formatTenantName(tenant.name),
      (tenant) => tenant.userCount
    );
  }, [tenantBreakdown]);

  const quickActions = [
    {
      id: 'reset-password',
      label: 'Reset Password',
      icon: <Key className="h-5 w-5" />,
      onClick: () => navigate('/dashboard/superuser/users'),
      description: 'Reset user passwords',
    },
    {
      id: 'manage-sessions',
      label: 'Manage Sessions',
      icon: <Activity className="h-5 w-5" />,
      onClick: () => navigate('/dashboard/superuser/users'),
      description: 'View and revoke user sessions',
    },
    {
      id: 'audit-logs',
      label: 'View Audit Logs',
      icon: <FileText className="h-5 w-5" />,
      onClick: () => navigate('/dashboard/superuser/settings'),
      description: 'Review platform audit logs',
    },
    {
      id: 'security',
      label: 'Security Center',
      icon: <Shield className="h-5 w-5" />,
      onClick: () => navigate('/dashboard/superuser/settings'),
      description: 'Security settings and policies',
    },
  ];

  const getAlertIcon = (severity: AlertItem['severity']) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="h-5 w-5 text-[var(--brand-error)]" />;
      case 'high':
        return <AlertCircle className="h-5 w-5 text-[var(--brand-error)]" />;
      case 'medium':
        return <AlertCircle className="h-5 w-5 text-[var(--brand-warning)]" />;
      default:
        return <AlertCircle className="h-5 w-5 text-[var(--brand-info)]" />;
    }
  };

  const getAlertBadgeColor = (severity: AlertItem['severity']) => {
    switch (severity) {
      case 'critical':
        return 'bg-[var(--brand-error)]/20 text-[var(--brand-error)] border-[var(--brand-error)]/30';
      case 'high':
        return 'bg-[var(--brand-error)]/20 text-[var(--brand-error)] border-[var(--brand-error)]/30';
      case 'medium':
        return 'bg-[var(--brand-warning)]/20 text-[var(--brand-warning)] border-[var(--brand-warning)]/30';
      default:
        return 'bg-[var(--brand-info)]/20 text-[var(--brand-info)] border-[var(--brand-info)]/30';
    }
  };

  const isLoading =
    overviewLoading ||
    sessionsLoading ||
    failedLoginsLoading ||
    tenantsLoading ||
    deviceLoading ||
    distributionLoading;

  if (isLoading) {
    return (
      <RouteMeta title="Superuser Dashboard">
        <DashboardSkeleton />
      </RouteMeta>
    );
  }

  if (overviewError) {
    return (
      <RouteMeta title="Superuser Dashboard">
        <StatusBanner status="error" message={(overviewError as Error).message} />
      </RouteMeta>
    );
  }

  if (!overview) {
    return (
      <RouteMeta title="Superuser Dashboard">
        <StatusBanner status="info" message="No platform data available yet." />
      </RouteMeta>
    );
  }

  return (
    <RouteMeta title="Superuser Dashboard">
      <div className="space-section">
        {/* Page Header */}
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-heading-2 text-[var(--brand-text-primary)]">Superuser Dashboard</h1>
            <p className="mt-2 text-body-small text-[var(--brand-text-secondary)]">
              Platform-wide insights, quick actions, and security alerts
            </p>
          </div>
          <Button onClick={handleRefresh}>Refresh</Button>
        </header>

        {/* System Overview Stats */}
        <section className="mb-8" aria-label="System Overview">
          <h2 className="mb-4 text-lg font-semibold text-[var(--brand-surface-contrast)]">
            System Overview
          </h2>
          <div className="grid-enterprise-4 grid gap-4 sm:gap-6">
            <StatCard
              title="Total Tenants"
              value={formatNumber(overview.totals.schools)}
              description={`${overview.totals.activeSchools} active`}
              icon={<Building2 className="h-5 w-5" />}
            />
            <StatCard
              title="Total Users"
              value={formatNumber(overview.totals.users)}
              description={`${overview.roleDistribution.admins} admins • ${overview.roleDistribution.teachers} teachers`}
              icon={<Users className="h-5 w-5" />}
            />
            <StatCard
              title="Active Sessions"
              value={formatNumber(activeSessionsCount)}
              description="Currently logged in"
              icon={<Activity className="h-5 w-5" />}
            />
            <StatCard
              title="Failed Logins (24h)"
              value={formatNumber(failedLoginCount || 0)}
              description="Failed login attempts"
              icon={<LogIn className="h-5 w-5" />}
            />
          </div>
        </section>

        {/* Additional Metrics Row */}
        <section className="mb-8" aria-label="Additional Metrics">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Pending Approvals"
              value={formatNumber(overview.totals.pendingUsers)}
              description="Users awaiting activation"
              icon={<AlertCircle className="h-5 w-5" />}
            />
            <StatCard
              title="Critical Events (1h)"
              value={formatNumber(criticalAuditLogs?.length || 0)}
              description="Security & authentication"
              icon={<Shield className="h-5 w-5" />}
            />
            <StatCard
              title="Mobile Sessions"
              value={formatNumber(deviceBreakdown?.mobile || 0)}
              description={(() => {
                if (!deviceBreakdown) return '0% of active';
                const total =
                  deviceBreakdown.mobile +
                  deviceBreakdown.tablet +
                  deviceBreakdown.desktop +
                  deviceBreakdown.unknown;
                const percentage =
                  total > 0 ? Math.round((deviceBreakdown.mobile / total) * 100) : 0;
                return `${percentage}% of active`;
              })()}
              icon={<Smartphone className="h-5 w-5" />}
            />
            <StatCard
              title="Desktop Sessions"
              value={formatNumber(deviceBreakdown?.desktop || 0)}
              description={(() => {
                if (!deviceBreakdown) return '0% of active';
                const total =
                  deviceBreakdown.mobile +
                  deviceBreakdown.tablet +
                  deviceBreakdown.desktop +
                  deviceBreakdown.unknown;
                const percentage =
                  total > 0 ? Math.round((deviceBreakdown.desktop / total) * 100) : 0;
                return `${percentage}% of active`;
              })()}
              icon={<Monitor className="h-5 w-5" />}
            />
          </div>
        </section>

        {/* Charts Section */}
        <section className="mb-8 grid gap-6 lg:grid-cols-2" aria-label="Analytics Charts">
          {/* Device Breakdown */}
          <Card padding="md">
            <PieChart
              data={deviceChartData}
              title="Device Breakdown"
              size={200}
              showLegend={true}
            />
          </Card>

          {/* Session Distribution */}
          <Card padding="md">
            <LineChart
              data={sessionDistribution || []}
              title="Session Distribution (Last 24 Hours)"
              height={200}
              showDots={true}
            />
          </Card>

          {/* Tenant Breakdown */}
          {tenantChartData.length > 0 && (
            <Card padding="md">
              <BarChart
                data={tenantChartData}
                title="Top Tenants by User Count"
                height={200}
                showValues={true}
              />
            </Card>
          )}

          {/* Recent Critical Audit Tags */}
          <Card padding="md">
            <h3 className="mb-4 text-sm font-semibold text-[var(--brand-text-primary)]">
              Recent Critical Audit Events
            </h3>
            {criticalAuditLogs && criticalAuditLogs.length > 0 ? (
              <div className="space-y-3">
                {criticalAuditLogs.slice(0, 5).map((log, index) => (
                  <div
                    key={log.id || index}
                    className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface-secondary)] p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-[var(--brand-text-primary)]">
                          {log.action || 'Unknown Action'}
                        </p>
                        {log.tags && log.tags.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {log.tags.slice(0, 3).map((tag, tagIndex) => (
                              <span
                                key={tagIndex}
                                className="rounded-full bg-[var(--brand-primary)]/20 px-2 py-0.5 text-xs text-[var(--brand-primary)]"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                        <p className="mt-1 text-xs text-[var(--brand-text-secondary)]">
                          {(() => {
                            const dateValue = log.createdAt || log.timestamp;
                            if (!dateValue) return formatDate(new Date().toISOString());
                            if (typeof dateValue === 'string') return formatDate(dateValue);
                            if (dateValue instanceof Date)
                              return formatDate(dateValue.toISOString());
                            return formatDate(new Date().toISOString());
                          })()}
                        </p>
                      </div>
                      <span className="rounded-full bg-[var(--brand-error)]/20 px-2 py-1 text-xs font-medium text-[var(--brand-error)]">
                        {log.severity || 'critical'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckCircle2 className="mb-2 h-8 w-8 text-[var(--brand-success)]" />
                <p className="text-sm text-[var(--brand-text-secondary)]">
                  No critical events in the last hour
                </p>
              </div>
            )}
          </Card>
        </section>

        {/* Quick Actions */}
        <section className="mb-8" aria-label="Quick Actions">
          <h2 className="mb-4 text-lg font-semibold text-[var(--brand-surface-contrast)]">
            Quick Actions
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {quickActions.map((action) => (
              <Card
                key={action.id}
                onClick={action.onClick}
                padding="md"
                className="transition-all hover:shadow-md"
              >
                <div className="flex flex-col items-start gap-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-[var(--brand-primary)]/10 p-2 text-[var(--brand-primary)]">
                      {action.icon}
                    </div>
                    <h3 className="font-semibold text-[var(--brand-surface-contrast)]">
                      {action.label}
                    </h3>
                  </div>
                  <p className="text-sm text-[var(--brand-text-secondary)]">{action.description}</p>
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* Alerts Section */}
        <section aria-label="Security Alerts">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[var(--brand-surface-contrast)]">
              Security Alerts
            </h2>
            {alerts.length > 0 && (
              <span className="rounded-full bg-[var(--brand-error)]/20 px-3 py-1 text-xs font-medium text-[var(--brand-error)]">
                {alerts.length} {alerts.length === 1 ? 'alert' : 'alerts'}
              </span>
            )}
          </div>

          {alerts.length === 0 ? (
            <Card padding="md">
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckCircle2 className="mb-3 h-12 w-12 text-[var(--brand-success)]" />
                <p className="font-medium text-[var(--brand-surface-contrast)]">No Active Alerts</p>
                <p className="mt-1 text-sm text-[var(--brand-text-secondary)]">
                  All systems operating normally
                </p>
              </div>
            </Card>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert) => {
                const borderColorClass =
                  alert.severity === 'critical' || alert.severity === 'high'
                    ? 'border-l-[var(--brand-error)]'
                    : alert.severity === 'medium'
                      ? 'border-l-[var(--brand-warning)]'
                      : 'border-l-[var(--brand-info)]';

                return (
                  <div
                    key={alert.id}
                    className={`card-enterprise border-l-4 p-6 sm:p-8 transition-all hover:shadow-sm ${borderColorClass}`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="mt-0.5">{getAlertIcon(alert.severity)}</div>
                      <div className="flex-1">
                        <div className="mb-2 flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <h3 className="font-semibold text-[var(--brand-surface-contrast)]">
                              {alert.title}
                            </h3>
                            <p className="mt-1 text-sm text-[var(--brand-text-secondary)]">
                              {alert.description}
                            </p>
                          </div>
                          <span
                            className={`rounded-full border px-2 py-1 text-xs font-medium ${getAlertBadgeColor(alert.severity)}`}
                          >
                            {alert.severity}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center gap-4 text-xs text-[var(--brand-muted)]">
                          <span>{formatDate(alert.timestamp)}</span>
                          {alert.userEmail && (
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {alert.userEmail}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </RouteMeta>
  );
}
