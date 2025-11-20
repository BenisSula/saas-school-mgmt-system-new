import type { PoolClient } from 'pg';
import PDFDocument from 'pdfkit';
import { assertValidSchemaName } from '../db/tenantManager';
import { termReportSchema } from '../validators/subjectValidator';
import { z } from 'zod';

type TermReportInput = z.infer<typeof termReportSchema>;
type PdfDoc = InstanceType<typeof PDFDocument>;

interface AttendanceReportFilters {
  from?: string;
  to?: string;
  classId?: string;
}

export async function getAttendanceSummary(
  client: PoolClient,
  schema: string,
  filters: AttendanceReportFilters
) {
  assertValidSchemaName(schema);
  const result = await client.query(
    `
      SELECT
        attendance_date,
        class_id,
        status,
        COUNT(*)::int AS count
      FROM ${schema}.attendance_records
      WHERE ($1::date IS NULL OR attendance_date >= $1::date)
        AND ($2::date IS NULL OR attendance_date <= $2::date)
        AND ($3::text IS NULL OR class_id = $3::text)
      GROUP BY attendance_date, class_id, status
      ORDER BY attendance_date DESC, class_id, status
    `,
    [filters.from ?? null, filters.to ?? null, filters.classId ?? null]
  );

  return result.rows;
}

export async function getGradeDistribution(client: PoolClient, schema: string, examId: string) {
  assertValidSchemaName(schema);
  const result = await client.query(
    `
      SELECT
        subject,
        grade,
        COUNT(*)::int AS count,
        AVG(score)::float AS average_score
      FROM ${schema}.grades
      WHERE exam_id = $1
      GROUP BY subject, grade
      ORDER BY subject, grade
    `,
    [examId]
  );

  return result.rows;
}

export async function getFeeOutstanding(client: PoolClient, schema: string, status?: string) {
  assertValidSchemaName(schema);
  const result = await client.query(
    `
      SELECT
        status,
        COUNT(*)::int AS invoice_count,
        SUM(amount)::float AS total_amount,
        SUM(COALESCE(paid.total_paid, 0))::float AS total_paid
      FROM ${schema}.fee_invoices fi
      LEFT JOIN (
        SELECT invoice_id, SUM(amount) AS total_paid
        FROM ${schema}.payments
        WHERE status = 'succeeded'
        GROUP BY invoice_id
      ) AS paid ON paid.invoice_id = fi.id
      WHERE ($1::text IS NULL OR status = $1::text)
      GROUP BY status
      ORDER BY status
    `,
    [status ?? null]
  );

  return result.rows;
}

export async function getDepartmentAnalytics(
  client: PoolClient,
  schema: string,
  departmentId?: string
) {
  assertValidSchemaName(schema);
  
  // Get teachers in department
  const teachersQuery = departmentId
    ? `SELECT COUNT(*)::int AS count FROM teachers WHERE department_id = $1`
    : `SELECT COUNT(*)::int AS count FROM teachers`;
  const teachersResult = await client.query(teachersQuery, departmentId ? [departmentId] : []);

  // Get students in classes taught by department teachers
  const studentsQuery = departmentId
    ? `
      SELECT COUNT(DISTINCT s.id)::int AS count
      FROM students s
      JOIN classes c ON c.id = s.class_id
      JOIN teacher_assignments ta ON ta.class_id = c.id
      JOIN teachers t ON t.id = ta.teacher_id
      WHERE t.department_id = $1
    `
    : `SELECT COUNT(*)::int AS count FROM students`;
  const studentsResult = await client.query(studentsQuery, departmentId ? [departmentId] : []);

  // Get average class size
  const classSizeQuery = departmentId
    ? `
      SELECT AVG(class_size)::float AS avg_size
      FROM (
        SELECT COUNT(s.id) AS class_size
        FROM classes c
        JOIN students s ON s.class_id = c.id
        JOIN teacher_assignments ta ON ta.class_id = c.id
        JOIN teachers t ON t.id = ta.teacher_id
        WHERE t.department_id = $1
        GROUP BY c.id
      ) sizes
    `
    : `
      SELECT AVG(class_size)::float AS avg_size
      FROM (
        SELECT COUNT(s.id) AS class_size
        FROM classes c
        LEFT JOIN students s ON s.class_id = c.id
        GROUP BY c.id
      ) sizes
    `;
  const classSizeResult = await client.query(classSizeQuery, departmentId ? [departmentId] : []);

  return {
    departmentId,
    totalTeachers: teachersResult.rows[0]?.count || 0,
    totalStudents: studentsResult.rows[0]?.count || 0,
    averageClassSize: Math.round((classSizeResult.rows[0]?.avg_size || 0) * 100) / 100
  };
}

