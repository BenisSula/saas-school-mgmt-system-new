import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { RouteMeta } from '../../../../../components/layout/RouteMeta';
import { Card } from '../../../../../components/ui/Card';
import { Button } from '../../../../../components/ui/Button';
import { DashboardSkeleton } from '../../../../../components/ui/DashboardSkeleton';
import { StatusBanner } from '../../../../../components/ui/StatusBanner';
import {
  LoginHistoryViewer,
  SessionManager,
  PasswordHistoryViewer,
  UserActivityTimeline
} from '../../../../../components/superuser';
import { SessionMap } from '../../../../../components/superuser/SessionMap';
import { useWebSocket } from '../../../../../hooks/useWebSocket';
import { api } from '../../../../../lib/api';
import { ArrowLeft, User, Mail, Building2, Wifi, WifiOff } from 'lucide-react';
import { toast } from 'sonner';

export default function UserActivityPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<
    'timeline' | 'sessions' | 'login-history' | 'password-history'
  >('timeline');

  // Fetch user details - hooks must be called unconditionally
  const {
    data: userData,
    isLoading: userLoading,
    error: userError
  } = useQuery({
    queryKey: ['superuser', 'user', userId],
    queryFn: async () => {
      const users = await api.superuser.listUsers();
      return users.find((u) => u.id === userId);
    },
    enabled: !!userId
  });

  // Fetch user sessions - hooks must be called unconditionally
  const { data: sessionsData, isLoading: sessionsLoading } = useQuery({
    queryKey: ['superuser', 'sessions', userId],
    queryFn: async () => {
      return await api.superuser.getSessions(userId);
    },
    enabled: !!userId,
    refetchInterval: 30000 // Poll every 30 seconds
  });

  // WebSocket for real-time updates - hooks must be called unconditionally
  const { connected: wsConnected } = useWebSocket('/ws', {
    enabled: !!userId,
    onMessage: (message) => {
      if (
        message.type === 'user_activity' &&
        (message.payload as { userId?: string })?.userId === userId
      ) {
        toast.success('New activity detected', { duration: 2000 });
      }
    }
  });

  if (!userId) {
    return (
      <RouteMeta title="User Activity">
        <StatusBanner status="error" message="User ID is required" />
      </RouteMeta>
    );
  }

  const tabs = [
    { id: 'timeline', label: 'Activity Timeline' },
    { id: 'sessions', label: 'Sessions' },
    { id: 'login-history', label: 'Login History' },
    { id: 'password-history', label: 'Password History' }
  ];

  if (userLoading) {
    return (
      <RouteMeta title="User Activity">
        <DashboardSkeleton />
      </RouteMeta>
    );
  }

  if (userError || !userData) {
    return (
      <RouteMeta title="User Activity">
        <StatusBanner
          status="error"
          message={userError ? (userError as Error).message : 'User not found'}
        />
      </RouteMeta>
    );
  }

  return (
    <RouteMeta title={`Activity - ${userData.email}`}>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/dashboard/superuser/users')}
            leftIcon={<ArrowLeft className="h-4 w-4" />}
          >
            Back to Users
          </Button>
        </div>

        {/* User Info Card */}
        <Card padding="md">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-primary)]/20">
                <User className="h-6 w-6 text-[var(--brand-primary)]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[var(--brand-text-primary)]">
                  {userData.email}
                </h2>
                <div className="mt-1 flex flex-wrap items-center gap-4 text-sm text-[var(--brand-text-secondary)]">
                  <div className="flex items-center gap-1">
                    <Mail className="h-4 w-4" />
                    <span>{userData.email}</span>
                  </div>
                  {userData.tenantName && (
                    <div className="flex items-center gap-1">
                      <Building2 className="h-4 w-4" />
                      <span>{userData.tenantName}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <span className="capitalize">{userData.role}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
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
            </div>
          </div>
        </Card>

        {/* Tabs */}
        <div className="border-b border-[var(--brand-border)]">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`
                  border-b-2 px-1 py-4 text-sm font-medium transition-colors
                  ${
                    activeTab === tab.id
                      ? 'border-[var(--brand-primary)] text-[var(--brand-primary)]'
                      : 'border-transparent text-[var(--brand-text-secondary)] hover:border-[var(--brand-border)] hover:text-[var(--brand-text-primary)]'
                  }
                `}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="space-y-6">
          {activeTab === 'timeline' && (
            <UserActivityTimeline userId={userId} tenantId={userData.tenantId || null} />
          )}

          {activeTab === 'sessions' && (
            <div className="space-y-6">
              <SessionManager userId={userId} />
              {sessionsLoading ? (
                <Card padding="md">
                  <DashboardSkeleton />
                </Card>
              ) : sessionsData?.sessions && sessionsData.sessions.length > 0 ? (
                <SessionMap sessions={sessionsData.sessions} />
              ) : (
                <Card padding="md">
                  <div className="text-center text-[var(--brand-text-secondary)]">
                    <p>No active sessions found</p>
                  </div>
                </Card>
              )}
            </div>
          )}

          {activeTab === 'login-history' && (
            <LoginHistoryViewer userId={userId} tenantId={userData.tenantId || null} />
          )}

          {activeTab === 'password-history' && (
            <PasswordHistoryViewer userId={userId} tenantId={userData.tenantId || null} />
          )}
        </div>
      </div>
    </RouteMeta>
  );
}
