import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DataTable, type DataTableColumn } from '../tables/DataTable';
import { SearchAndFilterBar } from './shared/SearchAndFilterBar';
import { DateRangeFilter } from './shared/DateRangeFilter';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { api } from '../../lib/api';
import type { AuditLogEntry } from '../../lib/api';
import { formatDateTime } from '../../lib/utils/date';
import { formatRequestId, formatUserAgent } from '../../utils/formatters';
import { TagsCell } from './shared/TagsCell';
import { AuditDetailsModal } from './shared/AuditDetailsModal';
import {
  FileText,
  Download,
  AlertCircle,
  AlertTriangle,
  Info,
  XCircle,
  Eye,
  Monitor
} from 'lucide-react';
import { toast } from 'sonner';

export interface PlatformAuditLogViewerProps {
  initialFilters?: {
    tenantId?: string;
    userId?: string;
    action?: string;
    severity?: 'info' | 'warning' | 'error' | 'critical';
  };
}

const SEVERITY_COLORS: Record<string, string> = {
  info: 'bg-[var(--brand-info)]/20 text-[var(--brand-info)] border-[var(--brand-info)]/30',
  warning:
    'bg-[var(--brand-warning)]/20 text-[var(--brand-warning)] border-[var(--brand-warning)]/30',
  error: 'bg-[var(--brand-error)]/20 text-[var(--brand-error)] border-[var(--brand-error)]/30',
  critical: 'bg-[var(--brand-error)]/30 text-[var(--brand-error)] border-[var(--brand-error)]/50'
};

import type { ReactNode } from 'react';

const SEVERITY_ICONS: Record<string, ReactNode> = {
  info: <Info className="h-4 w-4" />,
  warning: <AlertTriangle className="h-4 w-4" />,
  error: <XCircle className="h-4 w-4" />,
  critical: <AlertCircle className="h-4 w-4" />
};

