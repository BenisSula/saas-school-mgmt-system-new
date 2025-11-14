import type { PoolClient } from 'pg';
import { assertValidSchemaName } from '../db/tenantManager';
import { listStudentSubjects, recordPromotion } from './subjectService';
import { generateTermReport, fetchReportPdf } from './reportService';

interface StudentSubjectRow {
  subject_id: string;
  name: string;
  code: string | null;
  metadata: unknown;
}

interface StudentSubjectSummary {
  subjectId: string;
  name: string;
  code: string | null;
  dropRequested: boolean;
  dropStatus: 'pending' | 'approved' | 'rejected' | 'none';
  dropRequestedAt: string | null;
}

interface StudentExamSummary {
  examId: string;
  name: string;
  examDate: string | null;
  averageScore: number | null;
  subjectCount: number;
}

export interface StudentProfileDetail {
  id: string;
  firstName: string;
  lastName: string;
  classId: string | null;
  className: string | null;
  admissionNumber: string | null;
  parentContacts: unknown[];
  subjects: StudentSubjectSummary[];
}

export interface StudentMessage {
  id: string;
  title: string;
  body: string;
  className: string | null;
  status: 'unread' | 'read' | 'info';
  sentAt: string;
}

export interface StudentTermSummary {
  id: string;
  name: string;
  startsOn: string | null;
  endsOn: string | null;
}

export interface StudentTermReportRecord {
  id: string;
  termId: string | null;
  generatedAt: string;
  summary: unknown;
}

function tableName(schema: string, table: string) {
  assertValidSchemaName(schema);
  return `${schema}.${table}`;
}

function parseJson<T>(input: unknown, fallback: T): T {
  if (typeof input === 'string') {
    try {
      return JSON.parse(input) as T;
    } catch {
      return fallback;
    }
  }
  if (input && typeof input === 'object') {
    return input as T;
  }
  return fallback;
}

function toUuid(value: string): string {
  if (!value || typeof value !== 'string') {
    throw new Error('Invalid identifier');
  }
  return value;
}

async function ensureStudentExists(client: PoolClient, schema: string, studentId: string) {
  const result = await client.query(
    `SELECT id FROM ${tableName(schema, 'students')} WHERE id = $1`,
    [studentId]
  );
  if (result.rowCount === 0) {
    throw new Error('Student profile not found');
  }
}

export async function listStudentSubjectsDetailed(
  client: PoolClient,
  schema: string,
  studentId: string
): Promise<StudentSubjectSummary[]> {
  await ensureStudentExists(client, schema, studentId);

  const subjects = (await listStudentSubjects(client, schema, studentId)) as StudentSubjectRow[];

  if (subjects.length === 0) {
    return [];
  }

  const dropRequestResult = await client.query(
    `
      SELECT subject_id, status, requested_at
      FROM ${tableName(schema, 'student_drop_requests')}
      WHERE student_id = $1
      ORDER BY requested_at DESC
    `,
    [studentId]
  );

  const dropStatusMap = new Map<
    string,
    { status: 'pending' | 'approved' | 'rejected'; requested_at: string }
  >();
  for (const row of dropRequestResult.rows) {
    dropStatusMap.set(row.subject_id, {
      status: row.status,
      requested_at: row.requested_at
    });
  }

  return subjects.map((subject) => {
    const metadata = parseJson<Record<string, unknown>>(subject.metadata, {});
    const dropRecord = dropStatusMap.get(subject.subject_id);
    return {
      subjectId: subject.subject_id,
      name: subject.name,
      code: subject.code,
      dropRequested: Boolean(metadata.dropRequested ?? dropRecord?.status === 'pending'),
      dropStatus: dropRecord?.status ?? 'none',
      dropRequestedAt: dropRecord?.requested_at ?? null
    };
  });
}

