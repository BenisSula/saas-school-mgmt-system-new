import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../lib/api';

interface ReportViewerProps {
  reportId: string;
  parameters?: Record<string, unknown>;
}

export const ReportViewer: React.FC<ReportViewerProps> = ({ reportId, parameters = {} }) => {
  const [data, setData] = useState<unknown[]>([]);
  const [columns, setColumns] = useState<Array<{ name: string; label: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Try to determine if this is a custom report or report definition
      // First try as custom report
      try {
        const customResult = await api.reports.executeCustomReport(reportId);
        setData(customResult.data || []);
        setColumns(
          (customResult.columns || []).map((col) => ({
            name: col.name,
            label: col.label || col.name,
          }))
        );
        setExecutionId(customResult.executionId || reportId);
      } catch (customErr) {
        // If custom report fails, try as report definition
        try {
          const result = await api.reports.executeReport(reportId, parameters);
          setData(result.data || []);
          setColumns(
            (result.columns || []).map((col) => ({ name: col.name, label: col.label || col.name }))
          );
          setExecutionId(result.executionId);
        } catch {
          throw new Error(
            `Report not found: ${customErr instanceof Error ? customErr.message : 'Unknown error'}`
          );
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [reportId, parameters]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const handleExport = async (format: 'csv' | 'pdf' | 'excel' | 'json') => {
    if (!executionId) return;

    setExporting(true);
    try {
      const exportResult = await api.reports.exportReport(executionId, format);
      // Download file
      window.open(exportResult.url, '_blank');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export report');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-[var(--brand-text-secondary)]">Loading report...</div>;
  }

  if (error) {
    return (
      <div className="p-6 bg-[var(--brand-error)]/10 text-[var(--brand-error)] border border-[var(--brand-error)]/20 rounded">
        {error}
      </div>
    );
  }

  return (
    <div className="report-viewer p-6 bg-[var(--brand-surface)] rounded-lg shadow-md border border-[var(--brand-border)]">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-[var(--brand-text-primary)]">Report Results</h2>
        <div className="flex gap-2">
          <button
            onClick={() => handleExport('csv')}
            disabled={exporting}
            className="px-4 py-2 bg-[var(--brand-primary)] text-[var(--brand-primary-contrast)] rounded hover:bg-[var(--brand-primary-hover)] disabled:opacity-50 transition-colors"
          >
            Export CSV
          </button>
          <button
            onClick={() => handleExport('pdf')}
            disabled={exporting}
            className="px-4 py-2 bg-[var(--brand-error)] text-white rounded hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            Export PDF
          </button>
          <button
            onClick={() => handleExport('excel')}
            disabled={exporting}
            className="px-4 py-2 bg-[var(--brand-success)] text-white rounded hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            Export Excel
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-[var(--brand-border)]">
          <thead>
            <tr className="bg-[var(--brand-surface-secondary)]">
              {columns.map((col, index) => (
                <th
                  key={index}
                  className="border border-[var(--brand-border)] px-4 py-2 text-left text-[var(--brand-text-primary)] font-semibold"
                >
                  {col.label || col.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="border border-[var(--brand-border)] px-4 py-8 text-center text-[var(--brand-text-secondary)]"
                >
                  No data available
                </td>
              </tr>
            ) : (
              data.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className="hover:bg-[var(--brand-surface-secondary)] transition-colors"
                >
                  {columns.map((col, colIndex) => (
                    <td
                      key={colIndex}
                      className="border border-[var(--brand-border)] px-4 py-2 text-[var(--brand-text-primary)]"
                    >
                      {String((row as Record<string, unknown>)[col.name] || '')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-sm text-[var(--brand-text-secondary)]">
        Total rows: {data.length}
      </div>
    </div>
  );
};