export function PlatformAuditLogViewer({ initialFilters = {} }: PlatformAuditLogViewerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [quickRange, setQuickRange] = useState<'7' | '30' | '90' | 'all'>('7');
  const [severityFilter, setSeverityFilter] = useState<string>(initialFilters.severity || 'all');
  const [actionFilter, setActionFilter] = useState<string>(initialFilters.action || 'all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: [
      'superuser',
      'audit-logs',
      startDate,
      endDate,
      severityFilter,
      actionFilter,
      currentPage,
      pageSize,
      initialFilters.tenantId,
      initialFilters.userId
    ],
    queryFn: async () => {
      const filters: {
        tenantId?: string;
        userId?: string;
        action?: string;
        severity?: 'info' | 'warning' | 'error' | 'critical';
        startDate?: string;
        endDate?: string;
        limit?: number;
        offset?: number;
      } = {
        ...initialFilters
      };

      if (startDate) filters.startDate = new Date(startDate).toISOString();
      if (endDate) filters.endDate = new Date(endDate).toISOString();
      if (severityFilter !== 'all') {
        filters.severity = severityFilter as 'info' | 'warning' | 'error' | 'critical';
      }
      if (actionFilter !== 'all') filters.action = actionFilter;
      filters.limit = pageSize;
      filters.offset = (currentPage - 1) * pageSize;

      return await api.superuser.getPlatformAuditLogs(filters);
    }
  });

  const handleExport = async (format: 'csv' | 'json' = 'json') => {
    try {
      const filters: {
        tenantId?: string;
        userId?: string;
        action?: string;
        severity?: 'info' | 'warning' | 'error' | 'critical';
        startDate?: string;
        endDate?: string;
        format?: 'csv' | 'json';
      } = {
        ...initialFilters,
        format
      };

      if (startDate) filters.startDate = new Date(startDate).toISOString();
      if (endDate) filters.endDate = new Date(endDate).toISOString();
      if (severityFilter !== 'all') {
        filters.severity = severityFilter as 'info' | 'warning' | 'error' | 'critical';
      }
      if (actionFilter !== 'all') filters.action = actionFilter;

      const blob = await api.superuser.exportPlatformAuditLogs(filters);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success(`Audit logs exported as ${format.toUpperCase()}`);
    } catch (err) {
      toast.error(`Failed to export: ${(err as Error).message}`);
    }
  };

  const filteredLogs = useMemo(() => {
    if (!data?.logs) return [];
    let filtered = [...data.logs];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (log) =>
          log.action?.toLowerCase().includes(term) ||
          log.resourceType?.toLowerCase().includes(term) ||
          log.resourceId?.toLowerCase().includes(term) ||
          log.userEmail?.toLowerCase().includes(term) ||
          JSON.stringify(log.details || {})
            .toLowerCase()
            .includes(term)
      );
    }

    return filtered;
  }, [data?.logs, searchTerm]);

  const uniqueActions = useMemo(() => {
    if (!data?.logs) return [];
    return Array.from(new Set(data.logs.map((log) => log.action).filter(Boolean)));
  }, [data?.logs]);

  const columns: DataTableColumn<AuditLogEntry>[] = useMemo(
    () => [
      {
        key: 'createdAt',
        header: 'Timestamp',
        render: (log) => {
          const timestamp = log.createdAt || log.timestamp;
          return (
            <span className="text-[var(--brand-text-primary)]">
              {timestamp ? formatDateTime(timestamp.toString()) : '—'}
            </span>
          );
        },
        sortable: true
      },
      {
        key: 'severity',
        header: 'Severity',
        render: (log) => {
          const severity = log.severity || 'info';
          return (
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium ${SEVERITY_COLORS[severity] || SEVERITY_COLORS.info}`}
            >
              {SEVERITY_ICONS[severity] || SEVERITY_ICONS.info}
              {severity.charAt(0).toUpperCase() + severity.slice(1)}
            </span>
          );
        },
        sortable: true
      },
      {
        key: 'action',
        header: 'Action',
        render: (log) => (
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-[var(--brand-muted)]" />
            <span className="text-[var(--brand-text-primary)] font-medium">
              {log.action || '—'}
            </span>
          </div>
        ),
        sortable: true
      },
      {
        key: 'resourceType',
        header: 'Resource',
        render: (log) => (
          <div className="text-[var(--brand-text-secondary)]">
            <div className="font-medium">{log.resourceType || '—'}</div>
            {log.resourceId && (
              <div className="text-xs text-[var(--brand-muted)] font-mono">
                {log.resourceId.slice(0, 8)}...
              </div>
            )}
          </div>
        )
      },
      {
        key: 'userEmail',
        header: 'User',
        render: (log) => (
          <span className="text-[var(--brand-text-secondary)]">
            {log.userEmail || log.userId || 'System'}
          </span>
        )
      },
      {
        key: 'ipAddress',
        header: 'IP Address',
        render: (log) => (
          <span className="text-[var(--brand-text-secondary)] font-mono text-sm">
            {log.ipAddress || '—'}
          </span>
        )
      },
      {
        key: 'userAgent',
        header: 'User Agent',
        render: (log) => (
          <div className="flex items-center gap-2">
            <Monitor className="h-4 w-4 text-[var(--brand-muted)]" />
            <span
              className="text-[var(--brand-text-secondary)] text-sm truncate max-w-xs"
              title={log.userAgent || undefined}
            >
              {formatUserAgent(log.userAgent)}
            </span>
          </div>
        )
      },
      {
        key: 'requestId',
        header: 'Request ID',
        render: (log) => (
          <span className="text-[var(--brand-text-secondary)] font-mono text-xs">
            {formatRequestId(log.requestId)}
          </span>
        )
      },
      {
        key: 'tags',
        header: 'Tags',
        render: (log) => <TagsCell tags={log.tags} maxDisplay={3} />
      },
      {
        key: 'actions',
        header: 'Actions',
        render: (log) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedLog(log);
              setShowDetailsModal(true);
            }}
            leftIcon={<Eye className="h-4 w-4" />}
          >
            View Details
          </Button>
        )
      }
    ],
    []
  );

  const handleQuickRangeChange = (range: '7' | '30' | '90' | 'all') => {
    setQuickRange(range);
    setCurrentPage(1);
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
    setSeverityFilter('all');
    setActionFilter('all');
    setCurrentPage(1);
  };

  if (error) {
    return (
      <Card padding="md">
        <div className="text-[var(--brand-error)]">
          Failed to load audit logs: {(error as Error).message}
        </div>
      </Card>
    );
  }

  const totalPages = data?.total ? Math.ceil(data.total / pageSize) : 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[var(--brand-text-primary)]">
            Platform Audit Logs
          </h3>
          <p className="mt-1 text-sm text-[var(--brand-text-secondary)]">
            {data?.total || 0} {data?.total === 1 ? 'event' : 'events'} total
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => handleExport('json')}
            leftIcon={<Download className="h-4 w-4" />}
          >
            Export JSON
          </Button>
          <Button
            variant="outline"
            onClick={() => handleExport('csv')}
            leftIcon={<Download className="h-4 w-4" />}
          >
            Export CSV
          </Button>
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
            searchPlaceholder="Search by action, resource, user, or IP..."
            filters={[
              {
                label: 'Severity',
                value: severityFilter,
                onChange: setSeverityFilter,
                options: [
                  { label: 'All Severities', value: 'all' },
                  { label: 'Info', value: 'info' },
                  { label: 'Warning', value: 'warning' },
                  { label: 'Error', value: 'error' },
                  { label: 'Critical', value: 'critical' }
                ]
              },
              {
                label: 'Action',
                value: actionFilter,
                onChange: setActionFilter,
                options: [
                  { label: 'All Actions', value: 'all' },
                  ...uniqueActions.map((action) => ({ label: action, value: action }))
                ]
              }
            ]}
            onClearFilters={handleClearFilters}
          />

          <DataTable
            data={filteredLogs}
            columns={columns}
            pagination={{ pageSize, showSizeSelector: true }}
            loading={isLoading}
            emptyMessage="No audit logs found"
            responsive
          />

          {/* Custom pagination controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-[var(--brand-border)] pt-4">
              <div className="text-sm text-[var(--brand-text-secondary)]">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      <AuditDetailsModal
        log={selectedLog}
        isOpen={showDetailsModal}
        onClose={() => {
          setShowDetailsModal(false);
          setSelectedLog(null);
        }}
      />
    </div>
  );
}