export async function requestStudentSubjectDrop(
  client: PoolClient,
  schema: string,
  studentId: string,
  subjectId: string,
  reason?: string
) {
  await ensureStudentExists(client, schema, studentId);
  const cleanSubjectId = toUuid(subjectId);

  const studentSubjectResult = await client.query(
    `
      SELECT id, metadata
      FROM ${tableName(schema, 'student_subjects')}
      WHERE student_id = $1 AND subject_id = $2
    `,
    [studentId, cleanSubjectId]
  );

  if (studentSubjectResult.rowCount === 0) {
    const error = new Error('Subject not associated with student');
    (error as Error & { status?: number }).status = 404;
    throw error;
  }

  const studentSubjectRow = studentSubjectResult.rows[0];
  const metadata = parseJson<Record<string, unknown>>(studentSubjectRow.metadata, {});

  if (metadata.dropRequested) {
    return { status: 'pending' as const };
  }

  metadata.dropRequested = true;
  metadata.dropRequestedAt = new Date().toISOString();

  await client.query(
    `
      UPDATE ${tableName(schema, 'student_subjects')}
      SET metadata = $1::jsonb,
          updated_at = NOW()
      WHERE id = $2
    `,
    [JSON.stringify(metadata), studentSubjectRow.id]
  );

  await client.query(
    `
      INSERT INTO ${tableName(schema, 'student_drop_requests')}
        (student_id, subject_id, reason, status, metadata)
      VALUES ($1, $2, $3, 'pending', $4)
    `,
    [studentId, cleanSubjectId, reason ?? null, JSON.stringify({ initiatedBy: 'student' })]
  );

  return { status: 'pending' as const };
}

export async function listStudentExamSummaries(
  client: PoolClient,
  schema: string,
  studentId: string
): Promise<StudentExamSummary[]> {
  await ensureStudentExists(client, schema, studentId);
  const result = await client.query(
    `
      SELECT
        e.id AS exam_id,
        e.name,
        e.exam_date,
        AVG(g.score)::float AS average_score,
        COUNT(*)::int AS subject_count
      FROM ${tableName(schema, 'grades')} g
      JOIN ${tableName(schema, 'exams')} e ON e.id = g.exam_id
      WHERE g.student_id = $1
      GROUP BY e.id, e.name, e.exam_date
      ORDER BY e.exam_date DESC NULLS LAST, e.created_at DESC
    `,
    [studentId]
  );

  return result.rows.map((row) => ({
    examId: row.exam_id,
    name: row.name,
    examDate: row.exam_date,
    averageScore: row.average_score,
    subjectCount: row.subject_count
  }));
}

export async function findLatestStudentExamId(
  client: PoolClient,
  schema: string,
  studentId: string
): Promise<string | null> {
  await ensureStudentExists(client, schema, studentId);
  const result = await client.query(
    `
      SELECT e.id
      FROM ${tableName(schema, 'grades')} g
      JOIN ${tableName(schema, 'exams')} e ON e.id = g.exam_id
      WHERE g.student_id = $1
      ORDER BY e.exam_date DESC NULLS LAST, e.created_at DESC
      LIMIT 1
    `,
    [studentId]
  );

  if (result.rowCount === 0) {
    return null;
  }
  return result.rows[0].id;
}

export async function getStudentProfileDetail(
  client: PoolClient,
  schema: string,
  studentId: string
): Promise<StudentProfileDetail> {
  await ensureStudentExists(client, schema, studentId);

  const studentResult = await client.query(
    `
      SELECT id, first_name, last_name, class_id, admission_number, parent_contacts
      FROM ${tableName(schema, 'students')}
      WHERE id = $1
    `,
    [studentId]
  );

  const student = studentResult.rows[0];

  let className: string | null = null;
  if (student.class_id) {
    const classResult = await client.query(
      `SELECT name FROM ${tableName(schema, 'classes')} WHERE id = $1`,
      [student.class_id]
    );
    className = classResult.rows[0]?.name ?? null;
  }

  const subjects = await listStudentSubjectsDetailed(client, schema, studentId);

  return {
    id: student.id,
    firstName: student.first_name,
    lastName: student.last_name,
    classId: student.class_id,
    className,
    admissionNumber: student.admission_number,
    parentContacts: parseJson<unknown[]>(student.parent_contacts, []),
    subjects
  };
}

