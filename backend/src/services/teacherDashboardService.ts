import crypto from 'crypto';
import PDFDocument from 'pdfkit';
import type { PoolClient } from 'pg';
import { assertValidSchemaName } from '../db/tenantManager';

type PdfDoc = InstanceType<typeof PDFDocument>;

export interface TeacherRecord {
  id: string;
  name: string;
  email: string | null;
  subjects: string[];
}

export interface TeacherAssignmentRow {
  assignmentId: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string | null;
  isClassTeacher: boolean;
  metadata: Record<string, unknown>;
}

export interface TeacherClassReport {
  class: {
    id: string;
    name: string;
  };
  studentCount: number;
  attendance: {
    present: number;
    absent: number;
    late: number;
    total: number;
    percentage: number;
  };
  grades: Array<{
    subject: string;
    entries: number;
    average: number;
  }>;
  fees: {
    billed: number;
    paid: number;
    outstanding: number;
  };
  generatedAt: string;
}

function ensureSchema(schema: string) {
  assertValidSchemaName(schema);
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (!value) return fallback;
  if (typeof value === 'object' && value !== null) {
    return value as T;
  }
  try {
    return JSON.parse(String(value)) as T;
  } catch {
    return fallback;
  }
}

export async function findTeacherByEmail(
  client: PoolClient,
  schema: string,
  email: string
): Promise<TeacherRecord | null> {
  ensureSchema(schema);
  const result = await client.query(
    `
      SELECT id, name, email, subjects
      FROM ${schema}.teachers
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1
    `,
    [email]
  );

  if (result.rowCount === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    subjects: parseJson<string[]>(row.subjects, [])
  };
}

export async function listTeacherAssignmentsRows(
  client: PoolClient,
  schema: string,
  teacherId: string
): Promise<TeacherAssignmentRow[]> {
  ensureSchema(schema);
  const result = await client.query(
    `
      SELECT ta.id,
             ta.class_id,
             ta.subject_id,
             ta.is_class_teacher,
             ta.metadata,
             c.name AS class_name,
             s.name AS subject_name,
             s.code AS subject_code
      FROM ${schema}.teacher_assignments ta
      JOIN ${schema}.classes c ON c.id = ta.class_id
      JOIN ${schema}.subjects s ON s.id = ta.subject_id
      WHERE ta.teacher_id = $1
      ORDER BY c.name ASC, s.name ASC
    `,
    [teacherId]
  );

  return result.rows.map((row) => ({
    assignmentId: row.id,
    classId: row.class_id,
    className: row.class_name,
    subjectId: row.subject_id,
    subjectName: row.subject_name,
    subjectCode: row.subject_code,
    isClassTeacher: row.is_class_teacher,
    metadata: parseJson<Record<string, unknown>>(row.metadata, {})
  }));
}

export async function listTeacherClasses(client: PoolClient, schema: string, teacherId: string) {
  const assignments = await listTeacherAssignmentsRows(client, schema, teacherId);
  const grouped = new Map<
    string,
    {
      id: string;
      name: string;
      isClassTeacher: boolean;
      subjects: Array<{ id: string; name: string; code: string | null; assignmentId: string }>;
    }
  >();

  for (const assignment of assignments) {
    const existing = grouped.get(assignment.classId);
    const subjectEntry = {
      id: assignment.subjectId,
      name: assignment.subjectName,
      code: assignment.subjectCode,
      assignmentId: assignment.assignmentId
    };
    if (existing) {
      existing.subjects.push(subjectEntry);
      existing.isClassTeacher = existing.isClassTeacher || assignment.isClassTeacher;
    } else {
      grouped.set(assignment.classId, {
        id: assignment.classId,
        name: assignment.className,
        isClassTeacher: assignment.isClassTeacher,
        subjects: [subjectEntry]
      });
    }
  }

  return Array.from(grouped.values()).map((clazz) => ({
    ...clazz,
    subjects: clazz.subjects.sort((a, b) => a.name.localeCompare(b.name))
  }));
}

function buildAssignmentSummary(row: TeacherAssignmentRow) {
  return {
    assignmentId: row.assignmentId,
    classId: row.classId,
    className: row.className,
    subjectId: row.subjectId,
    subjectName: row.subjectName,
    subjectCode: row.subjectCode,
    isClassTeacher: row.isClassTeacher,
    metadata: row.metadata
  };
}

export async function getTeacherOverview(
  client: PoolClient,
  schema: string,
  teacher: TeacherRecord
) {
  const assignments = await listTeacherAssignmentsRows(client, schema, teacher.id);
  const totalClasses = new Set(assignments.map((assignment) => assignment.classId)).size;
  const totalSubjects = assignments.length;
  const classTeacherRoles = assignments.filter((assignment) => assignment.isClassTeacher).length;
  const pendingDropRequests = assignments.filter(
    (assignment) => assignment.metadata?.dropRequested === true
  ).length;

  return {
    teacher: {
      id: teacher.id,
      name: teacher.name,
      email: teacher.email ?? null
    },
    summary: {
      totalClasses,
      totalSubjects,
      classTeacherRoles,
      pendingDropRequests
    },
    assignments: assignments.map(buildAssignmentSummary)
  };
}

