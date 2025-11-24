import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RouteMeta } from '../../../components/layout/RouteMeta';
import { Card } from '../../../components/ui/Card';
import { DashboardSkeleton } from '../../../components/ui/DashboardSkeleton';
import { TenantSwitcher } from '../../../components/superuser/TenantSwitcher';
import { PlatformAuditLogViewer } from '../../../components/superuser/PlatformAuditLogViewer';
import { LoginAttemptsViewer } from '../../../components/superuser/LoginAttemptsViewer';
import { SessionMap } from '../../../components/superuser/SessionMap';
import { useWebSocket } from '../../../hooks/useWebSocket';
import { api } from '../../../lib/api';
import { Activity, Wifi, WifiOff } from 'lucide-react';
import { toast } from 'sonner';

export default function SuperuserActivityPage() {
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'audit' | 'attempts' | 'sessions'>(
    'overview'
  );

  // Fetch active sessions for the session map - using real database data
  const {
    data: sessionsData,
    isLoading: sessionsLoading,
    error: sessionsError,
  } = useQuery({
    queryKey: ['superuser', 'all-sessions', selectedTenantId],
    queryFn: async () => {
      return await api.superuser.getAllActiveSessions({
        tenantId: selectedTenantId,
        limit: 100,
      });
    },
    refetchInterval: 30000, // Poll every 30 seconds
    enabled: true,
  });

  const queryClient = useQueryClient();

  // WebSocket for real-time updates
  const { connected: wsConnected } = useWebSocket('/ws', {
    enabled: true,
    onMessage: (message) => {
      if (
        message.type === 'audit_log' ||
        message.type === 'activity' ||
        message.type === 'session_update'
      ) {
        // Invalidate queries to refetch data
        queryClient.invalidateQueries({ queryKey: ['superuser', 'all-sessions'] });
        queryClient.invalidateQueries({ queryKey: ['superuser', 'audit-logs'] });
        queryClient.invalidateQueries({ queryKey: ['superuser', 'login-attempts'] });
        toast.success('New activity detected', { duration: 2000 });
      }
    },
    onError: () => {
      // WebSocket errors are handled gracefully - fallback to polling
    },
  });

  const tabs = [
    { id: 'overview', label: 'Overview', icon: <Activity className="h-4 w-4" /> },
    { id: 'audit', label: 'Audit Logs', icon: <Activity className="h-4 w-4" /> },
    { id: 'attempts', label: 'Login Attempts', icon: <Activity className="h-4 w-4" /> },
    { id: 'sessions', label: 'Sessions', icon: <Activity className="h-4 w-4" /> },
  ];

  return (
    <RouteMeta title="Activity Monitoring">
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-heading-2 text-[var(--brand-text-primary)]">Activity Monitoring</h1>
            <p className="mt-2 text-body-small text-[var(--brand-text-secondary)]">
              Real-time monitoring of platform activity, user sessions, and security events
            </p>
          </div>
          <div className="flex items-center gap-4">
            {wsConnected ? (
              <div className="flex items-center gap-2 rounded-full bg-[var(--brand-success)]/20 px-3 py-1.5 text-sm text-[var(--brand-success)]">
                <Wifi className="h-4 w-4" />
                <span>Live</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-full bg-[var(--brand-muted)]/20 px-3 py-1.5 text-sm text-[var(--brand-muted)]">
                <WifiOff className="h-4 w-4" />
                <span>Polling</span>
              </div>
            )}
            <TenantSwitcher
              selectedTenantId={selectedTenantId}
              onTenantChange={setSelectedTenantId}
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-[var(--brand-border)]">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`
                  flex items-center gap-2 border-b-2 px-1 py-4 text-sm font-medium transition-colors
                  ${
                    activeTab === tab.id
                      ? 'border-[var(--brand-primary)] text-[var(--brand-primary)]'
                      : 'border-transparent text-[var(--brand-text-secondary)] hover:border-[var(--brand-border)] hover:text-[var(--brand-text-primary)]'
                  }
                `}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="space-y-6">
          {activeTab === 'overview' && (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card padding="md">
                <h3 className="mb-4 text-lg font-semibold text-[var(--brand-text-primary)]">
                  Recent Activity
                </h3>
                <PlatformAuditLogViewer
                  initialFilters={{
                    tenantId: selectedTenantId || undefined,
                    severity: 'warning',
                  }}
                />
              </Card>
              {sessionsError ? (
                <Card padding="md">
                  <div className="text-[var(--brand-error)]">
                    Failed to load sessions: {(sessionsError as Error).message}
                  </div>
                </Card>
              ) : (
                <SessionMap
                  sessions={sessionsData?.sessions || []}
                  className={sessionsLoading ? 'opacity-50' : ''}
                />
              )}
            </div>
          )}

          {activeTab === 'audit' && (
            <PlatformAuditLogViewer
              initialFilters={{
                tenantId: selectedTenantId || undefined,
              }}
            />
          )}

          {activeTab === 'attempts' && <LoginAttemptsViewer tenantId={selectedTenantId} />}

          {activeTab === 'sessions' && (
            <div className="space-y-6">
              {sessionsError ? (
                <Card padding="md">
                  <div className="text-[var(--brand-error)]">
                    Failed to load sessions: {(sessionsError as Error).message}
                  </div>
                </Card>
              ) : sessionsLoading ? (
                <Card padding="md">
                  <DashboardSkeleton />
                </Card>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-[var(--brand-text-secondary)]">
                      {sessionsData?.total || 0} active{' '}
                      {sessionsData?.total === 1 ? 'session' : 'sessions'}
                    </p>
                  </div>
                  <SessionMap sessions={sessionsData?.sessions || []} />
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </RouteMeta>
  );
}
