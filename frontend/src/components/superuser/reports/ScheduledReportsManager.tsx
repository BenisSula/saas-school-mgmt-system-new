import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { api } from '../../../lib/api';

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
  const { user } = useAuth();
  const [scheduledReports, setScheduledReports] = useState<ScheduledReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadScheduledReports();
  }, []);

  const loadScheduledReports = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await api.getScheduledReports();
      setScheduledReports(result.scheduledReports);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scheduled reports');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (reportId: string, isActive: boolean) => {
    try {
      await api.updateScheduledReport(reportId, { isActive: !isActive });
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
      await api.deleteScheduledReport(reportId);
      loadScheduledReports();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete report');
    }
  };

  if (loading) {
    return <div className="p-6">Loading scheduled reports...</div>;
  }

  return (
    <div className="scheduled-reports-manager p-6 bg-white rounded-lg shadow">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Scheduled Reports</h2>
        <button
          onClick={() => {/* Open create modal */}}
          className="px-4 py-2 bg-green-500 text-white rounded"
        >
          Create Scheduled Report
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}

      {scheduledReports.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No scheduled reports found
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-300">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-4 py-2 text-left">Name</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Schedule</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Format</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Recipients</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Next Run</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Last Run</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Status</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {scheduledReports.map((report) => (
                <tr key={report.id} className="hover:bg-gray-50">
                  <td className="border border-gray-300 px-4 py-2">{report.name}</td>
                  <td className="border border-gray-300 px-4 py-2 capitalize">{report.scheduleType}</td>
                  <td className="border border-gray-300 px-4 py-2 uppercase">{report.exportFormat}</td>
                  <td className="border border-gray-300 px-4 py-2">
                    {report.recipients.length} recipient(s)
                  </td>
                  <td className="border border-gray-300 px-4 py-2">
                    {new Date(report.nextRunAt).toLocaleString()}
                  </td>
                  <td className="border border-gray-300 px-4 py-2">
                    {report.lastRunAt ? new Date(report.lastRunAt).toLocaleString() : 'Never'}
                  </td>
                  <td className="border border-gray-300 px-4 py-2">
                    <span className={`px-2 py-1 rounded ${report.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {report.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="border border-gray-300 px-4 py-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleToggleActive(report.id, report.isActive)}
                        className="px-3 py-1 bg-blue-500 text-white rounded text-sm"
                      >
                        {report.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => handleDelete(report.id)}
                        className="px-3 py-1 bg-red-500 text-white rounded text-sm"
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

