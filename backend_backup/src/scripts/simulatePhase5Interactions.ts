import 'dotenv/config';
import crypto from 'crypto';
import { performance } from 'perf_hooks';
import type { Pool, PoolClient } from 'pg';
import { getPool, closePool } from '../db/connection';
import { withTenantSearchPath } from '../db/tenantManager';
import { sendNotificationToAdmins } from '../services/platformMonitoringService';
import { recordSharedAuditLog, recordTenantAuditLog } from '../services/auditLogService';
import { markAttendance, type AttendanceMark } from '../services/attendanceService';
import {
  bulkUpsertGrades,
  computeStudentResult,
  createExam,
  createExamSession,
  generateExamExport
} from '../services/examService';

type SharedUserRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  school_id: string | null;
};

interface SchoolContext {
  schoolId: string;
  schoolName: string;
  registrationCode: string | null;
  tenantId: string;
  schemaName: string;
  admins: SharedUserRow[];
  teachers: SharedUserRow[];
  students: SharedUserRow[];
}

interface StepResult {
  label: string;
  durationMs: number;
  successCount: number;
  failureCount: number;
  details?: Record<string, unknown>;
}

interface SimulationSummary {
  steps: StepResult[];
  auditTrail: {
    shared: Record<string, number>;
    tenants: Record<string, Record<string, number>>;
  };
  notifications: {
    superuserBroadcast: number;
    adminAnnouncements: number;
  };
  attendance: {
    teachersHandled: number;
    recordsInserted: number;
  };
  results: {
    examsCreated: number;
    sessionsCreated: number;
    gradeEntries: number;
  };
  studentActivity: {
    resultsViewed: number;
    reportsExported: number;
    attendanceSummariesFetched: number;
  };
  failures: string[];
}

const MAINTENANCE_MESSAGE =
  'System maintenance scheduled for Saturday, 10:00 PM. Please inform your staff and students.';
const ADMIN_BROADCAST_MESSAGE =
  'Midterm exams will start next week. Check your timetable and prepare accordingly.';
const SIMULATION_PHASE = 'phase5';

async function fetchSuperUser(pool: Pool): Promise<SharedUserRow> {
  const result = await pool.query<SharedUserRow>(
    `
      SELECT id, email, full_name, role, school_id
      FROM shared.users
      WHERE role = 'superadmin'
      ORDER BY created_at ASC
      LIMIT 1
    `
  );

  if (result.rowCount === 0) {
    throw new Error('Superuser not found. Run seeding before the Phase 5 simulation.');
  }

  return result.rows[0];
}

async function fetchSchools(pool: Pool): Promise<SchoolContext[]> {
  const schoolRows = await pool.query<{
    id: string;
    name: string;
    registration_code: string | null;
    tenant_id: string;
    schema_name: string;
  }>(
    `
      SELECT
        s.id,
        s.name,
        s.registration_code,
        s.tenant_id,
        t.schema_name
      FROM shared.schools s
      INNER JOIN shared.tenants t ON t.id = s.tenant_id
      ORDER BY s.name ASC
    `
  );

  const contexts: SchoolContext[] = [];

  for (const school of schoolRows.rows) {
    const [admins, teachers, students] = await Promise.all([
      pool.query<SharedUserRow>(
        `
          SELECT id, email, full_name, role, school_id
          FROM shared.users
          WHERE role = 'admin'
            AND school_id = $1
        `,
        [school.id]
      ),
      pool.query<SharedUserRow>(
        `
          SELECT id, email, full_name, role, school_id
          FROM shared.users
          WHERE role = 'teacher'
            AND school_id = $1
        `,
        [school.id]
      ),
      pool.query<SharedUserRow>(
        `
          SELECT id, email, full_name, role, school_id
          FROM shared.users
          WHERE role = 'student'
            AND school_id = $1
        `,
        [school.id]
      )
    ]);

    contexts.push({
      schoolId: school.id,
      schoolName: school.name,
      registrationCode: school.registration_code,
      tenantId: school.tenant_id,
      schemaName: school.schema_name,
      admins: admins.rows,
      teachers: teachers.rows,
      students: students.rows
    });
  }

  return contexts;
}

