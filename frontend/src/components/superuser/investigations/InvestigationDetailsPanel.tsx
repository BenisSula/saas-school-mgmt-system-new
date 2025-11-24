import { useMemo } from 'react';
import { Badge } from '../../ui/Badge';
import { formatDateTime } from '../../../lib/utils/date';
import type { InvestigationCase, CaseNote, CaseEvidence } from '../../../lib/api';

export interface InvestigationDetailsPanelProps {
  case_: InvestigationCase;
  notes?: CaseNote[];
  evidence?: CaseEvidence[];
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

export function InvestigationDetailsPanel({
  case_,
  notes = [],
  evidence = [],
}: InvestigationDetailsPanelProps) {
  const fieldGroups = useMemo(
    () => [
      {
        title: 'Case Information',
        fields: [
          { label: 'Case Number', value: case_.caseNumber, type: 'text' },
          { label: 'Title', value: case_.title, type: 'text' },
          { label: 'Description', value: case_.description || '—', type: 'text' },
          { label: 'Type', value: caseTypeLabels[case_.caseType], type: 'badge' },
          {
            label: 'Priority',
            value: case_.priority.toUpperCase(),
            type: 'badge',
            badgeClass: priorityColors[case_.priority],
          },
          {
            label: 'Status',
            value: case_.status.charAt(0).toUpperCase() + case_.status.slice(1),
            type: 'badge',
            badgeClass: statusColors[case_.status],
          },
        ],
      },
      {
        title: 'Assignment',
        fields: [
          {
            label: 'Created By',
            value: case_.createdBy ? `${case_.createdBy.slice(0, 8)}...` : '—',
            type: 'text',
          },
          {
            label: 'Assigned To',
            value: case_.assignedTo ? `${case_.assignedTo.slice(0, 8)}...` : 'Unassigned',
            type: 'text',
          },
          {
            label: 'Resolved By',
            value: case_.resolvedBy ? `${case_.resolvedBy.slice(0, 8)}...` : '—',
            type: 'text',
          },
        ],
      },
      {
        title: 'Related Entities',
        fields: [
          {
            label: 'Related User ID',
            value: case_.relatedUserId ? `${case_.relatedUserId.slice(0, 8)}...` : '—',
            type: 'text',
          },
          {
            label: 'Related Tenant ID',
            value: case_.relatedTenantId ? `${case_.relatedTenantId.slice(0, 8)}...` : '—',
            type: 'text',
          },
        ],
      },
      {
        title: 'Timeline',
        fields: [
          { label: 'Opened At', value: formatDateTime(case_.openedAt), type: 'text' },
          {
            label: 'Investigated At',
            value: case_.investigatedAt ? formatDateTime(case_.investigatedAt) : '—',
            type: 'text',
          },
          {
            label: 'Resolved At',
            value: case_.resolvedAt ? formatDateTime(case_.resolvedAt) : '—',
            type: 'text',
          },
          {
            label: 'Closed At',
            value: case_.closedAt ? formatDateTime(case_.closedAt) : '—',
            type: 'text',
          },
        ],
      },
      {
        title: 'Resolution',
        fields: [
          { label: 'Resolution', value: case_.resolution || '—', type: 'text' },
          { label: 'Resolution Notes', value: case_.resolutionNotes || '—', type: 'text' },
        ],
      },
      {
        title: 'Tags',
        fields: [
          {
            label: 'Tags',
            value: case_.tags && case_.tags.length > 0 ? case_.tags.join(', ') : '—',
            type: 'tags',
            tags: case_.tags || [],
          },
        ],
      },
      {
        title: 'Statistics',
        fields: [
          { label: 'Notes Count', value: String(notes.length), type: 'text' },
          { label: 'Evidence Count', value: String(evidence.length), type: 'text' },
          { label: 'Created At', value: formatDateTime(case_.createdAt), type: 'text' },
          { label: 'Updated At', value: formatDateTime(case_.updatedAt), type: 'text' },
        ],
      },
    ],
    [case_, notes.length, evidence.length]
  );

  return (
    <div className="space-y-6">
      {fieldGroups.map((group, groupIndex) => (
        <div key={groupIndex} className="card-base p-6">
          <h3 className="mb-4 text-lg font-semibold text-[var(--brand-text-primary)]">
            {group.title}
          </h3>
          <dl className="space-y-3">
            {group.fields.map((field, fieldIndex) => (
              <div
                key={fieldIndex}
                className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-4"
              >
                <dt className="w-full text-sm font-medium text-[var(--brand-text-secondary)] sm:w-1/3">
                  {field.label}:
                </dt>
                <dd className="flex-1 text-sm text-[var(--brand-text-primary)]">
                  {field.type === 'badge' ? (
                    <Badge className={'badgeClass' in field ? field.badgeClass || '' : ''}>
                      {field.value}
                    </Badge>
                  ) : field.type === 'tags' && 'tags' in field && field.tags ? (
                    <div className="flex flex-wrap gap-1">
                      {field.tags.map((tag: string, idx: number) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="whitespace-pre-wrap">{field.value}</span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}