export async function updateStudentProfile(
  client: PoolClient,
  schema: string,
  studentId: string,
  payload: {
    firstName?: string;
    lastName?: string;
    parentContacts?: unknown[];
  }
) {
  await ensureStudentExists(client, schema, studentId);
  const existingResult = await client.query(
    `SELECT first_name, last_name, parent_contacts FROM ${tableName(schema, 'students')} WHERE id = $1`,
    [studentId]
  );
  const existing = existingResult.rows[0];

  await client.query(
    `
      UPDATE ${tableName(schema, 'students')}
      SET first_name = $1,
          last_name = $2,
          parent_contacts = $3::jsonb,
          updated_at = NOW()
      WHERE id = $4
    `,
    [
      payload.firstName ?? existing.first_name,
      payload.lastName ?? existing.last_name,
      JSON.stringify(payload.parentContacts ?? parseJson(existing.parent_contacts, [])),
      studentId
    ]
  );

  return getStudentProfileDetail(client, schema, studentId);
}

export async function requestStudentPromotion(
  client: PoolClient,
  schema: string,
  studentId: string,
  targetClassId: string,
  notes?: string
) {
  await ensureStudentExists(client, schema, studentId);
  const studentResult = await client.query(
    `SELECT class_id FROM ${tableName(schema, 'students')} WHERE id = $1`,
    [studentId]
  );
  const currentClassId = studentResult.rows[0]?.class_id ?? null;
  await recordPromotion(client, schema, studentId, currentClassId, targetClassId, studentId, notes);
}

export async function listStudentMessages(
  client: PoolClient,
  schema: string,
  studentId: string
): Promise<StudentMessage[]> {
  await ensureStudentExists(client, schema, studentId);
  const result = await client.query(
    `
      SELECT id, title, body, class_name, status, sent_at
      FROM ${tableName(schema, 'student_messages')}
      WHERE student_id = $1 OR student_id IS NULL
      ORDER BY sent_at DESC
      LIMIT 50
    `,
    [studentId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    className: row.class_name,
    status: row.status,
    sentAt: row.sent_at
  }));
}

export async function markStudentMessageAsRead(
  client: PoolClient,
  schema: string,
  studentId: string,
  messageId: string
): Promise<void> {
  await ensureStudentExists(client, schema, studentId);
  await client.query(
    `
      UPDATE ${tableName(schema, 'student_messages')}
      SET status = 'read'
      WHERE id = $1 AND (student_id = $2 OR student_id IS NULL)
    `,
    [messageId, studentId]
  );
}

export async function listAcademicTermsForStudent(
  client: PoolClient,
  schema: string
): Promise<StudentTermSummary[]> {
  const result = await client.query(
    `SELECT id, name, starts_on, ends_on FROM ${tableName(schema, 'academic_terms')} ORDER BY starts_on DESC NULLS LAST`
  );
  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    startsOn: row.starts_on ?? null,
    endsOn: row.ends_on ?? null
  }));
}

export async function listStudentTermReports(
  client: PoolClient,
  schema: string,
  studentId: string
): Promise<StudentTermReportRecord[]> {
  await ensureStudentExists(client, schema, studentId);
  const result = await client.query(
    `
      SELECT id, term_id, generated_at, summary
      FROM ${tableName(schema, 'term_reports')}
      WHERE student_id = $1
      ORDER BY generated_at DESC
    `,
    [studentId]
  );
  return result.rows.map((row) => ({
    id: row.id,
    termId: row.term_id,
    generatedAt: row.generated_at,
    summary: parseJson(row.summary, {})
  }));
}

export async function generateStudentTermReport(
  client: PoolClient,
  schema: string,
  studentId: string,
  termId: string
) {
  await ensureStudentExists(client, schema, studentId);
  const { reportId } = await generateTermReport(
    client,
    schema,
    {
      studentId,
      termId,
      includeBreakdown: true
    },
    studentId
  );
  return reportId;
}

export async function fetchStudentReportPdf(
  client: PoolClient,
  schema: string,
  studentId: string,
  reportId: string
) {
  await ensureStudentExists(client, schema, studentId);
  const buffer = await fetchReportPdf(client, schema, reportId);
  return buffer;
}
