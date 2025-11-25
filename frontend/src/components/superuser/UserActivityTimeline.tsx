import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '../ui/Card';
import { api } from '../../lib/api';
import type { AuditLogEntry } from '../../lib/api';
import { formatDateShort } from '../../lib/utils/date';
import { Activity, LogIn, LogOut, Key, FileText, Settings, Calendar, Clock } from 'lucide-react';

export interface UserActivityTimelineProps {
  userId: string;
  tenantId?: string | null;
  limit?: number;
}

import type { ReactNode } from 'react';

const ACTION_ICONS: Record<string, ReactNode> = {
  LOGIN: <LogIn className="h-4 w-4" />,
  LOGOUT: <LogOut className="h-4 w-4" />,
  PASSWORD: <Key className="h-4 w-4" />,
  PASSWORD_RESET: <Key className="h-4 w-4" />,
  PASSWORD_CHANGE: <Key className="h-4 w-4" />,
  REPORT: <FileText className="h-4 w-4" />,
  SETTINGS: <Settings className="h-4 w-4" />,
  DEFAULT: <Activity className="h-4 w-4" />,
};

const ACTION_COLORS: Record<string, string> = {
  LOGIN:
    'bg-[var(--brand-success)]/20 text-[var(--brand-success)] border-[var(--brand-success)]/30',
  LOGOUT: 'bg-[var(--brand-muted)]/20 text-[var(--brand-muted)] border-[var(--brand-muted)]/30',
  PASSWORD:
    'bg-[var(--brand-warning)]/20 text-[var(--brand-warning)] border-[var(--brand-warning)]/30',
  PASSWORD_RESET:
    'bg-[var(--brand-warning)]/20 text-[var(--brand-warning)] border-[var(--brand-warning)]/30',
  PASSWORD_CHANGE:
    'bg-[var(--brand-warning)]/20 text-[var(--brand-warning)] border-[var(--brand-warning)]/30',
  REPORT: 'bg-[var(--brand-info)]/20 text-[var(--brand-info)] border-[var(--brand-info)]/30',
  SETTINGS:
    'bg-[var(--brand-primary)]/20 text-[var(--brand-primary)] border-[var(--brand-primary)]/30',
  DEFAULT: 'bg-[var(--brand-muted)]/20 text-[var(--brand-muted)] border-[var(--brand-muted)]/30',
};

