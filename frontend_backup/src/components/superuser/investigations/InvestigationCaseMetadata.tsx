import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '../../ui/Button';
import type { InvestigationCase } from '../../../lib/api';

export interface InvestigationCaseMetadataProps {
  case_: InvestigationCase;
}

export function InvestigationCaseMetadata({ case_: case_ }: InvestigationCaseMetadataProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const metadataEntries = Object.entries(case_.metadata || {});

  if (metadataEntries.length === 0) {
    return (
      <div className="card-base p-6">
        <h3 className="mb-4 text-lg font-semibold text-[var(--brand-text-primary)]">Metadata</h3>
        <p className="text-sm text-[var(--brand-muted)]">No metadata available.</p>
      </div>
    );
  }

  return (
    <div className="card-base p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[var(--brand-text-primary)]">Metadata</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
        >
          {isExpanded ? (
            <>
              <ChevronUp className="mr-1 h-4 w-4" />
              Collapse
            </>
          ) : (
            <>
              <ChevronDown className="mr-1 h-4 w-4" />
              Expand
            </>
          )}
        </Button>
      </div>

      <div className={`mt-4 space-y-2 ${isExpanded ? 'block' : 'hidden'}`}>
        {metadataEntries.map(([key, value]) => (
          <div key={key} className="flex items-start gap-4 border-b border-[var(--brand-border)] pb-2 last:border-0">
            <dt className="w-1/3 font-medium text-[var(--brand-text-secondary)]">{key}:</dt>
            <dd className="flex-1 text-sm text-[var(--brand-text-primary)]">
              {typeof value === 'object' ? (
                <pre className="overflow-x-auto rounded bg-[var(--brand-surface-secondary)] p-2 text-xs">
                  {JSON.stringify(value, null, 2)}
                </pre>
              ) : (
                String(value)
              )}
            </dd>
          </div>
        ))}
      </div>

      {!isExpanded && (
        <div className="mt-2 text-xs text-[var(--brand-muted)]">
          {metadataEntries.length} metadata {metadataEntries.length === 1 ? 'entry' : 'entries'} available
        </div>
      )}
    </div>
  );
}