interface TermReportSummary {
  student: {
    id: string;
    fullName: string;
    classId: string | null;
    className: string | null;
  };
  term: {
    id: string;
    name: string;
    startsOn: string;
    endsOn: string;
  };
  attendance: {
    present: number;
    absent: number;
    late: number;
    total: number;
    percentage: number;
  };
  academics: Array<{
    subject: string;
    score: number;
    grade: string | null;
  }>;
  fees: {
    billed: number;
    paid: number;
    outstanding: number;
  };
}

async function streamToBuffer(doc: PdfDoc): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer | string) => {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    });
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (error: Error) => reject(error));
    doc.end();
  });
}

async function fetchTermReportSummary(
  client: PoolClient,
  schema: string,
  input: TermReportInput
): Promise<TermReportSummary> {
  assertValidSchemaName(schema);
  const studentResult = await client.query(
    `
      SELECT s.*, c.name AS class_name
      FROM ${schema}.students s
      LEFT JOIN ${schema}.classes c ON c.id = s.class_id
      WHERE s.id = $1
    `,
    [input.studentId]
  );
  if (studentResult.rowCount === 0) {
    throw new Error('Student not found');
  }
  const student = studentResult.rows[0];

  const termResult = await client.query(`SELECT * FROM ${schema}.academic_terms WHERE id = $1`, [
    input.termId
  ]);
  if (termResult.rowCount === 0) {
    throw new Error('Term not found');
  }
  const term = termResult.rows[0];

  const attendanceResult = await client.query(
    `
      SELECT status, COUNT(*)::int AS count
      FROM ${schema}.attendance_records
      WHERE student_id = $1
        AND attendance_date BETWEEN $2 AND $3
      GROUP BY status
    `,
    [input.studentId, term.starts_on, term.ends_on]
  );
  const attendanceCounts = attendanceResult.rows.reduce(
    (acc, row) => {
      acc[row.status as keyof typeof acc] = row.count;
      acc.total += row.count;
      return acc;
    },
    { present: 0, absent: 0, late: 0, total: 0 }
  );
  const attendancePercentage =
    attendanceCounts.total === 0
      ? 0
      : Math.round((attendanceCounts.present / attendanceCounts.total) * 100);

  const academicResult = await client.query(
    `
      SELECT g.subject, g.score::float, g.grade
      FROM ${schema}.grades g
      JOIN ${schema}.exams e ON e.id = g.exam_id
      WHERE g.student_id = $1
        AND e.exam_date BETWEEN $2 AND $3
      ORDER BY g.subject
    `,
    [input.studentId, term.starts_on, term.ends_on]
  );

  const feesResult = await client.query(
    `
      SELECT
        SUM(amount)::float AS billed,
        SUM(
          CASE
            WHEN status = 'paid' THEN amount
            WHEN status = 'partial' THEN amount * 0.5
            ELSE 0
          END
        )::float AS paid
      FROM ${schema}.fee_invoices
      WHERE student_id = $1
        AND (due_date IS NULL OR (due_date BETWEEN $2 AND $3))
    `,
    [input.studentId, term.starts_on, term.ends_on]
  );
  const billed = feesResult.rows[0]?.billed ?? 0;
  const paid = feesResult.rows[0]?.paid ?? 0;

  return {
    student: {
      id: student.id,
      fullName: `${student.first_name} ${student.last_name}`,
      classId: student.class_id ?? null,
      className: student.class_name ?? null
    },
    term: {
      id: term.id,
      name: term.name,
      startsOn: term.starts_on.toISOString(),
      endsOn: term.ends_on.toISOString()
    },
    attendance: {
      present: attendanceCounts.present,
      absent: attendanceCounts.absent,
      late: attendanceCounts.late,
      total: attendanceCounts.total,
      percentage: attendancePercentage
    },
    academics: academicResult.rows.map((row) => ({
      subject: row.subject,
      score: row.score,
      grade: row.grade
    })),
    fees: {
      billed,
      paid,
      outstanding: billed - paid
    }
  };
}

