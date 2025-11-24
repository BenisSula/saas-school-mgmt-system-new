import { useState, useEffect, useCallback } from 'react';
import { ReportBuilder } from '../../components/superuser/reports/ReportBuilder';
import { ReportViewer } from '../../components/superuser/reports/ReportViewer';
import { ScheduledReportsManager } from '../../components/superuser/reports/ScheduledReportsManager';
import { ScheduleReportModal } from '../../components/superuser/reports/ScheduleReportModal';
import { api } from '../../lib/api';

interface ReportDefinition {
  id: string;
  name: string;
  description?: string;
  category?: string;
}

interface CustomReport {
  id: string;
  name: string;
  description?: string;
}

function SuperuserReportsPage() {
  const [activeTab, setActiveTab] = useState<'builder' | 'viewer' | 'scheduled'>('builder');
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [reportDefinitions, setReportDefinitions] = useState<ReportDefinition[]>([]);
  const [customReports, setCustomReports] = useState<CustomReport[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedReportForSchedule, setSelectedReportForSchedule] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const loadReports = useCallback(async () => {
    setLoadingReports(true);
    setError(null);
    try {
      const [definitionsResult, customResult] = await Promise.all([
        api.reports.getReportDefinitions(),
        api.reports.getCustomReports(),
      ]);
      setReportDefinitions((definitionsResult.reports || []) as ReportDefinition[]);
      setCustomReports((customResult.customReports || []) as CustomReport[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reports');
    } finally {
      setLoadingReports(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'viewer' && !selectedReportId) {
      loadReports();
    }
  }, [activeTab, selectedReportId, loadReports]);

  const handleReportSelect = (reportId: string) => {
    setSelectedReportId(reportId);
  };

  const handleBackToList = () => {
    setSelectedReportId(null);
  };

  return (
    <div className="superuser-reports-page p-6">
      <h1 className="text-3xl font-bold mb-6 text-[var(--brand-text-primary)]">
        Advanced Reports & Analytics
      </h1>

      <div className="mb-4 border-b border-[var(--brand-border)]">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('builder')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'builder'
                ? 'border-b-2 border-[var(--brand-primary)] text-[var(--brand-primary)]'
                : 'text-[var(--brand-text-secondary)] hover:text-[var(--brand-text-primary)]'
            }`}
          >
            Report Builder
          </button>
          <button
            onClick={() => {
              setActiveTab('viewer');
              setSelectedReportId(null);
            }}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'viewer'
                ? 'border-b-2 border-[var(--brand-primary)] text-[var(--brand-primary)]'
                : 'text-[var(--brand-text-secondary)] hover:text-[var(--brand-text-primary)]'
            }`}
          >
            View Reports
          </button>
          <button
            onClick={() => setActiveTab('scheduled')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'scheduled'
                ? 'border-b-2 border-[var(--brand-primary)] text-[var(--brand-primary)]'
                : 'text-[var(--brand-text-secondary)] hover:text-[var(--brand-text-primary)]'
            }`}
          >
            Scheduled Reports
          </button>
        </nav>
      </div>

      {activeTab === 'builder' && (
        <ReportBuilder
          onSave={(reportId) => {
            setSelectedReportId(reportId);
            setActiveTab('viewer');
          }}
        />
      )}

      {activeTab === 'viewer' && (
        <>
          {selectedReportId ? (
            <div>
              <div className="mb-4 flex gap-2">
                <button
                  onClick={handleBackToList}
                  className="px-4 py-2 bg-[var(--brand-surface-tertiary)] text-[var(--brand-surface-contrast)] rounded hover:bg-[var(--brand-border-strong)] transition-colors"
                >
                  ← Back to Reports List
                </button>
                <button
                  onClick={() => {
                    const report = [...reportDefinitions, ...customReports].find(
                      (r) => r.id === selectedReportId
                    );
                    if (report) {
                      setSelectedReportForSchedule({ id: report.id, name: report.name });
                      setShowScheduleModal(true);
                    }
                  }}
                  className="px-4 py-2 bg-[var(--brand-info)] text-white rounded hover:opacity-90 transition-opacity"
                >
                  Schedule Report
                </button>
              </div>
              <ReportViewer reportId={selectedReportId} />
            </div>
          ) : (
            <div className="bg-[var(--brand-surface)] rounded-lg shadow-md border border-[var(--brand-border)] p-6">
              <h2 className="text-2xl font-bold mb-4 text-[var(--brand-text-primary)]">
                Available Reports
              </h2>

              {error && (
                <div className="mb-4 p-3 bg-[var(--brand-error)]/10 text-[var(--brand-error)] border border-[var(--brand-error)]/20 rounded">
                  {error}
                </div>
              )}

              {loadingReports ? (
                <div className="p-6 text-center text-[var(--brand-text-secondary)]">
                  Loading reports...
                </div>
              ) : (
                <>
                  {reportDefinitions.length === 0 && customReports.length === 0 ? (
                    <div className="text-center py-8 text-[var(--brand-text-secondary)]">
                      No reports available. Create a new report using the Report Builder.
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {reportDefinitions.length > 0 && (
                        <div>
                          <h3 className="text-xl font-semibold mb-3 text-[var(--brand-text-primary)]">
                            Report Definitions
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {reportDefinitions.map((report) => (
                              <div
                                key={report.id}
                                className="border border-[var(--brand-border)] rounded-lg p-4 bg-[var(--brand-surface-secondary)] hover:shadow-md hover:bg-[var(--brand-surface-tertiary)] cursor-pointer transition-all"
                                onClick={() => handleReportSelect(report.id)}
                              >
                                <h4 className="font-semibold text-lg mb-2 text-[var(--brand-text-primary)]">
                                  {report.name}
                                </h4>
                                {report.description && (
                                  <p className="text-sm text-[var(--brand-text-secondary)] mb-2">
                                    {report.description}
                                  </p>
                                )}
                                {report.category && (
                                  <span className="inline-block px-2 py-1 bg-[var(--brand-primary-light)] text-[var(--brand-primary)] text-xs rounded">
                                    {report.category}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {customReports.length > 0 && (
                        <div>
                          <h3 className="text-xl font-semibold mb-3 text-[var(--brand-text-primary)]">
                            Custom Reports
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {customReports.map((report) => (
                              <div
                                key={report.id}
                                className="border border-[var(--brand-border)] rounded-lg p-4 bg-[var(--brand-surface-secondary)] hover:shadow-md hover:bg-[var(--brand-surface-tertiary)] cursor-pointer transition-all"
                                onClick={() => handleReportSelect(report.id)}
                              >
                                <h4 className="font-semibold text-lg mb-2 text-[var(--brand-text-primary)]">
                                  {report.name}
                                </h4>
                                {report.description && (
                                  <p className="text-sm text-[var(--brand-text-secondary)] mb-2">
                                    {report.description}
                                  </p>
                                )}
                                <span className="inline-block px-2 py-1 bg-[var(--brand-accent-light)] text-[var(--brand-accent)] text-xs rounded">
                                  Custom
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}

      {activeTab === 'scheduled' && <ScheduledReportsManager />}

      {showScheduleModal && selectedReportForSchedule && (
        <ScheduleReportModal
          reportId={selectedReportForSchedule.id}
          reportName={selectedReportForSchedule.name}
          isOpen={showScheduleModal}
          onClose={() => {
            setShowScheduleModal(false);
            setSelectedReportForSchedule(null);
          }}
          onSuccess={() => {
            setShowScheduleModal(false);
            setSelectedReportForSchedule(null);
            // Optionally reload scheduled reports if on that tab
            if (activeTab === 'scheduled') {
              // Trigger reload in ScheduledReportsManager
            }
          }}
        />
      )}
    </div>
  );
}

export default SuperuserReportsPage;