export function UserActivityTimeline({ userId, tenantId, limit = 50 }: UserActivityTimelineProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['superuser', 'user-activity', userId, tenantId, limit],
    queryFn: async () => {
      const filters: {
        userId?: string;
        tenantId?: string;
        limit?: number;
      } = {
        userId,
        limit,
      };

      if (tenantId !== undefined && tenantId !== null) filters.tenantId = tenantId;

      return await api.superuser.getPlatformAuditLogs(filters);
    },
    enabled: !!userId,
  });

  const groupedActivities = useMemo(() => {
    if (!data?.logs) return [];

    const grouped: Record<string, AuditLogEntry[]> = {};

    data.logs.forEach((log) => {
      const timestamp = log.createdAt || log.timestamp;
      const date = timestamp
        ? new Date(timestamp.toString()).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];

      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(log);
    });

    // Sort dates descending
    const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

    return sortedDates.map((date) => ({
      date,
      activities: grouped[date].sort((a, b) => {
        const aTime = a.createdAt || a.timestamp;
        const bTime = b.createdAt || b.timestamp;
        return (
          new Date(bTime?.toString() || '').getTime() - new Date(aTime?.toString() || '').getTime()
        );
      }),
    }));
  }, [data?.logs]);

  const getActionIcon = (action: string) => {
    const upperAction = action.toUpperCase();
    for (const [key, icon] of Object.entries(ACTION_ICONS)) {
      if (upperAction.includes(key)) return icon;
    }
    return ACTION_ICONS.DEFAULT;
  };

  const getActionColor = (action: string) => {
    const upperAction = action.toUpperCase();
    for (const [key, color] of Object.entries(ACTION_COLORS)) {
      if (upperAction.includes(key)) return color;
    }
    return ACTION_COLORS.DEFAULT;
  };

  if (error) {
    return (
      <Card padding="md">
        <div className="text-[var(--brand-error)]">
          Failed to load activity timeline: {(error as Error).message}
        </div>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card padding="md">
        <div className="text-[var(--brand-text-secondary)]">Loading activity timeline...</div>
      </Card>
    );
  }

  if (groupedActivities.length === 0) {
    return (
      <Card padding="md">
        <div className="text-center text-[var(--brand-text-secondary)]">
          <Activity className="mx-auto mb-4 h-12 w-12 text-[var(--brand-muted)]" />
          <p className="font-semibold">No Activity Found</p>
          <p className="mt-1 text-sm">This user has no recorded activity yet.</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[var(--brand-text-primary)]">
          Activity Timeline
        </h3>
        <span className="text-sm text-[var(--brand-text-secondary)]">
          {data?.total || 0} {data?.total === 1 ? 'event' : 'events'}
        </span>
      </div>

      <div className="space-y-8">
        {groupedActivities.map(({ date, activities }) => (
          <div key={date} className="relative">
            {/* Date Header */}
            <div className="mb-4 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-[var(--brand-primary)]" />
              <h4 className="text-base font-semibold text-[var(--brand-text-primary)]">
                {formatDateShort(date)}
              </h4>
              <span className="text-sm text-[var(--brand-text-secondary)]">
                ({activities.length} {activities.length === 1 ? 'event' : 'events'})
              </span>
            </div>

            {/* Timeline */}
            <div className="relative pl-8">
              {/* Vertical line */}
              <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-[var(--brand-border)]" />

              {/* Activities */}
              <div className="space-y-4">
                {activities.map((activity) => {
                  const timestamp = activity.createdAt || activity.timestamp;
                  const time = timestamp
                    ? new Date(timestamp.toString()).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '—';

                  return (
                    <div key={activity.id} className="relative flex gap-4">
                      {/* Icon */}
                      <div
                        className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${getActionColor(activity.action || '')}`}
                      >
                        {getActionIcon(activity.action || '')}
                      </div>

                      {/* Content */}
                      <div className="flex-1 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-[var(--brand-text-primary)]">
                                {activity.action || 'Unknown Action'}
                              </span>
                              {activity.severity && (
                                <span
                                  className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                                    activity.severity === 'critical'
                                      ? 'bg-[var(--brand-error)]/20 text-[var(--brand-error)] border-[var(--brand-error)]/30'
                                      : activity.severity === 'warning'
                                        ? 'bg-[var(--brand-warning)]/20 text-[var(--brand-warning)] border-[var(--brand-warning)]/30'
                                        : 'bg-[var(--brand-info)]/20 text-[var(--brand-info)] border-[var(--brand-info)]/30'
                                  }`}
                                >
                                  {activity.severity}
                                </span>
                              )}
                            </div>
                            {activity.resourceType && (
                              <p className="mt-1 text-sm text-[var(--brand-text-secondary)]">
                                Resource: {activity.resourceType}
                                {activity.resourceId && (
                                  <span className="ml-2 font-mono text-xs text-[var(--brand-muted)]">
                                    ({activity.resourceId.slice(0, 8)}...)
                                  </span>
                                )}
                              </p>
                            )}
                            {activity.details && Object.keys(activity.details).length > 0 && (
                              <div className="mt-2 rounded border border-[var(--brand-border)] bg-[var(--brand-surface-secondary)] p-2">
                                <pre className="text-xs text-[var(--brand-text-secondary)]">
                                  {JSON.stringify(activity.details, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-[var(--brand-text-secondary)]">
                            <Clock className="h-4 w-4" />
                            <span>{time}</span>
                          </div>
                        </div>
                        {activity.ipAddress && (
                          <div className="mt-2 text-xs text-[var(--brand-muted)]">
                            IP: {activity.ipAddress}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