function renderReportPdf(summary: TermReportSummary): PdfDoc {
  const doc = new PDFDocument({ margin: 50 });
  doc.fontSize(18).text('Term Performance Report', { align: 'center' });
  doc.moveDown();
  doc
    .fontSize(12)
    .text(`Student: ${summary.student.fullName}`)
    .text(`Class: ${summary.student.className ?? 'Unassigned'}`)
    .text(`Term: ${summary.term.name}`)
    .text(
      `Dates: ${new Date(summary.term.startsOn).toLocaleDateString()} - ${new Date(
        summary.term.endsOn
      ).toLocaleDateString()}`
    );

  doc.moveDown().fontSize(14).text('Attendance', { underline: true });
  doc
    .fontSize(12)
    .text(`Present: ${summary.attendance.present}`)
    .text(`Absent: ${summary.attendance.absent}`)
    .text(`Late: ${summary.attendance.late}`)
    .text(`Attendance Rate: ${summary.attendance.percentage}%`);

  doc.moveDown().fontSize(14).text('Academic Performance', { underline: true });
  if (summary.academics.length === 0) {
    doc.fontSize(12).text('No exam records captured for this term.');
  } else {
    summary.academics.forEach((row) => {
      doc
        .fontSize(12)
        .text(`${row.subject}: ${row.score.toFixed(1)}${row.grade ? ` (${row.grade})` : ''}`);
    });
  }

  doc.moveDown().fontSize(14).text('Fee Summary', { underline: true });
  doc
    .fontSize(12)
    .text(`Billed: $${summary.fees.billed.toFixed(2)}`)
    .text(`Paid: $${summary.fees.paid.toFixed(2)}`)
    .text(`Outstanding: $${summary.fees.outstanding.toFixed(2)}`);

  return doc;
}

export async function generateTermReport(
  client: PoolClient,
  schema: string,
  input: TermReportInput,
  generatedBy: string | null
) {
  const summary = await fetchTermReportSummary(client, schema, input);
  const pdfDoc = renderReportPdf(summary);
  const pdfBuffer = await streamToBuffer(pdfDoc);
  const pdfPayload = pdfBuffer.toString('base64');

  const result = await client.query(
    `
      INSERT INTO ${schema}.term_reports (student_id, term_id, generated_by, summary, pdf)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `,
    [summary.student.id, summary.term.id, generatedBy, JSON.stringify(summary), pdfPayload]
  );

  return {
    reportId: result.rows[0].id,
    summary,
    pdfBuffer
  };
}

export async function fetchReportPdf(
  client: PoolClient,
  schema: string,
  reportId: string
): Promise<Buffer | null> {
  const result = await client.query(`SELECT pdf FROM ${schema}.term_reports WHERE id = $1`, [
    reportId
  ]);
  if (result.rowCount === 0 || !result.rows[0].pdf) {
    return null;
  }
  return Buffer.from(result.rows[0].pdf as string, 'base64');
}
