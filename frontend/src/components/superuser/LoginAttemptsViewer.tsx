import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DataTable, type DataTableColumn } from '../tables/DataTable';
import { SearchAndFilterBar } from './shared/SearchAndFilterBar';
import { DateRangeFilter } from './shared/DateRangeFilter';
import { Card } from '../ui/Card';
import { StatusBadge } from '../ui/StatusBadge';
import { api } from '../../lib/api';
import type { LoginAttemptRecord } from '../../lib/api';
import { formatDateTime } from '../../lib/utils/date';
import { formatUserAgent } from '../../utils/formatters';
import { DeviceInfoCell } from './shared/DeviceInfoCell';
import { LogIn, XCircle, CheckCircle2, MapPin, Mail, Monitor } from 'lucide-react';

export interface LoginAttemptsViewerProps {
  userId?: string;
  tenantId?: string | null;
  email?: string;
}

export function LoginAttemptsViewer({ userId, tenantId, email }: LoginAttemptsViewerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [quickRange, setQuickRange] = useState<'7' | '30' | '90' | 'all'>('7');
  const [successFilter, setSuccessFilter] = useState<string>('all');

  const { data, isLoading, error } = useQuery({
    queryKey: [
      'superuser',
      'login-attempts',
      userId,
      tenantId,
      email,
      startDate,
      endDate,
      successFilter,
    ],
    queryFn: async () => {
      const filters: {
        email?: string;
        userId?: string;
        tenantId?: string | null;
        success?: boolean;
        startDate?: string;
        endDate?: string;
        limit?: number;
        offset?: number;
      } = {};

      if (email) filters.email = email;
      if (userId) filters.userId = userId;
      if (tenantId !== undefined) filters.tenantId = tenantId;
      if (successFilter !== 'all') filters.success = successFilter === 'success';
      if (startDate) filters.startDate = new Date(startDate).toISOString();
      if (endDate) filters.endDate = new Date(endDate).toISOString();
      filters.limit = 100;
      filters.offset = 0;

      return await api.superuser.getLoginAttempts(filters);
    },
    enabled: true,
    refetchInterval: 30000, // Poll every 30 seconds for real-time updates
  });

  const filteredAttempts = useMemo(() => {
    if (!data?.attempts) return [];
    let filtered = [...data.attempts];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (attempt) =>
          attempt.email.toLowerCase().includes(term) ||
          attempt.ipAddress?.toLowerCase().includes(term) ||
          attempt.failureReason?.toLowerCase().includes(term) ||
          attempt.userAgent?.toLowerCase().includes(term) ||
          attempt.attemptedAt.toLowerCase().includes(term)
      );
    }

    if (successFilter !== 'all') {
      filtered = filtered.filter((attempt) =>
        successFilter === 'success' ? attempt.success : !attempt.success
      );
    }

    return filtered;
  }, [data?.attempts, searchTerm, successFilter]);

  const columns: DataTableColumn<LoginAttemptRecord>[] = useMemo(
    () => [
      {
        key: 'attemptedAt',
        header: 'Attempt Time',
        render: (attempt) => (
          <div className="flex items-center gap-2">
            <LogIn className="h-4 w-4 text-[var(--brand-muted)]" />
            <span className="text-[var(--brand-text-primary)]">
              {formatDateTime(attempt.attemptedAt)}
            </span>
          </div>
        ),
        sortable: true,
      },
      {
        key: 'email',
        header: 'Email',
        render: (attempt) => (
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-[var(--brand-muted)]" />
            <span className="text-[var(--brand-text-primary)]">{attempt.email}</span>
          </div>
        ),
        sortable: true,
      },
      {
        key: 'success',
        header: 'Status',
        render: (attempt) => (
          <div className="flex items-center gap-2">
            {attempt.success ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-[var(--brand-success)]" />
                <StatusBadge status="success" />
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 text-[var(--brand-error)]" />
                <StatusBadge status="error" />
              </>
            )}
          </div>
        ),
        sortable: true,
      },
      {
        key: 'failureReason',
        header: 'Failure Reason',
        render: (attempt) => (
          <span className="text-[var(--brand-text-secondary)] text-sm">
            {attempt.failureReason || (attempt.success ? '—' : 'Unknown')}
          </span>
        ),
      },
      {
        key: 'ipAddress',
        header: 'IP Address',
        render: (attempt) => (
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-[var(--brand-muted)]" />
            <span className="text-[var(--brand-text-primary)] font-mono text-sm">
              {attempt.ipAddress || '—'}
            </span>
          </div>
        ),
        sortable: true,
      },
      {
        key: 'deviceInfo',
        header: 'Device Info',
        render: (attempt) => (
          <DeviceInfoCell deviceInfo={attempt.deviceInfo} userAgent={attempt.userAgent} />
        ),
      },
      {
        key: 'userAgent',
        header: 'User Agent',
        render: (attempt) => (
          <div className="flex items-center gap-2">
            <Monitor className="h-4 w-4 text-[var(--brand-muted)]" />
            <span
              className="text-[var(--brand-text-secondary)] text-sm truncate max-w-xs"
              title={attempt.userAgent || undefined}
            >
              {formatUserAgent(attempt.userAgent)}
            </span>
          </div>
        ),
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
    setSuccessFilter('all');
  };

  if (error) {
    return (
      <Card padding="md">
        <div className="text-[var(--brand-error)]">
          Failed to load login attempts: {(error as Error).message}
        </div>
      </Card>
    );
  }

  const failedAttempts = filteredAttempts.filter((a) => !a.success);
  const successfulAttempts = filteredAttempts.filter((a) => a.success);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[var(--brand-text-primary)]">Login Attempts</h3>
          <p className="mt-1 text-sm text-[var(--brand-text-secondary)]">
            {filteredAttempts.length} attempts ({successfulAttempts.length} successful,{' '}
            {failedAttempts.length} failed)
          </p>
        </div>
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
            searchPlaceholder="Search by email, IP, or reason..."
            filters={[
              {
                label: 'Status',
                value: successFilter,
                onChange: setSuccessFilter,
                options: [
                  { label: 'All', value: 'all' },
                  { label: 'Successful', value: 'success' },
                  { label: 'Failed', value: 'failed' },
                ],
              },
            ]}
            onClearFilters={handleClearFilters}
          />

          <DataTable
            data={filteredAttempts}
            columns={columns}
            pagination={{ pageSize: 10, showSizeSelector: true }}
            loading={isLoading}
            emptyMessage="No login attempts found"
            responsive
          />
        </div>
      </Card>
    </div>
  );
}