export async function getTeacherClassRoster(
  client: PoolClient,
  schema: string,
  teacherId: string,
  classId: string
) {
  ensureSchema(schema);
  const assignments = await listTeacherAssignmentsRows(client, schema, teacherId);
  const teachesClass = assignments.some((assignment) => assignment.classId === classId);
  if (!teachesClass) {
    return null;
  }

  const result = await client.query(
    `
      SELECT id,
             first_name,
             last_name,
             admission_number,
             parent_contacts,
             class_id,
             class_uuid
      FROM ${schema}.students
      WHERE class_uuid = $1
      ORDER BY last_name ASC, first_name ASC
    `,
    [classId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    first_name: row.first_name,
    last_name: row.last_name,
    admission_number: row.admission_number,
    parent_contacts: parseJson<unknown[]>(row.parent_contacts, []),
    class_id: row.class_id
  }));
}

export async function requestAssignmentDrop(
  client: PoolClient,
  schema: string,
  teacherId: string,
  assignmentId: string
) {
  ensureSchema(schema);
  const assignmentResult = await client.query(
    `
      SELECT id, teacher_id, class_id, subject_id, is_class_teacher, metadata
      FROM ${schema}.teacher_assignments
      WHERE id = $1
    `,
    [assignmentId]
  );

  if (assignmentResult.rowCount === 0) {
    return null;
  }

  const assignmentRow = assignmentResult.rows[0];
  if (assignmentRow.teacher_id !== teacherId) {
    return null;
  }

  const existingMetadata = parseJson<Record<string, unknown>>(assignmentRow.metadata, {});
  const updatedMetadata = {
    ...existingMetadata,
    dropRequested: true,
    dropRequestedAt: new Date().toISOString()
  };

  await client.query(
    `
      UPDATE ${schema}.teacher_assignments
      SET metadata = $1::jsonb, updated_at = NOW()
      WHERE id = $2
    `,
    [JSON.stringify(updatedMetadata), assignmentId]
  );

  const classResult = await client.query(`SELECT name FROM ${schema}.classes WHERE id = $1`, [
    assignmentRow.class_id
  ]);
  const subjectResult = await client.query(
    `SELECT name, code FROM ${schema}.subjects WHERE id = $1`,
    [assignmentRow.subject_id]
  );

  return buildAssignmentSummary({
    assignmentId: assignmentRow.id,
    classId: assignmentRow.class_id,
    className: classResult.rows[0]?.name ?? 'Unknown class',
    subjectId: assignmentRow.subject_id,
    subjectName: subjectResult.rows[0]?.name ?? 'Unknown subject',
    subjectCode: subjectResult.rows[0]?.code ?? null,
    isClassTeacher: assignmentRow.is_class_teacher,
    metadata: updatedMetadata
  });
}

async function ensureTeacherHasClass(
  client: PoolClient,
  schema: string,
  teacherId: string,
  classId: string
) {
  const assignments = await listTeacherAssignmentsRows(client, schema, teacherId);
  return assignments.some((assignment) => assignment.classId === classId);
}

