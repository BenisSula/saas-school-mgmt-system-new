import { useParams, useNavigate } from 'react-router-dom';
import { RouteMeta } from '../../../../components/layout/RouteMeta';
import { Button } from '../../../../components/ui/Button';
import { InvestigationDetailsPanel } from '../../../../components/superuser/investigations/InvestigationDetailsPanel';
import { InvestigationTimeline } from '../../../../components/superuser/investigations/InvestigationTimeline';
import { InvestigationResolutionPanel } from '../../../../components/superuser/investigations/InvestigationResolutionPanel';
import { InvestigationCaseMetadata } from '../../../../components/superuser/investigations/InvestigationCaseMetadata';
import { DashboardSkeleton } from '../../../../components/ui/DashboardSkeleton';
import { useInvestigationCase } from '../../../../hooks/queries/useInvestigationCases';
import { ArrowLeft, Download } from 'lucide-react';
import { useExportCaseAuditTrail } from '../../../../hooks/queries/useInvestigationCases';

export function InvestigationDetailPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useInvestigationCase(caseId || '');
  const exportAuditTrail = useExportCaseAuditTrail();

  const handleExport = async () => {
    if (!caseId) return;
    try {
      await exportAuditTrail.mutateAsync({ caseId, format: 'json' });
    } catch {
      // Error handled in hook
    }
  };

  if (isLoading) {
    return (
      <RouteMeta title="Loading Case...">
        <DashboardSkeleton />
      </RouteMeta>
    );
  }

  if (error || !data) {
    return (
      <RouteMeta title="Case Not Found">
        <div className="card-base p-8 text-center">
          <p className="text-sm text-[var(--brand-error)]">
            {error ? (error as Error).message : 'Case not found'}
          </p>
          <Button className="mt-4" onClick={() => navigate('/dashboard/superuser/investigations')}>
            Back to Cases
          </Button>
        </div>
      </RouteMeta>
    );
  }

  const { case: case_, notes, evidence } = data;

  return (
    <RouteMeta title={`Case ${case_.caseNumber}`}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/dashboard/superuser/investigations')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-[var(--brand-text-primary)]">
                Case {case_.caseNumber}
              </h1>
              <p className="mt-1 text-sm text-[var(--brand-text-secondary)]">{case_.title}</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleExport} disabled={exportAuditTrail.isPending}>
            <Download className="mr-2 h-4 w-4" />
            Export Audit Trail
          </Button>
        </div>

        {/* Resolution Panel */}
        <InvestigationResolutionPanel case_={case_} onStatusUpdated={() => refetch()} />

        {/* Details */}
        <InvestigationDetailsPanel case_={case_} notes={notes} evidence={evidence} />

        {/* Timeline */}
        <InvestigationTimeline case_={case_} notes={notes} />

        {/* Metadata */}
        <InvestigationCaseMetadata case_={case_} />
      </div>
    </RouteMeta>
  );
}

export default InvestigationDetailPage;
