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
          // If apiEndpoint and apiPayload are provided, use backend export
          if (apiEndpoint && apiPayload) {
            try {
              const response = await fetch(apiEndpoint, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
                },
                body: JSON.stringify({
                  format,
                  ...apiPayload,
                }),
              });

              if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Export failed: ${errorText || response.statusText}`);
              }

              const blob = await response.blob();
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${filename}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              window.URL.revokeObjectURL(url);

              toast.success(`${format.toUpperCase()} exported successfully`);
              return;
            } catch (error) {
              console.error('Export error:', error);
              toast.error(
                `Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`
              );
              // Fallback to CSV
              toast.info('Falling back to CSV export');
              exportToCSV(data, filename, headers);
              return;
            }
          }

          // If no backend endpoint, fallback to CSV
          toast.info(
            `${format.toUpperCase()} export requires backend endpoint. Exporting as CSV instead.`
          );
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
 * This is a non-hook function that can be used anywhere
 */
export function createExportHandlers<T extends Record<string, unknown>>(
  data: T[],
  baseFilename: string,
  headers?: string[]
) {
  const filename = `${baseFilename}-${defaultDate()}`;

  return {
    exportCSV: () => {
      exportToCSV(data, filename, headers);
      toast.success('CSV exported successfully');
    },
    exportJSON: () => {
      exportToJSON(data, filename);
      toast.success('JSON exported successfully');
    },
    exportPDF: async (apiEndpoint?: string, apiPayload?: Record<string, unknown>) => {
      if (apiEndpoint && apiPayload) {
        try {
          const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            },
            body: JSON.stringify({
              format: 'pdf',
              ...apiPayload,
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Export failed: ${errorText || response.statusText}`);
          }

          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${filename}.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);

          toast.success('PDF exported successfully');
        } catch (error) {
          console.error('Export error:', error);
          toast.error(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          // Fallback to CSV
          toast.info('Falling back to CSV export');
          exportToCSV(data, filename, headers);
        }
      } else {
        toast.info('PDF export requires backend endpoint. Exporting as CSV instead.');
        exportToCSV(data, filename, headers);
      }
    },
    exportExcel: async (apiEndpoint?: string, apiPayload?: Record<string, unknown>) => {
      if (apiEndpoint && apiPayload) {
        try {
          const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            },
            body: JSON.stringify({
              format: 'excel',
              ...apiPayload,
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Export failed: ${errorText || response.statusText}`);
          }

          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${filename}.xlsx`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);

          toast.success('Excel exported successfully');
        } catch (error) {
          console.error('Export error:', error);
          toast.error(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          // Fallback to CSV
          toast.info('Falling back to CSV export');
          exportToCSV(data, filename, headers);
        }
      } else {
        toast.info('Excel export requires backend endpoint. Exporting as CSV instead.');
        exportToCSV(data, filename, headers);
      }
    },
  };
}