async function ensureGradeScales(client: PoolClient, schemaName: string): Promise<void> {
  const existing = await client.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM ${schemaName}.grade_scales`
  );
  if (Number(existing.rows[0]?.count ?? '0') > 0) {
    return;
  }

  const defaultScales = [
    { min: 90, max: 100, grade: 'A', remark: 'Excellent' },
    { min: 80, max: 89, grade: 'B', remark: 'Very Good' },
    { min: 70, max: 79, grade: 'C', remark: 'Good' },
    { min: 60, max: 69, grade: 'D', remark: 'Satisfactory' },
    { min: 0, max: 59, grade: 'E', remark: 'Needs Improvement' }
  ];

  for (const scale of defaultScales) {
    await client.query(
      `
        INSERT INTO ${schemaName}.grade_scales (min_score, max_score, grade, remark)
        VALUES ($1, $2, $3, $4)
      `,
      [scale.min, scale.max, scale.grade, scale.remark]
    );
  }
}

async function createSuperUserBroadcast(
  pool: Pool,
  superUser: SharedUserRow,
  summary: SimulationSummary
): Promise<StepResult> {
  const start = performance.now();
  let notificationCount = 0;

  const response = await sendNotificationToAdmins({
    title: 'Scheduled Maintenance',
    message: MAINTENANCE_MESSAGE,
    targetRoles: ['admin'],
    metadata: {
      simulationPhase: SIMULATION_PHASE,
      severity: 'info'
    },
    actorId: superUser.id
  });

  notificationCount = response.sentCount ?? 0;

  if (notificationCount > 0 && response.notificationIds.length > 0) {
    await pool.query(
      `
        UPDATE shared.notifications
        SET status = 'unread',
            metadata = metadata || $2::jsonb
        WHERE id = ANY($1::uuid[])
      `,
      [
        response.notificationIds,
        JSON.stringify({
          simulationPhase: SIMULATION_PHASE,
          senderRole: 'superadmin'
        })
      ]
    );

    await recordSharedAuditLog({
      userId: superUser.id,
      actorRole: 'superadmin',
      action: 'send_notification',
      entityType: 'NOTIFICATION',
      entityId: response.notificationIds[0],
      target: 'role:admin',
      details: {
        simulationPhase: SIMULATION_PHASE,
        message: MAINTENANCE_MESSAGE,
        recipients: notificationCount,
        ipAddress: '127.0.0.1'
      }
    });
  }

  summary.notifications.superuserBroadcast = notificationCount;

  const end = performance.now();
  return {
    label: 'Superuser broadcast',
    durationMs: end - start,
    successCount: notificationCount,
    failureCount: 0,
    details: {
      notificationIds: response.notificationIds
    }
  };
}

async function createAdminAnnouncements(
  pool: Pool,
  schoolContexts: SchoolContext[],
  summary: SimulationSummary
): Promise<StepResult> {
  const start = performance.now();
  let totalNotifications = 0;

  for (const school of schoolContexts) {
    for (const admin of school.admins) {
      const recipients = [
        ...school.teachers.map((teacher) => ({ userId: teacher.id, role: 'teacher' })),
        ...school.students.map((student) => ({ userId: student.id, role: 'student' }))
      ];

      for (const recipient of recipients) {
        const notificationId = crypto.randomUUID();
        await pool.query(
          `
            INSERT INTO shared.notifications (
              id,
              tenant_id,
              recipient_user_id,
              target_role,
              target_roles,
              title,
              message,
              status,
              metadata
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'unread', $8::jsonb)
          `,
          [
            notificationId,
            school.tenantId,
            recipient.userId,
            recipient.role,
            [recipient.role],
            'Midterm Exam Notice',
            ADMIN_BROADCAST_MESSAGE,
            JSON.stringify({
              simulationPhase: SIMULATION_PHASE,
              senderRole: 'admin',
              schoolId: school.schoolId,
              registrationCode: school.registrationCode
            })
          ]
        );
        totalNotifications += 1;
      }

      await recordSharedAuditLog({
        userId: admin.id,
        actorRole: 'admin',
        action: 'send_notification',
        entityType: 'NOTIFICATION',
        target: `school_id:${school.schoolId}`,
        details: {
          simulationPhase: SIMULATION_PHASE,
          message: ADMIN_BROADCAST_MESSAGE,
          teacherRecipients: school.teachers.length,
          studentRecipients: school.students.length
        }
      });
    }
  }

  summary.notifications.adminAnnouncements = totalNotifications;
  const end = performance.now();
  return {
    label: 'Admin broadcasts to staff & students',
    durationMs: end - start,
    successCount: totalNotifications,
    failureCount: 0
  };
}

async function simulateTeacherAttendance(
  pool: Pool,
  schoolContexts: SchoolContext[],
  summary: SimulationSummary
): Promise<StepResult> {
  const start = performance.now();
  let teacherCount = 0;
  let attendanceCount = 0;

  for (const school of schoolContexts) {
    await withTenantSearchPath(pool, school.schemaName, async (client) => {
      const assignments = await client.query<{
        teacher_id: string;
        class_id: string;
        subject_id: string;
        class_name: string;
        subject_name: string;
      }>(
        `
          SELECT
            ta.teacher_id,
            ta.class_id,
            ta.subject_id,
            c.name AS class_name,
            s.name AS subject_name
          FROM teacher_assignments ta
          INNER JOIN classes c ON c.id = ta.class_id
          INNER JOIN subjects s ON s.id = ta.subject_id
        `
      );

      for (const assignment of assignments.rows) {
        teacherCount += 1;

        const studentsResult = await client.query<{ id: string; full_name: string | null }>(
          `
            SELECT id, full_name
            FROM students
            WHERE class_uuid = $1
              AND status = 'active'
          `,
          [assignment.class_id]
        );

        const today = new Date().toISOString().slice(0, 10);
        const attendanceMarks: AttendanceMark[] = studentsResult.rows.map((student) => {
          const random = Math.random();
          const status =
            random > 0.9
              ? 'late'
              : random > 0.8
                ? 'absent'
                : ('present' as AttendanceMark['status']);

          return {
            studentId: student.id,
            classId: assignment.class_id,
            status,
            markedBy: assignment.teacher_id,
            date: today,
            metadata: {
              simulationPhase: SIMULATION_PHASE,
              className: assignment.class_name,
              subjectName: assignment.subject_name
            }
          };
        });

        if (attendanceMarks.length === 0) {
          continue;
        }

        await markAttendance(client, school.schemaName, attendanceMarks);
        attendanceCount += attendanceMarks.length;

        await recordTenantAuditLog(school.schemaName, {
          userId: assignment.teacher_id,
          actorRole: 'teacher',
          action: 'attendance_marked',
          entityType: 'ATTENDANCE',
          entityId: assignment.class_id,
          target: `class_id:${assignment.class_id}`,
          details: {
            simulationPhase: SIMULATION_PHASE,
            entries: attendanceMarks.length,
            date: today
          }
        });

        await recordSharedAuditLog({
          userId: assignment.teacher_id,
          actorRole: 'teacher',
          action: 'attendance_marked',
          entityType: 'ATTENDANCE',
          entityId: assignment.class_id,
          target: `class_id:${assignment.class_id}`,
          details: {
            simulationPhase: SIMULATION_PHASE,
            schoolId: school.schoolId,
            registrationCode: school.registrationCode,
            entries: attendanceMarks.length
          }
        });
      }
    });
  }

  summary.attendance.teachersHandled = teacherCount;
  summary.attendance.recordsInserted = attendanceCount;
  const end = performance.now();
  return {
    label: 'Teachers mark attendance',
    durationMs: end - start,
    successCount: attendanceCount,
    failureCount: 0,
    details: {
      teachers: teacherCount
    }
  };
}

async function simulateTeacherResults(
  pool: Pool,
  schoolContexts: SchoolContext[],
  summary: SimulationSummary
): Promise<StepResult> {
  const start = performance.now();
  let examsCreated = 0;
  let sessionsCreated = 0;
  let gradesInserted = 0;

  for (const school of schoolContexts) {
    const classExamMap = new Map<string, string>();

    await withTenantSearchPath(pool, school.schemaName, async (client) => {
      await ensureGradeScales(client, school.schemaName);

      const assignments = await client.query<{
        teacher_id: string;
        class_id: string;
        subject_id: string;
        class_name: string;
        subject_name: string;
      }>(
        `
          SELECT
            ta.teacher_id,
            ta.class_id,
            ta.subject_id,
            c.name AS class_name,
            s.name AS subject_name
          FROM teacher_assignments ta
          INNER JOIN classes c ON c.id = ta.class_id
          INNER JOIN subjects s ON s.id = ta.subject_id
        `
      );

      for (const assignment of assignments.rows) {
        let examId = classExamMap.get(assignment.class_id);
        if (!examId) {
          const examRecord = (await createExam(client, school.schemaName, {
            name: `Midterm Assessment - ${assignment.class_name}`,
            description: 'Auto-generated exam for Phase 5 simulation',
            metadata: { simulationPhase: SIMULATION_PHASE }
          })) as { id: string };
          if (!examRecord?.id) {
            throw new Error(`Failed to create exam for class ${assignment.class_id}`);
          }
          examId = examRecord.id;
          classExamMap.set(assignment.class_id, examId);
          examsCreated += 1;
        }

        await createExamSession(
          client,
          school.schemaName,
          examId,
          {
            classId: assignment.class_id,
            subject: assignment.subject_name,
            scheduledAt: new Date().toISOString(),
            invigilator: 'Simulation Bot'
          },
          assignment.teacher_id
        );
        sessionsCreated += 1;

        const studentsResult = await client.query<{ id: string; full_name: string | null }>(
          `
            SELECT id, full_name
            FROM students
            WHERE class_uuid = $1
              AND status = 'active'
          `,
          [assignment.class_id]
        );

        const gradeEntries = studentsResult.rows.map((student, index) => ({
          studentId: student.id,
          subject: assignment.subject_name,
          score: 55 + Math.round(Math.random() * 40),
          remarks: `Simulated term result #${index + 1}`,
          classId: assignment.class_id
        }));

        const inserted = await bulkUpsertGrades(
          client,
          school.schemaName,
          examId,
          gradeEntries,
          assignment.teacher_id
        );

        gradesInserted += inserted.length;

        await recordTenantAuditLog(school.schemaName, {
          userId: assignment.teacher_id,
          actorRole: 'teacher',
          action: 'enter_results',
          entityType: 'GRADE',
          entityId: examId,
          target: `class_id:${assignment.class_id}`,
          details: {
            simulationPhase: SIMULATION_PHASE,
            entries: inserted.length,
            subject: assignment.subject_name
          }
        });

        await recordSharedAuditLog({
          userId: assignment.teacher_id,
          actorRole: 'teacher',
          action: 'enter_results',
          entityType: 'GRADE',
          entityId: examId,
          target: `class_id:${assignment.class_id}`,
          details: {
            simulationPhase: SIMULATION_PHASE,
            schoolId: school.schoolId,
            subject: assignment.subject_name,
            entries: inserted.length
          }
        });
      }
    });
  }

  summary.results.examsCreated += examsCreated;
  summary.results.sessionsCreated += sessionsCreated;
  summary.results.gradeEntries += gradesInserted;

  const end = performance.now();
  return {
    label: 'Teachers enter results',
    durationMs: end - start,
    successCount: gradesInserted,
    failureCount: 0,
    details: {
      examsCreated,
      sessionsCreated
    }
  };
}

