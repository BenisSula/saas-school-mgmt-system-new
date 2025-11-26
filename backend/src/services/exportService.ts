/**
 * Export Service
 * Handles PDF and Excel generation for attendance and grades
 */

import type { PoolClient } from 'pg';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { assertValidSchemaName } from '../db/tenantManager';
// getClassReport removed - not used in export functions
import { checkTeacherAssignment } from '../middleware/verifyTeacherAssignment';

export interface AttendanceExportOptions {
  classId: string;
  from?: string;
  to?: string;
  date?: string;
}

export interface GradesExportOptions {
  classId: string;
  subjectId?: string;
  examId?: string;
  term?: string;
}

/**
 * Generate PDF for attendance report
 */
export async function generateAttendancePDF(
  client: PoolClient,
  schema: string,
  teacherId: string,
  options: AttendanceExportOptions
): Promise<Buffer> {
  assertValidSchemaName(schema);

  // Verify teacher assignment
  if (options.classId) {
    const isAssigned = await checkTeacherAssignment(client, schema, teacherId, options.classId);
    if (!isAssigned) {
      throw new Error('Teacher is not assigned to this class');
    }
  }

  // Get class name
  const classResult = await client.query<{ name: string }>(
    `SELECT name FROM ${schema}.classes WHERE id::text = $1 OR name = $1 LIMIT 1`,
    [options.classId]
  );

  const className = classResult.rows[0]?.name || options.classId;

  // Get attendance data
  let attendanceData: Array<{
    student_name: string;
    admission_number: string | null;
    date: string;
    status: string;
  }> = [];

  if (options.date) {
    // For detailed report, we need to get individual records
    const records = await client.query(
      `
        SELECT 
          s.first_name || ' ' || s.last_name as student_name,
          s.admission_number,
          ar.attendance_date as date,
          ar.status
        FROM ${schema}.attendance_records ar
        JOIN ${schema}.students s ON ar.student_id = s.id
        WHERE ar.class_id = $1 AND ar.attendance_date = $2
        ORDER BY s.last_name, s.first_name
      `,
      [options.classId, options.date]
    );
    attendanceData = records.rows;
  } else {
    // Get attendance records for date range
    const params: unknown[] = [options.classId];
    let query = `
      SELECT 
        s.first_name || ' ' || s.last_name as student_name,
        s.admission_number,
        ar.attendance_date as date,
        ar.status
      FROM ${schema}.attendance_records ar
      JOIN ${schema}.students s ON ar.student_id = s.id
      WHERE ar.class_id = $1
    `;

    if (options.from) {
      params.push(options.from);
      query += ` AND ar.attendance_date >= $${params.length}`;
    }
    if (options.to) {
      params.push(options.to);
      query += ` AND ar.attendance_date <= $${params.length}`;
    }

    query += ` ORDER BY ar.attendance_date DESC, s.last_name, s.first_name`;

    const records = await client.query(query, params);
    attendanceData = records.rows;
  }

  // Generate PDF
  const doc = new PDFDocument({ margin: 50 });
  const buffers: Buffer[] = [];

  doc.on('data', buffers.push.bind(buffers));
  doc.on('end', () => {});

  // Header
  doc.fontSize(20).text('Attendance Report', { align: 'center' });
  doc.moveDown();
  doc.fontSize(12).text(`Class: ${className}`, { align: 'left' });
  if (options.date) {
    doc.text(`Date: ${options.date}`, { align: 'left' });
  } else {
    if (options.from) doc.text(`From: ${options.from}`, { align: 'left' });
    if (options.to) doc.text(`To: ${options.to}`, { align: 'left' });
  }
  doc.moveDown();

  // Table header
  doc.fontSize(10);
  doc.text('Student Name', 50, doc.y);
  doc.text('Admission #', 200, doc.y);
  doc.text('Date', 300, doc.y);
  doc.text('Status', 400, doc.y);
  doc.moveDown(0.5);
  doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
  doc.moveDown(0.3);

  // Table rows
  attendanceData.forEach((row) => {
    if (doc.y > 700) {
      doc.addPage();
    }
    doc.text(row.student_name || 'N/A', 50, doc.y);
    doc.text(row.admission_number || 'N/A', 200, doc.y);
    doc.text(row.date, 300, doc.y);
    doc.text(row.status.toUpperCase(), 400, doc.y);
    doc.moveDown(0.5);
  });

  doc.end();

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

/**
 * Generate Excel for attendance report
 */
export async function generateAttendanceExcel(
  client: PoolClient,
  schema: string,
  teacherId: string,
  options: AttendanceExportOptions
): Promise<Buffer> {
  assertValidSchemaName(schema);

  // Verify teacher assignment
  if (options.classId) {
    const isAssigned = await checkTeacherAssignment(client, schema, teacherId, options.classId);
    if (!isAssigned) {
      throw new Error('Teacher is not assigned to this class');
    }
  }

  // Get class name
  const classResult = await client.query<{ name: string }>(
    `SELECT name FROM ${schema}.classes WHERE id::text = $1 OR name = $1 LIMIT 1`,
    [options.classId]
  );
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  // @ts-expect-error - Intentionally unused variable kept for future use
  const _className = classResult.rows[0]?.name || options.classId;

  // Get attendance data (same as PDF)
  let attendanceData: Array<{
    student_name: string;
    admission_number: string | null;
    date: string;
    status: string;
  }> = [];

  if (options.date) {
    const records = await client.query(
      `
        SELECT 
          s.first_name || ' ' || s.last_name as student_name,
          s.admission_number,
          ar.attendance_date as date,
          ar.status
        FROM ${schema}.attendance_records ar
        JOIN ${schema}.students s ON ar.student_id = s.id
        WHERE ar.class_id = $1 AND ar.attendance_date = $2
        ORDER BY s.last_name, s.first_name
      `,
      [options.classId, options.date]
    );
    attendanceData = records.rows;
  } else {
    const params: unknown[] = [options.classId];
    let query = `
      SELECT 
        s.first_name || ' ' || s.last_name as student_name,
        s.admission_number,
        ar.attendance_date as date,
        ar.status
      FROM ${schema}.attendance_records ar
      JOIN ${schema}.students s ON ar.student_id = s.id
      WHERE ar.class_id = $1
    `;

    if (options.from) {
      params.push(options.from);
      query += ` AND ar.attendance_date >= $${params.length}`;
    }
    if (options.to) {
      params.push(options.to);
      query += ` AND ar.attendance_date <= $${params.length}`;
    }

    query += ` ORDER BY ar.attendance_date DESC, s.last_name, s.first_name`;

    const records = await client.query(query, params);
    attendanceData = records.rows;
  }

  // Generate Excel
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Attendance Report');

  // Header row
  worksheet.addRow(['Student Name', 'Admission Number', 'Date', 'Status']);
  worksheet.getRow(1).font = { bold: true };

  // Data rows
  attendanceData.forEach((row) => {
    worksheet.addRow([
      row.student_name || 'N/A',
      row.admission_number || 'N/A',
      row.date,
      row.status.toUpperCase(),
    ]);
  });

  // Auto-fit columns
  worksheet.columns.forEach((column) => {
    column.width = 20;
  });

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Generate PDF for grades report
 */
export async function generateGradesPDF(
  client: PoolClient,
  schema: string,
  teacherId: string,
  options: GradesExportOptions
): Promise<Buffer> {
  assertValidSchemaName(schema);

  // Verify teacher assignment
  const isAssigned = await checkTeacherAssignment(
    client,
    schema,
    teacherId,
    options.classId,
    options.subjectId || undefined
  );
  if (!isAssigned) {
    throw new Error('Teacher is not assigned to this class/subject');
  }

  // Get class name
  const classResult = await client.query<{ name: string }>(
    `SELECT name FROM ${schema}.classes WHERE id::text = $1 OR name = $1 LIMIT 1`,
    [options.classId]
  );

  const className = classResult.rows[0]?.name || options.classId;

  // Get grades data
  const params: unknown[] = [options.classId];
  let query = `
    SELECT 
      s.first_name || ' ' || s.last_name as student_name,
      s.admission_number,
      g.score,
      g.grade,
      g.remarks,
      sub.name as subject_name,
      e.name as exam_name,
      g.created_at
    FROM ${schema}.grades g
    JOIN ${schema}.students s ON g.student_id = s.id
    LEFT JOIN ${schema}.subjects sub ON g.subject_id = sub.id
    LEFT JOIN ${schema}.exams e ON g.exam_id = e.id
    WHERE g.class_id = $1
  `;

  if (options.subjectId) {
    params.push(options.subjectId);
    query += ` AND g.subject_id = $${params.length}`;
  }
  if (options.examId) {
    params.push(options.examId);
    query += ` AND g.exam_id = $${params.length}`;
  }
  if (options.term) {
    params.push(options.term);
    query += ` AND g.term = $${params.length}`;
  }

  query += ` ORDER BY s.last_name, s.first_name, g.created_at DESC`;

  const gradesResult = await client.query(query, params);
  const gradesData = gradesResult.rows;

  // Generate PDF
  const doc = new PDFDocument({ margin: 50 });
  const buffers: Buffer[] = [];

  doc.on('data', buffers.push.bind(buffers));

  // Header
  doc.fontSize(20).text('Grades Report', { align: 'center' });
  doc.moveDown();
  doc.fontSize(12).text(`Class: ${className}`, { align: 'left' });
  if (options.subjectId) {
    doc.text(`Subject: ${gradesData[0]?.subject_name || options.subjectId}`, { align: 'left' });
  }
  doc.moveDown();

  // Table header
  doc.fontSize(10);
  doc.text('Student Name', 50, doc.y);
  doc.text('Admission #', 200, doc.y);
  doc.text('Subject', 300, doc.y);
  doc.text('Score', 400, doc.y);
  doc.text('Grade', 450, doc.y);
  doc.moveDown(0.5);
  doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
  doc.moveDown(0.3);

  // Table rows
  gradesData.forEach((row) => {
    if (doc.y > 700) {
      doc.addPage();
    }
    doc.text(row.student_name || 'N/A', 50, doc.y);
    doc.text(row.admission_number || 'N/A', 200, doc.y);
    doc.text(row.subject_name || 'N/A', 300, doc.y);
    doc.text(String(row.score || 'N/A'), 400, doc.y);
    doc.text(row.grade || 'N/A', 450, doc.y);
    doc.moveDown(0.5);
  });

  doc.end();

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

/**
 * Generate Excel for grades report
 */
export async function generateGradesExcel(
  client: PoolClient,
  schema: string,
  teacherId: string,
  options: GradesExportOptions
): Promise<Buffer> {
  assertValidSchemaName(schema);

  // Verify teacher assignment
  const isAssigned = await checkTeacherAssignment(
    client,
    schema,
    teacherId,
    options.classId,
    options.subjectId || undefined
  );
  if (!isAssigned) {
    throw new Error('Teacher is not assigned to this class/subject');
  }

  // Get class name
  const classResult = await client.query<{ name: string }>(
    `SELECT name FROM ${schema}.classes WHERE id::text = $1 OR name = $1 LIMIT 1`,
    [options.classId]
  );
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  // @ts-expect-error - Intentionally unused variable kept for future use
  const _className = classResult.rows[0]?.name || options.classId;

  // Get grades data (same as PDF)
  const params: unknown[] = [options.classId];
  let query = `
    SELECT 
      s.first_name || ' ' || s.last_name as student_name,
      s.admission_number,
      g.score,
      g.grade,
      g.remarks,
      sub.name as subject_name,
      e.name as exam_name,
      g.created_at
    FROM ${schema}.grades g
    JOIN ${schema}.students s ON g.student_id = s.id
    LEFT JOIN ${schema}.subjects sub ON g.subject_id = sub.id
    LEFT JOIN ${schema}.exams e ON g.exam_id = e.id
    WHERE g.class_id = $1
  `;

  if (options.subjectId) {
    params.push(options.subjectId);
    query += ` AND g.subject_id = $${params.length}`;
  }
  if (options.examId) {
    params.push(options.examId);
    query += ` AND g.exam_id = $${params.length}`;
  }
  if (options.term) {
    params.push(options.term);
    query += ` AND g.term = $${params.length}`;
  }

  query += ` ORDER BY s.last_name, s.first_name, g.created_at DESC`;

  const gradesResult = await client.query(query, params);
  const gradesData = gradesResult.rows;

  // Generate Excel
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Grades Report');

  // Header row
  worksheet.addRow([
    'Student Name',
    'Admission Number',
    'Subject',
    'Score',
    'Grade',
    'Exam',
    'Date',
  ]);
  worksheet.getRow(1).font = { bold: true };

  // Data rows
  gradesData.forEach((row) => {
    worksheet.addRow([
      row.student_name || 'N/A',
      row.admission_number || 'N/A',
      row.subject_name || 'N/A',
      row.score || 'N/A',
      row.grade || 'N/A',
      row.exam_name || 'N/A',
      row.created_at ? new Date(row.created_at).toLocaleDateString() : 'N/A',
    ]);
  });

  // Auto-fit columns
  worksheet.columns.forEach((column) => {
    column.width = 20;
  });

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
