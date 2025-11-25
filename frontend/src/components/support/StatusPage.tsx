import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';

interface StatusSummary {
  overallStatus: 'operational' | 'degraded' | 'down';
  services: Array<{
    name: string;
    status: 'up' | 'down' | 'degraded';
    uptimePercentage: number;
  }>;
  activeIncidents: Array<{
    id: string;
    title: string;
    status: string;
    severity: string;
    started_at: string;
  }>;
  upcomingMaintenance: Array<{
    id: string;
    title: string;
    scheduled_start: string;
    scheduled_end: string;
  }>;
}

export const StatusPage: React.FC = () => {
  const [summary, setSummary] = useState<StatusSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      setLoading(true);
      const result = await api.support.getStatusPageSummary();
      setSummary(result as StatusSummary);
    } catch (error) {
      console.error('Failed to load status:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'operational':
      case 'up':
        return 'bg-green-100 text-green-800';
      case 'degraded':
        return 'bg-yellow-100 text-yellow-800';
      case 'down':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return <div className="p-4">Loading status...</div>;
  }

  if (!summary) {
    return <div className="p-4">Failed to load status</div>;
  }

  return (
    <div className="p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">System Status</h1>
        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(summary.overallStatus)}`}
          >
            {summary.overallStatus.toUpperCase()}
          </span>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-4">Services</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {summary.services.map((service) => (
            <div key={service.name} className="border rounded p-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold">{service.name}</h3>
                <span
                  className={`px-2 py-1 text-xs rounded-full ${getStatusColor(service.status)}`}
                >
                  {service.status}
                </span>
              </div>
              <div className="text-sm text-gray-600">
                Uptime: {service.uptimePercentage.toFixed(2)}%
              </div>
            </div>
          ))}
        </div>
      </div>

      {summary.activeIncidents.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-4">Active Incidents</h2>
          <div className="space-y-4">
            {summary.activeIncidents.map((incident) => (
              <div key={incident.id} className="border-l-4 border-red-500 bg-red-50 p-4 rounded">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold">{incident.title}</h3>
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${getStatusColor(incident.severity)}`}
                  >
                    {incident.severity}
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  Started: {new Date(incident.started_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {summary.upcomingMaintenance.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Scheduled Maintenance</h2>
          <div className="space-y-4">
            {summary.upcomingMaintenance.map((maintenance) => (
              <div
                key={maintenance.id}
                className="border-l-4 border-yellow-500 bg-yellow-50 p-4 rounded"
              >
                <h3 className="font-semibold mb-2">{maintenance.title}</h3>
                <p className="text-sm text-gray-600">
                  Scheduled: {new Date(maintenance.scheduled_start).toLocaleString()} -{' '}
                  {new Date(maintenance.scheduled_end).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
