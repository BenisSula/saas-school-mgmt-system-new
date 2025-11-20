import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { api } from '../../../lib/api';

interface ReportViewerProps {
  reportId: string;
  parameters?: Record<string, unknown>;
}

export const ReportViewer: React.FC<ReportViewerProps> = ({ reportId, parameters = {} }) => {
  const { user } = useAuth();
  const [data, setData] = useState<unknown[]>([]);
  const [columns, setColumns] = useState<Array<{ name: string; label: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadReport();
  }, [reportId, parameters]);

  const loadReport = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await api.executeReport(reportId, parameters);
      setData(result.data);
      setColumns(result.columns);
      setExecutionId(result.executionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: 'csv' | 'pdf' | 'excel' | 'json') => {
    if (!executionId) return;

    setExporting(true);
    try {
      const exportResult = await api.exportReport(executionId, format);
      // Download file
      window.open(exportResult.url, '_blank');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export report');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return <div className="p-6">Loading report...</div>;
  }

  if (error) {
    return (
      <div className="p-6 bg-red-100 text-red-700 rounded">
        {error}
      </div>
    );
  }

  return (
    <div className="report-viewer p-6 bg-white rounded-lg shadow">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Report Results</h2>
        <div className="flex gap-2">
          <button
            onClick={() => handleExport('csv')}
            disabled={exporting}
            className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
          >
            Export CSV
          </button>
          <button
            onClick={() => handleExport('pdf')}
            disabled={exporting}
            className="px-4 py-2 bg-red-500 text-white rounded disabled:opacity-50"
          >
            Export PDF
          </button>
          <button
            onClick={() => handleExport('excel')}
            disabled={exporting}
            className="px-4 py-2 bg-green-500 text-white rounded disabled:opacity-50"
          >
            Export Excel
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              {columns.map((col, index) => (
                <th key={index} className="border border-gray-300 px-4 py-2 text-left">
                  {col.label || col.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="border border-gray-300 px-4 py-8 text-center text-gray-500">
                  No data available
                </td>
              </tr>
            ) : (
              data.map((row, rowIndex) => (
                <tr key={rowIndex} className="hover:bg-gray-50">
                  {columns.map((col, colIndex) => (
                    <td key={colIndex} className="border border-gray-300 px-4 py-2">
                      {String((row as Record<string, unknown>)[col.name] || '')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-sm text-gray-600">
        Total rows: {data.length}
      </div>
    </div>
  );
};