async function simulateStudentActivities(
  pool: Pool,
  schoolContexts: SchoolContext[],
  summary: SimulationSummary
): Promise<StepResult> {
  const start = performance.now();
  let resultsViewed = 0;
  let reportsGenerated = 0;
  let attendanceSummaries = 0;

  for (const school of schoolContexts) {
    await withTenantSearchPath(pool, school.schemaName, async (client) => {
      const recentExam = await client.query<{ id: string; name: string }>(
        `
          SELECT id, name
          FROM exams
          WHERE metadata ->> 'simulationPhase' = $1
          ORDER BY created_at DESC
          LIMIT 1
        `,
        [SIMULATION_PHASE]
      );

      if (recentExam.rowCount === 0) {
        return;
      }

      const examId = recentExam.rows[0].id;

      for (const student of school.students) {
        const result = await computeStudentResult(client, school.schemaName, student.id, examId);
        resultsViewed += 1;

        await recordTenantAuditLog(school.schemaName, {
          userId: student.id,
          actorRole: 'student',
          action: 'view_results',
          entityType: 'GRADE',
          entityId: examId,
          details: {
            simulationPhase: SIMULATION_PHASE,
            totalScore: result.summary.total,
            average: result.summary.average
          }
        });

        await recordSharedAuditLog({
          userId: student.id,
          actorRole: 'student',
          action: 'view_results',
          entityType: 'GRADE',
          entityId: examId,
          details: {
            simulationPhase: SIMULATION_PHASE,
            schoolId: school.schoolId,
            percentage: result.summary.percentage
          }
        });

        const exportResult = await generateExamExport(client, school.schemaName, examId, 'pdf');
        if (exportResult.buffer.length > 0) {
          reportsGenerated += 1;
        }

        const attendance = await client.query<{
          present: number;
          total: number;
          percentage: number;
        }>(
          `
            SELECT
              SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END)::int AS present,
              COUNT(*)::int AS total,
              ROUND(
                CASE WHEN COUNT(*) = 0
                  THEN 0
                  ELSE SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END)::numeric / COUNT(*)::numeric * 100
                END,
                2
              ) AS percentage
            FROM attendance_records
            WHERE student_id = $1
          `,
          [student.id]
        );

        attendanceSummaries += 1;

        await recordTenantAuditLog(school.schemaName, {
          userId: student.id,
          actorRole: 'student',
          action: 'view_attendance_summary',
          entityType: 'ATTENDANCE',
          entityId: null,
          details: {
            simulationPhase: SIMULATION_PHASE,
            present: attendance.rows[0]?.present ?? 0,
            total: attendance.rows[0]?.total ?? 0,
            percentage: attendance.rows[0]?.percentage ?? 0
          }
        });
      }
    });
  }

  summary.studentActivity.resultsViewed = resultsViewed;
  summary.studentActivity.reportsExported = reportsGenerated;
  summary.studentActivity.attendanceSummariesFetched = attendanceSummaries;
  const end = performance.now();
  return {
    label: 'Students view results and reports',
    durationMs: end - start,
    successCount: resultsViewed,
    failureCount: 0,
    details: {
      reportsGenerated,
      attendanceSummaries
    }
  };
}

