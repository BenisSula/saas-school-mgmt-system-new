/**
 * General Export Service
 * Handles PDF and Excel exports for various data types
 */

import PDFDocument from 'pdfkit';

export interface ExportDataRow {
  [key: string]: string | number | boolean | null | undefined;
}

export interface ExportOptions {
  data: ExportDataRow[];
  columns: Array<{ key: string; label: string }>;
  title: string;
  filename?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Export data to PDF format
 */
export async function exportToPdf(options: ExportOptions): Promise<Buffer> {
  const { data, columns, title, metadata } = options;
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
  const headers = columns.map(col => col.label || col.key);
  doc.fontSize(12).font('Helvetica-Bold');
  const startY = doc.y;
  const colWidth = (doc.page.width - 100) / headers.length;
  let x = 50;

  for (const header of headers) {
    doc.text(String(header).substring(0, 30), x, startY, { width: colWidth });
    x += colWidth;
  }

  doc.moveDown();
  doc.font('Helvetica');

  // Table rows (limit to prevent huge PDFs)
  const maxRows = 500;
  for (const row of data.slice(0, maxRows)) {
    // Check if we need a new page
    if (doc.y > doc.page.height - 50) {
      doc.addPage();
      // Redraw headers on new page
      x = 50;
      doc.fontSize(12).font('Helvetica-Bold');
      for (const header of headers) {
        doc.text(String(header).substring(0, 30), x, doc.y, { width: colWidth });
        x += colWidth;
      }
      doc.moveDown();
      doc.font('Helvetica');
    }

    x = 50;
    for (const col of columns) {
      const value = row[col.key];
      doc.fontSize(10).text(
        String(value || '').substring(0, 30),
        x,
        doc.y,
        { width: colWidth }
      );
      x += colWidth;
    }
    doc.moveDown(0.5);
  }

  if (data.length > maxRows) {
    doc.moveDown();
    doc.fontSize(10).text(`Note: Showing first ${maxRows} of ${data.length} rows`, { align: 'center' });
  }

  doc.end();

  return new Promise((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

/**
 * Export data to Excel format (CSV with Excel MIME type)
 */
export function exportToExcel(options: ExportOptions): Buffer {
  const { data, columns } = options;
  
  if (data.length === 0) {
    return Buffer.from('');
  }

  // Headers
  const headers = columns.map(col => col.label || col.key);
  const rows: string[] = [headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(',')];

  // Data rows
  for (const row of data) {
    const values = columns.map(col => {
      const value = row[col.key];
      if (value === null || value === undefined) {
        return '';
      }
      return `"${String(value).replace(/"/g, '""')}"`;
    });
    rows.push(values.join(','));
  }

  const csvContent = rows.join('\n');
  
  // Convert to Buffer with UTF-8 BOM for Excel compatibility
  const bom = Buffer.from('\ufeff', 'utf8');
  return Buffer.concat([bom, Buffer.from(csvContent, 'utf8')]);
}

/**
 * Export data to CSV format
 */
export function exportToCsv(options: ExportOptions): Buffer {
  const { data, columns } = options;
  
  if (data.length === 0) {
    return Buffer.from('');
  }

  // Headers
  const headers = columns.map(col => col.label || col.key);
  const rows: string[] = [headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(',')];

  // Data rows
  for (const row of data) {
    const values = columns.map(col => {
      const value = row[col.key];
      if (value === null || value === undefined) {
        return '';
      }
      return `"${String(value).replace(/"/g, '""')}"`;
    });
    rows.push(values.join(','));
  }

  return Buffer.from(rows.join('\n'), 'utf8');
}

