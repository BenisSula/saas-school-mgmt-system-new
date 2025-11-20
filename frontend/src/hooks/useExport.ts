/**
 * Consolidated export hook for all data export needs
 * DRY principle - single source of truth for export functionality
 */

import { useCallback } from 'react';
import { toast } from 'sonner';
import { exportToCSV, exportToJSON } from '../lib/utils/export';
import { defaultDate } from '../lib/utils/date';

export type ExportFormat = 'csv' | 'json' | 'pdf' | 'excel';

export interface ExportOptions<T> {
  data: T[];
  filename: string;
  format: ExportFormat;
  headers?: string[];
  apiEndpoint?: string; // For PDF/Excel backend exports
  apiPayload?: Record<string, unknown>; // Payload for backend export
}

/**
 * Hook for exporting data in various formats
 * Handles both client-side (CSV/JSON) and server-side (PDF/Excel) exports
 */
export function useExport<T extends Record<string, unknown>>() {
  const exportData = useCallback(
    async ({ data, filename, format, headers, apiEndpoint, apiPayload }: ExportOptions<T>) => {
      try {
        // Client-side exports
        if (format === 'csv') {
          exportToCSV(data, filename, headers);
          toast.success('CSV exported successfully');
          return;
        }

        if (format === 'json') {
          exportToJSON(data, filename);
          toast.success('JSON exported successfully');
          return;
        }

        // Server-side exports (PDF/Excel)
        if (format === 'pdf' || format === 'excel') {
          // For now, use CSV as fallback since backend PDF/Excel endpoints need to be implemented
          // When backend endpoints are ready, uncomment and use:
          // if (!apiEndpoint) {
          //   toast.error('Export endpoint not configured');
          //   return;
          // }
          // const blob = await api.superuser.exportReport(apiEndpoint, { format, ...apiPayload });
          // Download blob...
          
          // Suppress unused parameter warnings - will be used when backend endpoints are ready
          void apiEndpoint;
          void apiPayload;
          
          toast.info(`${format.toUpperCase()} export via backend coming soon. Exporting as CSV instead.`);
          exportToCSV(data, filename, headers);
          return;
        }

        toast.error(`Unsupported export format: ${format}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Export failed';
        toast.error(`Export failed: ${errorMessage}`);
      }
    },
    []
  );

  return { exportData };
}

/**
 * Helper to create export handlers for common use cases
 */
export function createExportHandlers<T extends Record<string, unknown>>(
  data: T[],
  baseFilename: string,
  headers?: string[]
) {
  const { exportData } = useExport<T>();

  return {
    exportCSV: () => exportData({ data, filename: `${baseFilename}-${defaultDate()}`, format: 'csv', headers }),
    exportJSON: () => exportData({ data, filename: `${baseFilename}-${defaultDate()}`, format: 'json' }),
    exportPDF: (apiEndpoint?: string, apiPayload?: Record<string, unknown>) =>
      exportData({
        data,
        filename: `${baseFilename}-${defaultDate()}`,
        format: 'pdf',
        headers,
        apiEndpoint,
        apiPayload
      }),
    exportExcel: (apiEndpoint?: string, apiPayload?: Record<string, unknown>) =>
      exportData({
        data,
        filename: `${baseFilename}-${defaultDate()}`,
        format: 'excel',
        headers,
        apiEndpoint,
        apiPayload
      })
  };
}

