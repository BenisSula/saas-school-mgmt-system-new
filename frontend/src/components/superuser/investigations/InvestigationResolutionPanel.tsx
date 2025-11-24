import { useState } from 'react';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Select } from '../../ui/Select';
import { Textarea } from '../../ui/Textarea';
import { Modal } from '../../ui/Modal';
import { useUpdateCaseStatus } from '../../../hooks/queries/useInvestigationCases';
import type { InvestigationCase } from '../../../lib/api';

export interface InvestigationResolutionPanelProps {
  case_: InvestigationCase;
  onStatusUpdated?: () => void;
}

export function InvestigationResolutionPanel({
  case_,
  onStatusUpdated,
}: InvestigationResolutionPanelProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [status, setStatus] = useState<InvestigationCase['status']>(case_.status);
  const [resolution, setResolution] = useState(case_.resolution || '');
  const [resolutionNotes, setResolutionNotes] = useState(case_.resolutionNotes || '');
  const updateStatus = useUpdateCaseStatus();

  const handleSubmit = async () => {
    try {
      await updateStatus.mutateAsync({
        caseId: case_.id,
        status,
        resolution: resolution || undefined,
        resolutionNotes: resolutionNotes || undefined,
      } as Parameters<typeof updateStatus.mutateAsync>[0]);
      setIsModalOpen(false);
      if (onStatusUpdated) {
        onStatusUpdated();
      }
    } catch {
      // Error handling is done in the hook
    }
  };

  const canResolve = case_.status !== 'resolved' && case_.status !== 'closed';
  const canClose = case_.status === 'resolved';

  return (
    <div className="card-base p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[var(--brand-text-primary)]">Case Resolution</h3>
        <div className="flex gap-2">
          {canResolve && (
            <Button
              variant="solid"
              onClick={() => {
                setStatus('resolved');
                setIsModalOpen(true);
              }}
            >
              Mark as Resolved
            </Button>
          )}
          {canClose && (
            <Button
              variant="outline"
              onClick={() => {
                setStatus('closed');
                setIsModalOpen(true);
              }}
            >
              Close Case
            </Button>
          )}
          {(canResolve || canClose) && (
            <Button variant="outline" onClick={() => setIsModalOpen(true)}>
              Update Status
            </Button>
          )}
        </div>
      </div>

      {case_.status === 'resolved' && (
        <div className="mt-4 space-y-2">
          {case_.resolution && (
            <div>
              <label className="text-sm font-medium text-[var(--brand-text-secondary)]">
                Resolution:
              </label>
              <p className="mt-1 text-sm text-[var(--brand-text-primary)]">{case_.resolution}</p>
            </div>
          )}
          {case_.resolutionNotes && (
            <div>
              <label className="text-sm font-medium text-[var(--brand-text-secondary)]">
                Resolution Notes:
              </label>
              <p className="mt-1 text-sm text-[var(--brand-text-primary)] whitespace-pre-wrap">
                {case_.resolutionNotes}
              </p>
            </div>
          )}
        </div>
      )}

      <Modal
        title="Update Case Status"
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="solid" onClick={handleSubmit} disabled={updateStatus.isPending}>
              {updateStatus.isPending ? 'Updating...' : 'Update Status'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Select
              label="Status *"
              value={status}
              onChange={(e) => setStatus(e.target.value as InvestigationCase['status'])}
              options={[
                { label: 'Open', value: 'open' },
                { label: 'Investigating', value: 'investigating' },
                { label: 'Resolved', value: 'resolved' },
                { label: 'Closed', value: 'closed' },
              ]}
            />
          </div>

          {(status === 'resolved' || status === 'closed') && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1 text-[var(--brand-text-primary)]">
                  Resolution
                </label>
                <Input
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  placeholder="Brief resolution summary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-[var(--brand-text-primary)]">
                  Resolution Notes
                </label>
                <Textarea
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Detailed resolution notes"
                  rows={4}
                />
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
