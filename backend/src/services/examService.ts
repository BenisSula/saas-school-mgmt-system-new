import crypto from 'crypto';
import { PoolClient } from 'pg';
import PDFDocument from 'pdfkit';

export interface ExamInput {
  name: string;
  description?: string | null;
  examDate?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface ExamSessionInput {
  classId: string;
  subject: string;
  scheduledAt: string;
  invigilator?: string | null;
}

export interface GradeEntryInput {
  studentId: string;
  subject: string;
  score: number;
  remarks?: string | null;
  classId?: string | null;
}

interface GradeScale {
  min_score: number;
  max_score: number;
  grade: string;
  remark: string | null;
}

interface ResultSubjectRow {
  subject: string;
  score: number;
  grade: string | null;
  remarks: string | null;
}

interface StandingRow {
  student_id: string;
  total: number;
  average: number;
}

const EXAM_TABLE = 'exams';
const SESSION_TABLE = 'exam_sessions';
const GRADE_TABLE = 'grades';
const SCALE_TABLE = 'grade_scales';

function qualified(schema: string, table: string): string {
  return `${schema}.${table}`;
}

async function fetchGradeScales(client: PoolClient, schema: string): Promise<GradeScale[]> {
  const result = await client.query<GradeScale>(
    `SELECT min_score, max_score, grade, COALESCE(remark, '') AS remark
     FROM ${qualified(schema, SCALE_TABLE)}
     ORDER BY min_score DESC`
  );
  return result.rows;
}

export async function getGradeScales(client: PoolClient, schema: string): Promise<GradeScale[]> {
  return fetchGradeScales(client, schema);
}

export async function listExams(client: PoolClient, schema: string) {
  const result = await client.query(
    `
      SELECT 
        e.id,
        e.name,
        e.description,
        e.exam_date,
        e.metadata,
        e.created_at,
        COUNT(DISTINCT es.id) as session_count,
        COUNT(DISTINCT es.class_id) as class_count
      FROM ${qualified(schema, EXAM_TABLE)} e
      LEFT JOIN ${qualified(schema, SESSION_TABLE)} es ON e.id = es.exam_id
      GROUP BY e.id, e.name, e.description, e.exam_date, e.metadata, e.created_at
      ORDER BY e.exam_date DESC NULLS LAST, e.created_at DESC
    `
  );
  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    examDate: row.exam_date,
    metadata: row.metadata,
    createdAt: row.created_at,
    classes: Number(row.class_count) || 0,
    sessions: Number(row.session_count) || 0
  }));
}

function resolveGrade(
  score: number,
  scales: GradeScale[]
): { grade: string | null; remark: string | null } {
  const scale = scales.find(
    (entry) => score >= Number(entry.min_score) && score <= Number(entry.max_score)
  );
  return scale ? { grade: scale.grade, remark: scale.remark } : { grade: null, remark: null };
}

export async function createExam(
  client: PoolClient,
  schema: string,
  payload: ExamInput,
  actorId?: string
) {
  const result = await client.query(
    `
      INSERT INTO ${qualified(schema, EXAM_TABLE)} (name, description, exam_date, metadata)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `,
    [payload.name, payload.description ?? null, payload.examDate ?? null, payload.metadata ?? {}]
  );

  console.info('[audit] exam_created', {
    tenantSchema: schema,
    examId: result.rows[0].id,
    actorId: actorId ?? null
  });

  return result.rows[0];
}

export async function createExamSession(
  client: PoolClient,
  schema: string,
  examId: string,
  payload: ExamSessionInput,
  actorId?: string
) {
  const result = await client.query(
    `
      INSERT INTO ${qualified(schema, SESSION_TABLE)} (exam_id, class_id, subject, scheduled_at, invigilator)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (exam_id, class_id, subject)
      DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at,
                    invigilator = EXCLUDED.invigilator,
                    updated_at = NOW()
      RETURNING *
    `,
    [examId, payload.classId, payload.subject, payload.scheduledAt, payload.invigilator ?? null]
  );

  console.info('[audit] exam_session_saved', {
    tenantSchema: schema,
    examId,
    sessionId: result.rows[0].id,
    actorId: actorId ?? null
  });

  return result.rows[0];
}

export async function bulkUpsertGrades(
  client: PoolClient,
  schema: string,
  examId: string,
  entries: GradeEntryInput[],
  actorId?: string
) {
  const scales = await fetchGradeScales(client, schema);
  const upserted = [];

  for (const entry of entries) {
    const { grade, remark } = resolveGrade(entry.score, scales);
    const result = await client.query(
      `
        INSERT INTO ${qualified(
          schema,
          GRADE_TABLE
        )} (id, student_id, exam_id, subject, score, grade, remarks, recorded_by, class_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (student_id, exam_id, subject)
        DO UPDATE SET
          score = EXCLUDED.score,
          grade = EXCLUDED.grade,
          remarks = EXCLUDED.remarks,
          recorded_by = EXCLUDED.recorded_by,
          class_id = EXCLUDED.class_id,
          updated_at = NOW()
        RETURNING *
      `,
      [
        crypto.randomUUID(),
        entry.studentId,
        examId,
        entry.subject,
        entry.score,
        grade,
        entry.remarks ?? remark,
        actorId ?? null,
        entry.classId ?? null
      ]
    );
    upserted.push(result.rows[0]);
  }

  console.info('[audit] grades_saved', {
    tenantSchema: schema,
    examId,
    entries: entries.length,
    actorId: actorId ?? null
  });

  return upserted;
}

