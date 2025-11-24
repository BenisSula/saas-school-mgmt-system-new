import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, type TableColumn } from '../../ui/Table';
import { Badge } from '../../ui/Badge';
import { formatDate } from '../../../lib/utils/date';
import type { InvestigationCase } from '../../../lib/api';

export interface InvestigationListTableProps {
  cases: InvestigationCase[];
  loading?: boolean;
  onRowClick?: (case_: InvestigationCase) => void;
}

const statusColors: Record<InvestigationCase['status'], string> = {
  open: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  investigating: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
  resolved: 'bg-green-500/10 text-green-600 dark:text-green-400',
  closed: 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
};

const priorityColors: Record<InvestigationCase['priority'], string> = {
  low: 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
  medium: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  high: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  critical: 'bg-red-500/10 text-red-600 dark:text-red-400',
};

const caseTypeLabels: Record<InvestigationCase['caseType'], string> = {
  anomaly: 'Anomaly',
  security: 'Security',
  compliance: 'Compliance',
  abuse: 'Abuse',
  other: 'Other',
};

export function InvestigationListTable({
  cases,
  loading,
  onRowClick,
}: InvestigationListTableProps) {
  const navigate = useNavigate();

  const handleRowClick = (case_: InvestigationCase) => {
    if (onRowClick) {
      onRowClick(case_);
    } else {
      navigate(`/dashboard/superuser/investigations/${case_.id}`);
    }
  };

  const columns: TableColumn<InvestigationCase>[] = useMemo(
    () => [
      {
        key: 'caseNumber',
        header: 'Case #',
        render: (case_) => (
          <span className="font-mono text-sm font-medium text-[var(--brand-text-primary)]">
            {case_.caseNumber}
          </span>
        ),
      },
      {
        key: 'title',
        header: 'Title',
        render: (case_) => (
          <div className="flex flex-col">
            <span className="font-medium text-[var(--brand-text-primary)]">{case_.title}</span>
            {case_.description && (
              <span className="text-xs text-[var(--brand-text-secondary)] line-clamp-1">
                {case_.description}
              </span>
            )}
          </div>
        ),
      },
      {
        key: 'caseType',
        header: 'Type',
        render: (case_) => (
          <Badge variant="outline" className="text-xs">
            {caseTypeLabels[case_.caseType]}
          </Badge>
        ),
      },
      {
        key: 'priority',
        header: 'Priority',
        render: (case_) => (
          <Badge className={`text-xs ${priorityColors[case_.priority]}`}>
            {case_.priority.toUpperCase()}
          </Badge>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        render: (case_) => (
          <Badge className={`text-xs ${statusColors[case_.status]}`}>
            {case_.status.charAt(0).toUpperCase() + case_.status.slice(1)}
          </Badge>
        ),
      },
      {
        key: 'relatedUserId',
        header: 'Related User',
        render: (case_) => (
          <span className="text-sm text-[var(--brand-text-secondary)]">
            {case_.relatedUserId ? (
              <span className="font-mono">{case_.relatedUserId.slice(0, 8)}...</span>
            ) : (
              <span className="text-[var(--brand-muted)]">—</span>
            )}
          </span>
        ),
      },
      {
        key: 'assignedTo',
        header: 'Assigned To',
        render: (case_) => (
          <span className="text-sm text-[var(--brand-text-secondary)]">
            {case_.assignedTo ? (
              <span className="font-mono">{case_.assignedTo.slice(0, 8)}...</span>
            ) : (
              <span className="text-[var(--brand-muted)]">Unassigned</span>
            )}
          </span>
        ),
      },
      {
        key: 'openedAt',
        header: 'Opened',
        render: (case_) => (
          <span className="text-sm text-[var(--brand-text-secondary)]">
            {formatDate(case_.openedAt)}
          </span>
        ),
      },
      {
        key: 'tags',
        header: 'Tags',
        render: (case_) => (
          <div className="flex flex-wrap gap-1">
            {case_.tags && case_.tags.length > 0 ? (
              case_.tags.slice(0, 3).map((tag, idx) => (
                <Badge key={idx} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))
            ) : (
              <span className="text-xs text-[var(--brand-muted)]">—</span>
            )}
            {case_.tags && case_.tags.length > 3 && (
              <span className="text-xs text-[var(--brand-muted)]">+{case_.tags.length - 3}</span>
            )}
          </div>
        ),
      },
    ],
    []
  );

  if (loading) {
    return (
      <div className="card-base p-8 text-center">
        <p className="text-sm text-[var(--brand-muted)]">Loading cases...</p>
      </div>
    );
  }

  return (
    <Table
      columns={columns}
      data={cases}
      emptyMessage="No investigation cases found."
      onRowClick={handleRowClick}
    />
  );
}