async function buildAuditSummary(
  pool: Pool,
  schoolContexts: SchoolContext[],
  summary: SimulationSummary
): Promise<StepResult> {
  const start = performance.now();
  let totalRecords = 0;

  const sharedResult = await pool.query<{ actor_role: string | null; count: string }>(
    `
      SELECT actor_role, COUNT(*)::text AS count
      FROM shared.audit_logs
      WHERE details ->> 'simulationPhase' = $1
      GROUP BY actor_role
    `,
    [SIMULATION_PHASE]
  );

  sharedResult.rows.forEach((row) => {
    const role = row.actor_role ?? 'unknown';
    summary.auditTrail.shared[role] = Number(row.count);
    totalRecords += Number(row.count);
  });

  for (const school of schoolContexts) {
    await withTenantSearchPath(pool, school.schemaName, async (client) => {
      const tenantResult = await client.query<{ actor_role: string | null; count: string }>(
        `
          SELECT actor_role, COUNT(*)::text AS count
          FROM audit_logs
          WHERE details ->> 'simulationPhase' = $1
          GROUP BY actor_role
        `,
        [SIMULATION_PHASE]
      );
      summary.auditTrail.tenants[school.schoolName] = {};
      tenantResult.rows.forEach((row) => {
        const role = row.actor_role ?? 'unknown';
        const count = Number(row.count);
        summary.auditTrail.tenants[school.schoolName][role] = count;
        totalRecords += count;
      });
    });
  }

  const end = performance.now();
  return {
    label: 'Audit logging verification',
    durationMs: end - start,
    successCount: totalRecords,
    failureCount: 0
  };
}

