import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DataTable, type DataTableColumn } from '../tables/DataTable';
import { SearchAndFilterBar } from './shared/SearchAndFilterBar';
import { DateRangeFilter } from './shared/DateRangeFilter';
import { Card } from '../ui/Card';
import { StatusBadge } from '../ui/StatusBadge';
import { api } from '../../lib/api';
import type { UserSession } from '../../lib/api';
import { formatDateTime, formatDate } from '../../lib/utils/date';
import { formatUserAgent } from '../../utils/formatters';
import { DeviceInfoCell } from './shared/DeviceInfoCell';
import { Activity, MapPin, Clock } from 'lucide-react';

export interface LoginHistoryViewerProps {
  userId: string;
  tenantId?: string | null;
}

export function LoginHistoryViewer({ userId, tenantId }: LoginHistoryViewerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [quickRange, setQuickRange] = useState<'7' | '30' | '90' | 'all'>('30');
  const [isActiveFilter, setIsActiveFilter] = useState<string>('all');

  const { data, isLoading, error } = useQuery({
    queryKey: ['superuser', 'login-history', userId, tenantId, startDate, endDate, isActiveFilter],
    queryFn: async () => {
      const filters: {
        tenantId?: string | null;
        startDate?: string;
        endDate?: string;
        isActive?: boolean;
      } = {};

      if (tenantId !== undefined) filters.tenantId = tenantId;
      if (startDate) filters.startDate = new Date(startDate).toISOString();
      if (endDate) filters.endDate = new Date(endDate).toISOString();
      if (isActiveFilter !== 'all') filters.isActive = isActiveFilter === 'active';

      return await api.superuser.getLoginHistory(userId, filters);
    },
    enabled: !!userId,
  });

  const filteredSessions = useMemo(() => {
    if (!data?.sessions) return [];
    let filtered = [...data.sessions];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (session) =>
          session.ipAddress?.toLowerCase().includes(term) ||
          session.userAgent?.toLowerCase().includes(term) ||
          session.loginAt.toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [data?.sessions, searchTerm]);

  const columns: DataTableColumn<UserSession>[] = useMemo(
    () => [
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
        key: 'logoutAt',
        header: 'Logout Time',
        render: (session) => (
          <span className="text-[var(--brand-text-secondary)]">
            {session.logoutAt ? formatDateTime(session.logoutAt) : 'Active'}
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
    ],
    []
  );

  const handleQuickRangeChange = (range: '7' | '30' | '90' | 'all') => {
    setQuickRange(range);
    if (range === 'all') {
      setStartDate('');
      setEndDate('');
    } else {
      const days = Number(range);
      const to = new Date();
      const from = new Date();
      from.setDate(to.getDate() - days + 1);
      setStartDate(from.toISOString().slice(0, 10));
      setEndDate(to.toISOString().slice(0, 10));
    }
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setStartDate('');
    setEndDate('');
    setQuickRange('all');
    setIsActiveFilter('all');
  };

  if (error) {
    return (
      <Card padding="md">
        <div className="text-[var(--brand-error)]">
          Failed to load login history: {(error as Error).message}
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[var(--brand-text-primary)]">Login History</h3>
        <span className="text-sm text-[var(--brand-text-secondary)]">
          {data?.total || 0} {data?.total === 1 ? 'session' : 'sessions'}
        </span>
      </div>

      <Card padding="md">
        <div className="space-y-4">
          <DateRangeFilter
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
            quickRange={quickRange}
            onQuickRangeChange={handleQuickRangeChange}
          />

          <SearchAndFilterBar
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder="Search by IP, device, or date..."
            filters={[
              {
                label: 'Status',
                value: isActiveFilter,
                onChange: setIsActiveFilter,
                options: [
                  { label: 'All', value: 'all' },
                  { label: 'Active', value: 'active' },
                  { label: 'Ended', value: 'inactive' },
                ],
              },
            ]}
            onClearFilters={handleClearFilters}
          />

          <DataTable
            data={filteredSessions}
            columns={columns}
            pagination={{ pageSize: 10, showSizeSelector: true }}
            loading={isLoading}
            emptyMessage="No login history found"
            responsive
          />
        </div>
      </Card>
    </div>
  );
}
