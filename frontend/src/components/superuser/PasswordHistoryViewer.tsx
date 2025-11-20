import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DataTable, type DataTableColumn } from '../tables/DataTable';
import { SearchAndFilterBar } from './shared/SearchAndFilterBar';
import { DateRangeFilter } from './shared/DateRangeFilter';
import { Card } from '../ui/Card';
import { api } from '../../lib/api';
import type { PasswordChangeHistory } from '../../lib/api';
import { formatDateTime } from '../../lib/utils/date';
import { formatChangedBy, formatUserAgent } from '../../utils/formatters';
import { DeviceInfoCell } from './shared/DeviceInfoCell';
import { MetadataCell } from './shared/MetadataCell';
import { Key, User, MapPin } from 'lucide-react';

export interface PasswordHistoryViewerProps {
  userId: string;
  tenantId?: string | null;
}

const CHANGE_TYPE_LABELS: Record<PasswordChangeHistory['changeType'], string> = {
  self_reset: 'Self Reset',
  admin_reset: 'Admin Reset',
  admin_change: 'Admin Change',
  forced_reset: 'Forced Reset'
};

const CHANGE_TYPE_COLORS: Record<PasswordChangeHistory['changeType'], string> = {
  self_reset: 'bg-[var(--brand-info)]/20 text-[var(--brand-info)] border-[var(--brand-info)]/30',
  admin_reset: 'bg-[var(--brand-warning)]/20 text-[var(--brand-warning)] border-[var(--brand-warning)]/30',
  admin_change: 'bg-[var(--brand-primary)]/20 text-[var(--brand-primary)] border-[var(--brand-primary)]/30',
  forced_reset: 'bg-[var(--brand-error)]/20 text-[var(--brand-error)] border-[var(--brand-error)]/30'
};

export function PasswordHistoryViewer({ userId, tenantId }: PasswordHistoryViewerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [quickRange, setQuickRange] = useState<'7' | '30' | '90' | 'all'>('30');
  const [changeTypeFilter, setChangeTypeFilter] = useState<string>('all');

  const { data, isLoading, error } = useQuery({
    queryKey: [
      'superuser',
      'password-history',
      userId,
      tenantId,
      startDate,
      endDate,
      changeTypeFilter
    ],
    queryFn: async () => {
      const filters: {
        tenantId?: string | null;
        startDate?: string;
        endDate?: string;
        changeType?: PasswordChangeHistory['changeType'];
      } = {};

      if (tenantId !== undefined) filters.tenantId = tenantId;
      if (startDate) filters.startDate = new Date(startDate).toISOString();
      if (endDate) filters.endDate = new Date(endDate).toISOString();
      if (changeTypeFilter !== 'all') {
        filters.changeType = changeTypeFilter as PasswordChangeHistory['changeType'];
      }

      return await api.superuser.getPasswordHistory(userId, filters);
    },
    enabled: !!userId
  });

  const filteredHistory = useMemo(() => {
    if (!data?.history) return [];
    let filtered = [...data.history];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (entry) =>
          entry.changeType.toLowerCase().includes(term) ||
          entry.ipAddress?.toLowerCase().includes(term) ||
          entry.changedAt.toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [data?.history, searchTerm]);

  const columns: DataTableColumn<PasswordChangeHistory>[] = useMemo(
    () => [
      {
        key: 'changedAt',
        header: 'Change Time',
        render: (entry) => (
          <div className="flex items-center gap-2">
            <Key className="h-4 w-4 text-[var(--brand-muted)]" />
            <span className="text-[var(--brand-text-primary)]">
              {formatDateTime(entry.changedAt)}
            </span>
          </div>
        ),
        sortable: true
      },
      {
        key: 'changeType',
        header: 'Type',
        render: (entry) => (
          <span
            className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium ${CHANGE_TYPE_COLORS[entry.changeType]}`}
          >
            {CHANGE_TYPE_LABELS[entry.changeType]}
          </span>
        ),
        sortable: true
      },
      {
        key: 'changedBy',
        header: 'Changed By',
        render: (entry) => (
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-[var(--brand-muted)]" />
            <div className="flex flex-col">
              <span className="text-[var(--brand-text-primary)] text-sm font-medium">
                {formatChangedBy(entry.changedBy, entry.changedByEmail, entry.changedByName)}
              </span>
              {entry.changedByEmail && entry.changedByEmail !== entry.changedByName && (
                <span className="text-xs text-[var(--brand-text-secondary)]">
                  {entry.changedByEmail}
                </span>
              )}
              {entry.changedByRole && (
                <span className="text-xs text-[var(--brand-muted)]">
                  {entry.changedByRole}
                </span>
              )}
            </div>
          </div>
        ),
        sortable: true
      },
      {
        key: 'ipAddress',
        header: 'IP Address',
        render: (entry) => (
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-[var(--brand-muted)]" />
            <span className="text-[var(--brand-text-primary)] font-mono text-sm">
              {entry.ipAddress || '—'}
            </span>
          </div>
        )
      },
      {
        key: 'deviceInfo',
        header: 'Device Info',
        render: (entry) => (
          <DeviceInfoCell
            deviceInfo={entry.deviceInfo}
            userAgent={entry.userAgent}
          />
        )
      },
      {
        key: 'userAgent',
        header: 'User Agent',
        render: (entry) => (
          <span className="text-[var(--brand-text-secondary)] text-sm truncate max-w-xs" title={entry.userAgent || undefined}>
            {formatUserAgent(entry.userAgent)}
          </span>
        )
      },
      {
        key: 'metadata',
        header: 'Metadata',
        render: (entry) => (
          <MetadataCell
            metadata={entry.metadata}
            showReason
            showNotification
          />
        )
      }
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
    setChangeTypeFilter('all');
  };

  if (error) {
    return (
      <Card padding="md">
        <div className="text-[var(--brand-error)]">
          Failed to load password history: {(error as Error).message}
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[var(--brand-text-primary)]">
          Password Change History
        </h3>
        <span className="text-sm text-[var(--brand-text-secondary)]">
          {data?.total || 0} {data?.total === 1 ? 'change' : 'changes'}
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
            searchPlaceholder="Search by type, IP, or date..."
            filters={[
              {
                label: 'Change Type',
                value: changeTypeFilter,
                onChange: setChangeTypeFilter,
                options: [
                  { label: 'All Types', value: 'all' },
                  { label: 'Self Reset', value: 'self_reset' },
                  { label: 'Admin Reset', value: 'admin_reset' },
                  { label: 'Admin Change', value: 'admin_change' },
                  { label: 'Forced Reset', value: 'forced_reset' }
                ]
              }
            ]}
            onClearFilters={handleClearFilters}
          />

          <DataTable
            data={filteredHistory}
            columns={columns}
            pagination={{ pageSize: 10, showSizeSelector: true }}
            loading={isLoading}
            emptyMessage="No password change history found"
            responsive
          />
        </div>
      </Card>
    </div>
  );
}