export async function getTeacherClassReport(
  client: PoolClient,
  schema: string,
  teacherId: string,
  classId: string
): Promise<TeacherClassReport | null> {
  ensureSchema(schema);
  const hasClass = await ensureTeacherHasClass(client, schema, teacherId, classId);
  if (!hasClass) {
    return null;
  }

  const classResult = await client.query(`SELECT name FROM ${schema}.classes WHERE id = $1`, [
    classId
  ]);
  const className = classResult.rows[0]?.name ?? 'Class';

  const [studentResult, attendanceResult, gradeResult, feeResult] = await Promise.all([
    client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM ${schema}.students WHERE class_id = $1`,
      [classId]
    ),
    client.query<{ status: 'present' | 'absent' | 'late'; count: string }>(
      `
        SELECT status, COUNT(*)::text AS count
        FROM ${schema}.attendance_records
        WHERE class_id = $1
        GROUP BY status
      `,
      [classId]
    ),
    client.query<{ subject: string; entries: string; average: number }>(
      `
        SELECT subject,
               COUNT(*)::text AS entries,
               AVG(score)::float AS average
        FROM ${schema}.grades
        WHERE class_id = $1
        GROUP BY subject
        ORDER BY subject ASC
      `,
      [classId]
    ),
    client.query<{
      billed: number | null;
      paid: number | null;
    }>(
      `
        SELECT
          SUM(fi.amount)::float AS billed,
          SUM(COALESCE(paid.total_paid, 0))::float AS paid
        FROM ${schema}.fee_invoices fi
        JOIN ${schema}.students s ON s.id = fi.student_id
        LEFT JOIN (
          SELECT invoice_id, SUM(amount) AS total_paid
          FROM ${schema}.payments
          WHERE status = 'succeeded'
          GROUP BY invoice_id
        ) AS paid ON paid.invoice_id = fi.id
        WHERE s.class_id = $1
      `,
      [classId]
    )
  ]);

  const studentCount = Number(studentResult.rows[0]?.count ?? '0');
  const attendanceCounts = attendanceResult.rows.reduce(
    (acc, row) => {
      acc[row.status] = Number(row.count);
      acc.total += Number(row.count);
      return acc;
    },
    { present: 0, absent: 0, late: 0, total: 0 }
  );
  const attendancePercentage =
    attendanceCounts.total === 0
      ? 0
      : Math.round((attendanceCounts.present / attendanceCounts.total) * 100);

  const billed = feeResult.rows[0]?.billed ?? 0;
  const paid = feeResult.rows[0]?.paid ?? 0;

  return {
    class: {
      id: classId,
      name: className
    },
    studentCount,
    attendance: {
      present: attendanceCounts.present,
      absent: attendanceCounts.absent,
      late: attendanceCounts.late,
      total: attendanceCounts.total,
      percentage: attendancePercentage
    },
    grades: gradeResult.rows.map((row) => ({
      subject: row.subject,
      entries: Number(row.entries),
      average: Number.isFinite(row.average) ? Math.round(row.average * 10) / 10 : 0
    })),
    fees: {
      billed,
      paid,
      outstanding: billed - paid
    },
    generatedAt: new Date().toISOString()
  };
}

function streamPdf(doc: PdfDoc): Promise<Buffer> {
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

export async function createClassReportPdf(
  summary: TeacherClassReport,
  teacherName: string
): Promise<Buffer> {
  const doc: PdfDoc = new PDFDocument({ margin: 50 });

  doc.fontSize(18).text('Class Performance Summary', { align: 'center' });
  doc.moveDown();
  doc
    .fontSize(12)
    .text(`Teacher: ${teacherName}`)
    .text(`Class: ${summary.class.name}`)
    .text(`Generated: ${new Date(summary.generatedAt).toLocaleString()}`);

  doc.moveDown().fontSize(14).text('Class Makeup', { underline: true });
  doc.fontSize(12).text(`Students: ${summary.studentCount}`);

  doc.moveDown().fontSize(14).text('Attendance Snapshot', { underline: true });
  doc
    .fontSize(12)
    .text(`Present: ${summary.attendance.present}`)
    .text(`Absent: ${summary.attendance.absent}`)
    .text(`Late: ${summary.attendance.late}`)
    .text(`Attendance Rate: ${summary.attendance.percentage}%`);

  doc.moveDown().fontSize(14).text('Academic Overview', { underline: true });
  if (summary.grades.length === 0) {
    doc.fontSize(12).text('No grades recorded for this class yet.');
  } else {
    summary.grades.forEach((grade) => {
      doc
        .fontSize(12)
        .text(
          `${grade.subject}: ${grade.entries} entries · Average score ${grade.average.toFixed(1)}`
        );
    });
  }

  doc.moveDown().fontSize(14).text('Financial Overview', { underline: true });
  doc
    .fontSize(12)
    .text(`Billed: $${summary.fees.billed.toFixed(2)}`)
    .text(`Paid: $${summary.fees.paid.toFixed(2)}`)
    .text(`Outstanding: $${summary.fees.outstanding.toFixed(2)}`);

  return streamPdf(doc);
}

export async function listTeacherMessages(
  client: PoolClient,
  schema: string,
  teacher: TeacherRecord
) {
  const classes = await listTeacherClasses(client, schema, teacher.id);
  const now = new Date();

  const classroomMessages = classes
    .filter((clazz) => clazz.isClassTeacher)
    .map((clazz) => ({
      id: crypto.randomUUID(),
      title: `Classroom teacher duties for ${clazz.name}`,
      body: `Remember to approve attendance and review weekly progress reports for ${clazz.name}.`,
      classId: clazz.id,
      className: clazz.name,
      timestamp: now.toISOString(),
      status: 'info'
    }));

  const generalMessage = {
    id: crypto.randomUUID(),
    title: 'Staff briefing',
    body: 'Faculty meeting scheduled for Friday at 3:00 PM in the main hall. Please review agenda in advance.',
    classId: null,
    className: null,
    timestamp: now.toISOString(),
    status: 'unread'
  };

  return [generalMessage, ...classroomMessages];
}

export async function getTeacherProfileDetail(
  client: PoolClient,
  schema: string,
  teacher: TeacherRecord
) {
  const classes = await listTeacherClasses(client, schema, teacher.id);
  return {
    id: teacher.id,
    name: teacher.name,
    email: teacher.email ?? null,
    subjects: teacher.subjects,
    classes: classes.map((clazz) => ({
      id: clazz.id,
      name: clazz.name,
      subjects: clazz.subjects.map((subject) => subject.name),
      isClassTeacher: clazz.isClassTeacher
    }))
  };
}
