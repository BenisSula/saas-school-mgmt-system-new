import React, { useState, useEffect } from 'react';
import { api } from '../../../lib/api';
import { ScheduleReportModal } from './ScheduleReportModal';

interface ScheduledReport {
  id: string;
  name: string;
  scheduleType: 'daily' | 'weekly' | 'monthly' | 'custom';
  exportFormat: 'csv' | 'pdf' | 'excel' | 'json';
  recipients: string[];
  nextRunAt: string;
  lastRunAt?: string;
  isActive: boolean;
}

export const ScheduledReportsManager: React.FC = () => {
  const [scheduledReports, setScheduledReports] = useState<ScheduledReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [selectedReportName, setSelectedReportName] = useState<string>('');

  useEffect(() => {
    loadScheduledReports();
  }, []);

  const loadScheduledReports = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await api.reports.getScheduledReports();
      setScheduledReports(result.scheduledReports as ScheduledReport[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scheduled reports');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (reportId: string, isActive: boolean) => {
    try {
      await api.reports.updateScheduledReport(reportId, { isActive: !isActive });
      loadScheduledReports();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update report');
    }
  };

  const handleDelete = async (reportId: string) => {
    if (!confirm('Are you sure you want to delete this scheduled report?')) {
      return;
    }

    try {
      await api.reports.deleteScheduledReport(reportId);
      loadScheduledReports();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete report');
    }
  };

  if (loading) {
    return <div className="p-6 text-[var(--brand-text-secondary)]">Loading scheduled reports...</div>;
  }

  return (
    <div className="scheduled-reports-manager p-6 bg-[var(--brand-surface)] rounded-lg shadow-md border border-[var(--brand-border)]">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-[var(--brand-text-primary)]">Scheduled Reports</h2>
        <button
          onClick={() => {
            // For now, we need a report ID - in a real scenario, you'd select from available reports
            // For this implementation, we'll show a message that user needs to select a report first
            alert('Please select a report from the "View Reports" tab first, then use the "Schedule" button on that report.');
          }}
          className="px-4 py-2 bg-[var(--brand-success)] text-white rounded hover:opacity-90 transition-opacity"
        >
          Create Scheduled Report
        </button>
      </div>

      {showScheduleModal && selectedReportId && (
        <ScheduleReportModal
          reportId={selectedReportId}
          reportName={selectedReportName}
          isOpen={showScheduleModal}
          onClose={() => {
            setShowScheduleModal(false);
            setSelectedReportId(null);
            setSelectedReportName('');
          }}
          onSuccess={() => {
            loadScheduledReports();
          }}
        />
      )}

      {error && (
        <div className="mb-4 p-3 bg-[var(--brand-error)]/10 text-[var(--brand-error)] border border-[var(--brand-error)]/20 rounded">
          {error}
        </div>
      )}

      {scheduledReports.length === 0 ? (
        <div className="text-center py-8 text-[var(--brand-text-secondary)]">
          No scheduled reports found
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-[var(--brand-border)]">
            <thead>
              <tr className="bg-[var(--brand-surface-secondary)]">
                <th className="border border-[var(--brand-border)] px-4 py-2 text-left text-[var(--brand-text-primary)] font-semibold">Name</th>
                <th className="border border-[var(--brand-border)] px-4 py-2 text-left text-[var(--brand-text-primary)] font-semibold">Schedule</th>
                <th className="border border-[var(--brand-border)] px-4 py-2 text-left text-[var(--brand-text-primary)] font-semibold">Format</th>
                <th className="border border-[var(--brand-border)] px-4 py-2 text-left text-[var(--brand-text-primary)] font-semibold">Recipients</th>
                <th className="border border-[var(--brand-border)] px-4 py-2 text-left text-[var(--brand-text-primary)] font-semibold">Next Run</th>
                <th className="border border-[var(--brand-border)] px-4 py-2 text-left text-[var(--brand-text-primary)] font-semibold">Last Run</th>
                <th className="border border-[var(--brand-border)] px-4 py-2 text-left text-[var(--brand-text-primary)] font-semibold">Status</th>
                <th className="border border-[var(--brand-border)] px-4 py-2 text-left text-[var(--brand-text-primary)] font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {scheduledReports.map((report) => (
                <tr key={report.id} className="hover:bg-[var(--brand-surface-secondary)] transition-colors">
                  <td className="border border-[var(--brand-border)] px-4 py-2 text-[var(--brand-text-primary)]">{report.name}</td>
                  <td className="border border-[var(--brand-border)] px-4 py-2 text-[var(--brand-text-primary)] capitalize">{report.scheduleType}</td>
                  <td className="border border-[var(--brand-border)] px-4 py-2 text-[var(--brand-text-primary)] uppercase">{report.exportFormat}</td>
                  <td className="border border-[var(--brand-border)] px-4 py-2 text-[var(--brand-text-primary)]">
                    {report.recipients.length} recipient(s)
                  </td>
                  <td className="border border-[var(--brand-border)] px-4 py-2 text-[var(--brand-text-primary)]">
                    {new Date(report.nextRunAt).toLocaleString()}
                  </td>
                  <td className="border border-[var(--brand-border)] px-4 py-2 text-[var(--brand-text-primary)]">
                    {report.lastRunAt ? new Date(report.lastRunAt).toLocaleString() : 'Never'}
                  </td>
                  <td className="border border-[var(--brand-border)] px-4 py-2">
                    <span className={`px-2 py-1 rounded ${report.isActive ? 'bg-[var(--brand-success)]/20 text-[var(--brand-success)]' : 'bg-[var(--brand-surface-tertiary)] text-[var(--brand-text-secondary)]'}`}>
                      {report.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="border border-[var(--brand-border)] px-4 py-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleToggleActive(report.id, report.isActive)}
                        className="px-3 py-1 bg-[var(--brand-primary)] text-[var(--brand-primary-contrast)] rounded text-sm hover:bg-[var(--brand-primary-hover)] transition-colors"
                      >
                        {report.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => handleDelete(report.id)}
                        className="px-3 py-1 bg-[var(--brand-error)] text-white rounded text-sm hover:opacity-90 transition-opacity"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

