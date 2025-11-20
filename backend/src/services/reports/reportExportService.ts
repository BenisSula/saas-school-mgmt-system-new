import type { PoolClient } from 'pg';
import PDFDocument from 'pdfkit';
import { ReportExecutionResult } from './reportGenerationService';
import { queueEmail } from '../email/emailService';

/**
 * Export report data to CSV format
 */
export function exportToCsv(
  data: unknown[],
  columns: Array<{ name: string; label: string }>
): string {
  if (data.length === 0) {
    return '';
  }

  // Use provided columns or infer from first row
  const headers = columns.length > 0
    ? columns.map(col => col.label || col.name)
    : Object.keys(data[0] as Record<string, unknown>);

  const rows: string[] = [headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(',')];

  for (const row of data) {
    const values = headers.map(header => {
      const value = (row as Record<string, unknown>)[header];
      if (value === null || value === undefined) {
        return '';
      }
      return `"${String(value).replace(/"/g, '""')}"`;
    });
    rows.push(values.join(','));
  }

  return rows.join('\n');
}

/**
 * Export report data to PDF format
 */
export async function exportToPdf(
  data: unknown[],
  columns: Array<{ name: string; label: string }>,
  title: string = 'Report',
  metadata?: Record<string, unknown>
): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 50 });
  const chunks: Buffer[] = [];

  doc.on('data', (chunk: Buffer) => chunks.push(chunk));

  // Header
  doc.fontSize(18).text(title, { align: 'center' });
  doc.moveDown();

  if (metadata) {
    doc.fontSize(10);
    for (const [key, value] of Object.entries(metadata)) {
      doc.text(`${key}: ${String(value)}`);
    }
    doc.moveDown();
  }

  if (data.length === 0) {
    doc.fontSize(12).text('No data available', { align: 'center' });
    doc.end();
    return new Promise((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  // Table header
  const headers = columns.length > 0
    ? columns.map(col => col.label || col.name)
    : Object.keys(data[0] as Record<string, unknown>);

  doc.fontSize(12).font('Helvetica-Bold');
  const startY = doc.y;
  const colWidth = (doc.page.width - 100) / headers.length;
  let x = 50;

  for (const header of headers) {
    doc.text(String(header).substring(0, 20), x, startY, { width: colWidth });
    x += colWidth;
  }

  doc.moveDown();
  doc.font('Helvetica');

  // Table rows
  for (const row of data.slice(0, 100)) { // Limit to 100 rows for PDF
    x = 50;
    for (const header of headers) {
      const value = (row as Record<string, unknown>)[header];
      doc.fontSize(10).text(
        String(value || '').substring(0, 20),
        x,
        doc.y,
        { width: colWidth }
      );
      x += colWidth;
    }
    doc.moveDown(0.5);

    // New page if needed
    if (doc.y > doc.page.height - 50) {
      doc.addPage();
      doc.fontSize(12).font('Helvetica-Bold');
      x = 50;
      for (const header of headers) {
        doc.text(String(header).substring(0, 20), x, doc.y, { width: colWidth });
        x += colWidth;
      }
      doc.moveDown();
      doc.font('Helvetica');
    }
  }

  if (data.length > 100) {
    doc.moveDown();
    doc.fontSize(10).text(`... and ${data.length - 100} more rows`, { align: 'center' });
  }

  doc.end();

  return new Promise((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

/**
 * Export report data to Excel format (CSV with Excel MIME type)
 * Note: For true Excel format, you'd need a library like exceljs
 */
export function exportToExcel(
  data: unknown[],
  columns: Array<{ name: string; label: string }>
): string {
  // Return CSV format (Excel can open CSV files)
  // In production, use exceljs library for true .xlsx format
  return exportToCsv(data, columns);
}

/**
 * Generate export and store URL
 */
export async function generateExport(
  client: PoolClient,
  executionId: string,
  format: 'csv' | 'pdf' | 'excel' | 'json',
  title: string = 'Report'
): Promise<{ url: string; expiresAt: Date }> {
  // Get execution data
  const executionResult = await client.query(
    `
      SELECT re.*, rd.name as report_name
      FROM shared.report_executions re
      JOIN shared.report_definitions rd ON rd.id = re.report_definition_id
      WHERE re.id = $1
    `,
    [executionId]
  );

  if (executionResult.rowCount === 0) {
    throw new Error('Report execution not found');
  }

  const execution = executionResult.rows[0];
  const data = execution.data || [];

  // Generate export based on format
  let exportBuffer: Buffer;
  let mimeType: string;
  let fileExtension: string;

  switch (format) {
    case 'csv':
      exportBuffer = Buffer.from(exportToCsv(data, execution.columns || []));
      mimeType = 'text/csv';
      fileExtension = 'csv';
      break;
    case 'pdf':
      exportBuffer = await exportToPdf(
        data,
        execution.columns || [],
        title || execution.report_name,
        {
          generatedAt: execution.started_at,
          rowCount: execution.row_count
        }
      );
      mimeType = 'application/pdf';
      fileExtension = 'pdf';
      break;
    case 'excel':
      exportBuffer = Buffer.from(exportToExcel(data, execution.columns || []));
      mimeType = 'application/vnd.ms-excel';
      fileExtension = 'xlsx';
      break;
    case 'json':
      exportBuffer = Buffer.from(JSON.stringify(data, null, 2));
      mimeType = 'application/json';
      fileExtension = 'json';
      break;
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }

  // Store export URL (in production, upload to S3 or similar)
  const exportUrl = `/api/reports/exports/${executionId}.${fileExtension}`;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days

  // Update execution with export URL
  await client.query(
    `
      UPDATE shared.report_executions
      SET export_url = $1,
          export_expires_at = $2,
          export_format = $3
      WHERE id = $4
    `,
    [exportUrl, expiresAt, format, executionId]
  );

  // TODO: Store export file in S3 or file storage
  // For now, we'll return the URL and the file can be generated on-demand

  return { url: exportUrl, expiresAt };
}

/**
 * Send report via email
 */
export async function sendReportViaEmail(
  client: PoolClient,
  executionId: string,
  recipients: string[],
  format: 'csv' | 'pdf' | 'excel' | 'json' = 'pdf',
  tenantId?: string
): Promise<void> {
  // Get execution
  const executionResult = await client.query(
    `
      SELECT re.*, rd.name as report_name, rd.description as report_description
      FROM shared.report_executions re
      JOIN shared.report_definitions rd ON rd.id = re.report_definition_id
      WHERE re.id = $1
    `,
    [executionId]
  );

  if (executionResult.rowCount === 0) {
    throw new Error('Report execution not found');
  }

  const execution = executionResult.rows[0];

  // Generate export
  const { url } = await generateExport(client, executionId, format, execution.report_name);

  // Send email to each recipient
  for (const recipient of recipients) {
    await queueEmail(client, {
      tenantId,
      templateKey: 'report_delivery',
      recipientEmail: recipient,
      variables: {
        reportName: execution.report_name,
        reportDescription: execution.report_description || '',
        rowCount: execution.row_count || 0,
        generatedAt: new Date(execution.started_at).toLocaleString(),
        downloadUrl: url,
        format: format.toUpperCase()
      }
    });
  }
}

