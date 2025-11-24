import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DataTable, type DataTableColumn } from '../tables/DataTable';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { StatusBadge } from '../ui/StatusBadge';
import { Modal } from '../ui/Modal';
import { api } from '../../lib/api';
import type { UserSession } from '../../lib/api';
import { formatDateTime } from '../../lib/utils/date';
import { formatDate } from '../../utils/formatters';
import { formatUserAgent } from '../../utils/formatters';
import { DeviceInfoCell } from './shared/DeviceInfoCell';
import { Activity, MapPin, Monitor, LogOut, AlertTriangle, Clock } from 'lucide-react';
import { toast } from 'sonner';

export interface SessionManagerProps {
  userId: string;
}

export function SessionManager({ userId }: SessionManagerProps) {
  const queryClient = useQueryClient();
  const [selectedSession, setSelectedSession] = useState<UserSession | null>(null);
  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [showRevokeAllModal, setShowRevokeAllModal] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['superuser', 'sessions', userId],
    queryFn: async () => {
      return await api.superuser.getSessions(userId);
    },
    enabled: !!userId,
  });

  const revokeSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      return await api.superuser.revokeSession(userId, sessionId);
    },
    onSuccess: () => {
      toast.success('Session revoked successfully');
      queryClient.invalidateQueries({ queryKey: ['superuser', 'sessions', userId] });
      setShowRevokeModal(false);
      setSelectedSession(null);
    },
    onError: (error: Error) => {
      toast.error(`Failed to revoke session: ${error.message}`);
    },
  });

  const revokeAllMutation = useMutation({
    mutationFn: async () => {
      return await api.superuser.revokeAllSessions(userId);
    },
    onSuccess: (data) => {
      toast.success(`Revoked ${data.revokedCount || 0} sessions`);
      queryClient.invalidateQueries({ queryKey: ['superuser', 'sessions', userId] });
      setShowRevokeAllModal(false);
    },
    onError: (error: Error) => {
      toast.error(`Failed to revoke sessions: ${error.message}`);
    },
  });

  const sessions = data?.sessions || [];

  const columns: DataTableColumn<UserSession>[] = [
    {
      key: 'loginAt',
      header: 'Login Time',
      render: (session) => (
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-[var(--brand-muted)]" />
          <span className="text-[var(--brand-text-primary)]">
            {formatDateTime(session.loginAt)}
          </span>
        </div>
      ),
      sortable: true,
    },
    {
      key: 'ipAddress',
      header: 'IP Address',
      render: (session) => (
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-[var(--brand-muted)]" />
          <span className="text-[var(--brand-text-primary)] font-mono text-sm">
            {session.ipAddress || '—'}
          </span>
        </div>
      ),
      sortable: true,
    },
    {
      key: 'deviceInfo',
      header: 'Device Info',
      render: (session) => (
        <DeviceInfoCell
          deviceInfo={session.normalizedDeviceInfo || session.deviceInfo}
          userAgent={session.userAgent}
        />
      ),
    },
    {
      key: 'userAgent',
      header: 'User Agent',
      render: (session) => (
        <span
          className="text-[var(--brand-text-secondary)] text-sm truncate max-w-xs"
          title={session.userAgent || undefined}
        >
          {formatUserAgent(session.userAgent)}
        </span>
      ),
    },
    {
      key: 'expiresAt',
      header: 'Expires',
      render: (session) => (
        <span className="text-[var(--brand-text-secondary)]">
          {formatDateTime(session.expiresAt)}
        </span>
      ),
      sortable: true,
    },
    {
      key: 'updatedAt',
      header: 'Updated',
      render: (session) => (
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3 text-[var(--brand-muted)]" />
          <span className="text-[var(--brand-text-secondary)] text-xs">
            {formatDate(session.updatedAt)}
          </span>
        </div>
      ),
      sortable: true,
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (session) => <StatusBadge status={session.isActive ? 'active' : 'inactive'} />,
      sortable: true,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (session) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setSelectedSession(session);
            setShowRevokeModal(true);
          }}
          disabled={!session.isActive}
          leftIcon={<LogOut className="h-4 w-4" />}
        >
          Revoke
        </Button>
      ),
    },
  ];

  if (error) {
    return (
      <Card padding="md">
        <div className="text-[var(--brand-error)]">
          Failed to load sessions: {(error as Error).message}
        </div>
      </Card>
    );
  }

  const activeSessions = sessions.filter((s) => s.isActive);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[var(--brand-text-primary)]">
            Active Sessions
          </h3>
          <p className="mt-1 text-sm text-[var(--brand-text-secondary)]">
            {activeSessions.length} active {activeSessions.length === 1 ? 'session' : 'sessions'}{' '}
            out of {sessions.length} total
          </p>
        </div>
        {activeSessions.length > 0 && (
          <Button
            variant="outline"
            onClick={() => setShowRevokeAllModal(true)}
            leftIcon={<AlertTriangle className="h-4 w-4" />}
          >
            Revoke All Sessions
          </Button>
        )}
      </div>

      <Card padding="md">
        <DataTable
          data={sessions}
          columns={columns}
          pagination={{ pageSize: 10, showSizeSelector: true }}
          loading={isLoading}
          emptyMessage="No active sessions found"
          responsive
        />
      </Card>

      {/* Revoke Single Session Modal */}
      <Modal
        title="Revoke Session"
        isOpen={showRevokeModal}
        onClose={() => {
          setShowRevokeModal(false);
          setSelectedSession(null);
        }}
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setShowRevokeModal(false);
                setSelectedSession(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="solid"
              onClick={() => {
                if (selectedSession) {
                  revokeSessionMutation.mutate(selectedSession.id);
                }
              }}
              loading={revokeSessionMutation.isPending}
            >
              Revoke Session
            </Button>
          </>
        }
      >
        {selectedSession && (
          <div className="space-y-4">
            <p className="text-[var(--brand-text-secondary)]">
              Are you sure you want to revoke this session? The user will be logged out immediately.
            </p>
            <div className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface-secondary)] p-4 space-y-2">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-[var(--brand-muted)]" />
                <span className="text-sm text-[var(--brand-text-primary)]">
                  <strong>IP:</strong> {selectedSession.ipAddress || 'Unknown'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Monitor className="h-4 w-4 text-[var(--brand-muted)]" />
                <div className="text-sm text-[var(--brand-text-primary)]">
                  <strong>Device:</strong>{' '}
                  <DeviceInfoCell
                    deviceInfo={selectedSession.normalizedDeviceInfo || selectedSession.deviceInfo}
                    userAgent={selectedSession.userAgent}
                    showFull
                  />
                </div>
              </div>
              {selectedSession.userAgent && (
                <div className="flex items-start gap-2">
                  <span className="text-xs text-[var(--brand-text-secondary)] break-all">
                    <strong>User Agent:</strong> {formatUserAgent(selectedSession.userAgent, 100)}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-[var(--brand-muted)]" />
                <span className="text-sm text-[var(--brand-text-primary)]">
                  <strong>Updated:</strong> {formatDate(selectedSession.updatedAt)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-[var(--brand-muted)]" />
                <span className="text-sm text-[var(--brand-text-primary)]">
                  <strong>Login Time:</strong> {formatDateTime(selectedSession.loginAt)}
                </span>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Revoke All Sessions Modal */}
      <Modal
        title="Revoke All Sessions"
        isOpen={showRevokeAllModal}
        onClose={() => setShowRevokeAllModal(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setShowRevokeAllModal(false)}>
              Cancel
            </Button>
            <Button
              variant="solid"
              onClick={() => revokeAllMutation.mutate()}
              loading={revokeAllMutation.isPending}
            >
              Revoke All Sessions
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-[var(--brand-warning)]/30 bg-[var(--brand-warning)]/10 p-4">
            <AlertTriangle className="h-5 w-5 text-[var(--brand-warning)] mt-0.5" />
            <div>
              <p className="font-semibold text-[var(--brand-text-primary)]">
                Warning: This will log out the user from all devices
              </p>
              <p className="mt-1 text-sm text-[var(--brand-text-secondary)]">
                All {activeSessions.length} active sessions will be revoked immediately. The user
                will need to log in again.
              </p>
            </div>
          </div>
          <p className="text-[var(--brand-text-secondary)]">Are you sure you want to proceed?</p>
        </div>
      </Modal>
    </div>
  );
}