export async function computeStudentResult(
  client: PoolClient,
  schema: string,
  studentId: string,
  examId: string
) {
  const [examResult, gradeRows, totalsResult] = await Promise.all([
    client.query(`SELECT * FROM ${qualified(schema, EXAM_TABLE)} WHERE id = $1`, [examId]),
    client.query<ResultSubjectRow>(
      `
        SELECT subject,
               score::double precision AS score,
               grade,
               remarks
        FROM ${qualified(schema, GRADE_TABLE)}
        WHERE exam_id = $1
          AND student_id = $2
        ORDER BY subject ASC
      `,
      [examId, studentId]
    ),
    client.query<StandingRow>(
      `
        SELECT
          student_id,
          SUM(score)::double precision AS total,
          AVG(score)::double precision AS average
        FROM ${qualified(schema, GRADE_TABLE)}
        WHERE exam_id = $1
        GROUP BY student_id
        ORDER BY total DESC, student_id ASC
      `,
      [examId]
    )
  ]);

  const exam = examResult.rows[0] ?? null;
  const subjects = gradeRows.rows;
  const standings = totalsResult.rows;

  const subjectCount = subjects.length;
  const totalScore = subjects.reduce((sum, subject) => sum + subject.score, 0);
  const average = subjectCount > 0 ? totalScore / subjectCount : 0;
  const maxTotal = subjectCount * 100 || 1;
  const percentage = (totalScore / maxTotal) * 100;

  const scales = await fetchGradeScales(client, schema);
  const { grade } = resolveGrade(average, scales);

  let position = null;
  let previousTotal: number | null = null;
  let previousRank = 0;

  const leaderboard = standings.map((row, index) => {
    let rank = index + 1;
    if (previousTotal !== null && Number(previousTotal) === Number(row.total)) {
      rank = previousRank;
    }
    const gradeInfo = resolveGrade(row.average, scales);
    const entry = {
      studentId: row.student_id,
      total: row.total,
      average: row.average,
      grade: gradeInfo.grade,
      position: rank
    };
    if (row.student_id === studentId) {
      position = rank;
    }
    previousTotal = row.total;
    previousRank = rank;
    return entry;
  });

  const highest = leaderboard[0]?.total ?? 0;
  const lowest = leaderboard[leaderboard.length - 1]?.total ?? 0;
  const classAverage =
    leaderboard.reduce((sum, row) => sum + row.average, 0) / (leaderboard.length || 1);

  return {
    exam,
    summary: {
      studentId,
      total: totalScore,
      average,
      percentage,
      grade,
      position
    },
    subjects,
    aggregates: {
      highest,
      lowest,
      classAverage
    },
    leaderboard
  };
}

export async function generateExamExport(
  client: PoolClient,
  schema: string,
  examId: string,
  format: 'csv' | 'pdf'
): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
  const examResult = await client.query(
    `SELECT name, exam_date FROM ${qualified(schema, EXAM_TABLE)} WHERE id = $1`,
    [examId]
  );
  const exam = examResult.rows[0];

  const rows = await client.query(
    `
      SELECT
        g.student_id,
        s.first_name,
        s.last_name,
        g.subject,
          g.score::double precision AS score,
        g.grade
      FROM ${qualified(schema, GRADE_TABLE)} g
      JOIN ${qualified(schema, 'students')} s ON s.id = g.student_id
      WHERE g.exam_id = $1
      ORDER BY s.last_name ASC, s.first_name ASC, g.subject ASC
    `,
    [examId]
  );

  const safeName = (exam?.name ?? 'exam').replace(/\s+/g, '_').toLowerCase();

  if (format === 'csv') {
    const header = 'Student ID,First Name,Last Name,Subject,Score,Grade';
    const lines = rows.rows.map((row) =>
      [
        row.student_id,
        row.first_name,
        row.last_name,
        row.subject,
        row.score.toFixed(2),
        row.grade ?? ''
      ]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(',')
    );
    const csv = [header, ...lines].join('\n');
    console.info('[audit] exam_export', {
      tenantSchema: schema,
      examId,
      format: 'csv'
    });
    return {
      buffer: Buffer.from(csv, 'utf-8'),
      contentType: 'text/csv',
      filename: `${safeName}-results.csv`
    };
  }

  const pdfBuffer = await new Promise<Buffer>((resolve) => {
    const doc = new PDFDocument({ margin: 36 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    doc.fontSize(18).text(`Exam Results: ${exam?.name ?? 'Exam'}`, { align: 'center' });
    if (exam?.exam_date) {
      doc.fontSize(12).moveDown(0.5).text(`Exam Date: ${exam.exam_date}`);
    }
    doc.moveDown(1);

    rows.rows.forEach((row) => {
      doc
        .fontSize(12)
        .text(
          `${row.first_name} ${row.last_name} • ${row.subject} • ${row.score.toFixed(2)} ${row.grade ? `(${row.grade})` : ''}`
        );
    });

    doc.end();
  });

  console.info('[audit] exam_export', {
    tenantSchema: schema,
    examId,
    format: 'pdf'
  });

  return {
    buffer: pdfBuffer,
    contentType: 'application/pdf',
    filename: `${safeName}-results.pdf`
  };
}
