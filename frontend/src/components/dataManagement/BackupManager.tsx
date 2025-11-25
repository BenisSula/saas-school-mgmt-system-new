import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';

interface BackupJob {
  id: string;
  backup_type: string;
  status: string;
  storage_location: string;
  file_size_bytes?: number;
  created_at: string;
}

interface BackupSchedule {
  id: string;
  name: string;
  backup_type: string;
  schedule_cron: string;
  is_active: boolean;
  next_run_at?: string;
}

export const BackupManager: React.FC = () => {
  const [jobs, setJobs] = useState<BackupJob[]>([]);
  const [schedules, setSchedules] = useState<BackupSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [jobsResult, schedulesResult] = await Promise.all([
        api.dataManagement.getBackups(),
        api.dataManagement.getBackupSchedules(),
      ]);
      setJobs(jobsResult.jobs as BackupJob[]);
      setSchedules(schedulesResult.schedules as BackupSchedule[]);
    } catch (error) {
      console.error('Failed to load backup data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'N/A';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  if (loading) {
    return <div className="p-4">Loading backups...</div>;
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-4">Backup Management</h2>

      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Scheduled Backups</h3>
        <div className="space-y-2">
          {schedules.map((schedule) => (
            <div key={schedule.id} className="border rounded p-3">
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-medium">{schedule.name}</span>
                  <span className="ml-2 text-sm text-gray-600">
                    ({schedule.backup_type}) - {schedule.schedule_cron}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-1 text-xs rounded ${
                      schedule.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {schedule.is_active ? 'Active' : 'Inactive'}
                  </span>
                  {schedule.next_run_at && (
                    <span className="text-sm text-gray-600">
                      Next: {new Date(schedule.next_run_at).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-2">Backup History</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Size
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Location
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{job.backup_type}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs rounded ${
                        job.status === 'completed'
                          ? 'bg-green-100 text-green-800'
                          : job.status === 'failed'
                            ? 'bg-red-100 text-red-800'
                            : job.status === 'running'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {job.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {formatFileSize(job.file_size_bytes)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {job.storage_location}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(job.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