function validateSynchronization(summary: SimulationSummary): StepResult {
  const start = performance.now();
  const checks = [
    {
      id: 'attendance-sync',
      description: 'Teacher attendance updates reflected in summary counts',
      passed: summary.attendance.recordsInserted > 0
    },
    {
      id: 'results-sync',
      description: 'Teacher grade entries available for student reports',
      passed: summary.results.gradeEntries > 0 && summary.studentActivity.resultsViewed > 0
    },
    {
      id: 'notifications-admin',
      description: 'Superuser/admin notifications delivered to recipients',
      passed:
        summary.notifications.superuserBroadcast > 0 && summary.notifications.adminAnnouncements > 0
    },
    {
      id: 'reports-export',
      description: 'Students able to export report cards',
      passed: summary.studentActivity.reportsExported > 0
    }
  ];

  const passed = checks.filter((check) => check.passed).length;
  const failed = checks.filter((check) => !check.passed);
  failed.forEach((item) => {
    summary.failures.push(`Sync validation failed: ${item.description}`);
  });

  const end = performance.now();
  return {
    label: 'API ↔ UI synchronization checks',
    durationMs: end - start,
    successCount: passed,
    failureCount: failed.length,
    details: {
      checks
    }
  };
}

export async function runPhase5Simulation(): Promise<SimulationSummary> {
  const pool = getPool();
  const summary: SimulationSummary = {
    steps: [],
    auditTrail: { shared: {}, tenants: {} },
    notifications: { superuserBroadcast: 0, adminAnnouncements: 0 },
    attendance: { teachersHandled: 0, recordsInserted: 0 },
    results: { examsCreated: 0, sessionsCreated: 0, gradeEntries: 0 },
    studentActivity: {
      resultsViewed: 0,
      reportsExported: 0,
      attendanceSummariesFetched: 0
    },
    failures: []
  };

  try {
    const superUser = await fetchSuperUser(pool);
    const schoolContexts = await fetchSchools(pool);

    summary.steps.push(await createSuperUserBroadcast(pool, superUser, summary));
    summary.steps.push(await createAdminAnnouncements(pool, schoolContexts, summary));
    summary.steps.push(await simulateTeacherAttendance(pool, schoolContexts, summary));
    summary.steps.push(await simulateTeacherResults(pool, schoolContexts, summary));
    summary.steps.push(await simulateStudentActivities(pool, schoolContexts, summary));

    summary.steps.push(await buildAuditSummary(pool, schoolContexts, summary));
    summary.steps.push(validateSynchronization(summary));

    return summary;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    summary.failures.push(message);
    throw error;
  } finally {
    await closePool();
  }
}

if (require.main === module) {
  runPhase5Simulation()
    .then((summary) => {
      console.log('[phase5] Simulation complete');
      console.log(JSON.stringify(summary, null, 2));
      process.exit(0);
    })
    .catch((error) => {
      console.error('[phase5] Simulation failed', error);
      process.exit(1);
    });
}
