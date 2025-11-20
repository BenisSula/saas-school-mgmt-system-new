import React, { useState } from 'react';
import { ReportBuilder } from '../../components/superuser/reports/ReportBuilder';
import { ReportViewer } from '../../components/superuser/reports/ReportViewer';
import { ScheduledReportsManager } from '../../components/superuser/reports/ScheduledReportsManager';

export const SuperuserReportsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'builder' | 'viewer' | 'scheduled'>('builder');
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  return (
    <div className="superuser-reports-page p-6">
      <h1 className="text-3xl font-bold mb-6">Advanced Reports & Analytics</h1>

      <div className="mb-4 border-b">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('builder')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'builder'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Report Builder
          </button>
          <button
            onClick={() => setActiveTab('viewer')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'viewer'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            View Reports
          </button>
          <button
            onClick={() => setActiveTab('scheduled')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'scheduled'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
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

      {activeTab === 'viewer' && selectedReportId && (
        <ReportViewer reportId={selectedReportId} />
      )}

      {activeTab === 'scheduled' && <ScheduledReportsManager />}
    </div>
  );
};
