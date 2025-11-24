import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { performance } from 'perf_hooks';
import request from 'supertest';
import type { Pool } from 'pg';
import app from '../app';
import { getPool, closePool } from '../db/connection';
import { withTenantSearchPath } from '../db/tenantManager';
import { markAttendance, type AttendanceMark } from '../services/attendanceService';
import {
  bulkUpsertGrades,
  createExam,
  createExamSession,
  generateExamExport,
} from '../services/examService';
import {
  generateAccessToken,
  generateRefreshToken,
  storeRefreshToken,
} from '../services/tokenService';
import { recordSharedAuditLog } from '../services/auditLogService';
import { type Role } from '../config/permissions';

type SharedUserRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  tenant_id: string | null;
};

type TenantRow = {
  id: string;
  schema_name: string;
  name: string;
};

interface SessionRecord {
  token: string;
  refreshToken?: string;
  tenantId: string | null;
  schema?: string | null;
  role: Role;
}

interface LoginMetrics {
  totalUsers: number;
  successes: number;
  failures: number;
  averageLoginMs: number;
  byRole: Record<Role | 'unknown', { count: number; avgMs: number; failures: number }>;
}

interface TimingStats {
  average: number;
  p95: number;
  samples: number[];
}

interface EndpointMetric {
  label: string;
  runs: number;
  concurrency: number;
  averageMs: number;
  p95Ms: number;
  maxThresholdMs: number;
  cacheHitRatio?: number;
  notes?: string;
}

interface RbacResult {
  actorRole: Role;
  endpoint: string;
  method: string;
  expectedStatus: number;
  actualStatus: number;
  passed: boolean;
  description: string;
}

interface PerformanceSummary {
  summary: {
    total_users_tested: number;
    successful_logins: number;
    failed_logins: number;
    average_login_time_ms: number;
    report_generated_at: string;
  };
  login_metrics: LoginMetrics;
  endpoints: EndpointMetric[];
  cache_metrics: Record<string, number>;
  rbac: {
    checks_passed: number;
    violations: number;
  };
}

const REPORTS_DIR = path.resolve(__dirname, '../../reports');
const PERFORMANCE_REPORT_PATH = path.join(REPORTS_DIR, 'performance-summary.json');
const RBAC_LOG_PATH = path.join(REPORTS_DIR, 'rbac-validation.log');

const SUPERUSER_EMAIL = process.env.SEED_SUPERUSER_EMAIL ?? 'owner@saas-platform.system';
const SUPERUSER_PASSWORD = process.env.SEED_SUPERUSER_PASSWORD ?? 'SuperOwner#2025!';

const ADMIN_PASSWORDS = new Map<string, string>([
  ['fatou.jallow@newhorizon.edu.gm', 'NhsAdmin@2025'],
  ['lamin.sowe@stpeterslamin.edu.gm', 'StpAdmin@2025'],
  ['musu.bah@daddyjobe.edu.gm', 'DjcAdmin@2025'],
]);

const TEACHER_PASSWORDS = new Map<string, string>([
  ['pamodou.jagne@newhorizon.edu.gm', 'TeachNHS01@2025'],
  ['jainaba.ceesay@newhorizon.edu.gm', 'TeachNHS02@2025'],
  ['lamin.jammeh@newhorizon.edu.gm', 'TeachNHS03@2025'],
  ['mariama.bah@newhorizon.edu.gm', 'TeachNHS04@2025'],
  ['aisha.touray@newhorizon.edu.gm', 'TeachNHS05@2025'],
  ['modou.colley@newhorizon.edu.gm', 'TeachNHS06@2025'],
  ['fatou.sowe@newhorizon.edu.gm', 'TeachNHS07@2025'],
  ['ebrima.faal@newhorizon.edu.gm', 'TeachNHS08@2025'],
  ['haddy.jatta@newhorizon.edu.gm', 'TeachNHS09@2025'],
  ['omar.ceesay@stpeterslamin.edu.gm', 'TeachSTP01@2025'],
  ['mariama.jawara@stpeterslamin.edu.gm', 'TeachSTP02@2025'],
  ['sainabou.jallow@stpeterslamin.edu.gm', 'TeachSTP03@2025'],
  ['musa.touray@stpeterslamin.edu.gm', 'TeachSTP04@2025'],
  ['binta.bah@stpeterslamin.edu.gm', 'TeachSTP05@2025'],
  ['ousman.ceesay@stpeterslamin.edu.gm', 'TeachSTP06@2025'],
  ['isatou.cham@stpeterslamin.edu.gm', 'TeachSTP07@2025'],
  ['abdoulie.baldeh@stpeterslamin.edu.gm', 'TeachSTP08@2025'],
  ['haddy.sanyang@stpeterslamin.edu.gm', 'TeachSTP09@2025'],
  ['lamin.ceesay@daddyjobe.edu.gm', 'TeachDJC01@2025'],
  ['haddy.jallow@daddyjobe.edu.gm', 'TeachDJC02@2025'],
  ['modou.darboe@daddyjobe.edu.gm', 'TeachDJC03@2025'],
  ['mariam.kinteh@daddyjobe.edu.gm', 'TeachDJC04@2025'],
  ['fatoumata.ceesay@daddyjobe.edu.gm', 'TeachDJC05@2025'],
  ['alieu.sanyang@daddyjobe.edu.gm', 'TeachDJC06@2025'],
  ['jainaba.camara@daddyjobe.edu.gm', 'TeachDJC07@2025'],
  ['lamin.bah@daddyjobe.edu.gm', 'TeachDJC08@2025'],
  ['omar.jallow@daddyjobe.edu.gm', 'TeachDJC09@2025'],
]);

const ENDPOINT_TARGETS: Record<string, { average: number; max: number }> = {
  dashboard: { average: 800, max: 1200 },
  attendance: { average: 600, max: 900 },
  results: { average: 700, max: 1000 },
  report: { average: 1000, max: 1500 },
  notifications: { average: 400, max: 600 },
};

function computeStats(samples: number[]): TimingStats {
  if (samples.length === 0) {
    return { average: 0, p95: 0, samples: [] };
  }
  const total = samples.reduce((sum, value) => sum + value, 0);
  const average = total / samples.length;
  const sorted = [...samples].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
  const p95 = sorted[index];
  return { average, p95, samples };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

async function ensureReportsDir(): Promise<void> {
  await fs.mkdir(REPORTS_DIR, { recursive: true });
}

async function fetchTenants(pool: Pool): Promise<Map<string, TenantRow>> {
  const result = await pool.query<TenantRow>(
    `SELECT id, schema_name, name FROM shared.tenants ORDER BY name ASC`
  );
  const map = new Map<string, TenantRow>();
  result.rows.forEach((row) => map.set(row.id, row));
  return map;
}

async function fetchUsers(pool: Pool): Promise<SharedUserRow[]> {
  const result = await pool.query<SharedUserRow>(
    `
      SELECT id, email, full_name, role, tenant_id
      FROM shared.users
      WHERE role IN ('superadmin', 'admin', 'teacher', 'student')
      ORDER BY role ASC
    `
  );
  return result.rows as SharedUserRow[];
}

function getKnownPassword(email: string, role: Role): string | null {
  if (role === 'superadmin' && email === SUPERUSER_EMAIL) {
    return SUPERUSER_PASSWORD;
  }
  if (role === 'admin') {
    return ADMIN_PASSWORDS.get(email) ?? null;
  }
  if (role === 'teacher') {
    return TEACHER_PASSWORDS.get(email) ?? null;
  }
  return null;
}

async function simulateLogins(
  pool: Pool,
  tenants: Map<string, TenantRow>,
  users: SharedUserRow[]
): Promise<{ sessions: Map<string, SessionRecord>; metrics: LoginMetrics }> {
  const sessions = new Map<string, SessionRecord>();
  const durations: number[] = [];
  const metricsByRole: Record<string, { times: number[]; failures: number }> = {};
  let successes = 0;
  let failures = 0;

  const loginTasks = users.map(async (user) => {
    const password = getKnownPassword(user.email, user.role);
    const roleKey = user.role ?? 'unknown';
    metricsByRole[roleKey] ??= { times: [], failures: 0 };

    const tenant = user.tenant_id ? (tenants.get(user.tenant_id) ?? null) : null;
    const tenantId = tenant?.id ?? null;
    const schema = tenant?.schema_name ?? null;

    try {
      const start = performance.now();
      let accessToken: string | null = null;
      let refreshToken: string | undefined;

      if (password) {
        const response = await request(app)
          .post('/auth/login')
          .set('Accept', 'application/json')
          .send({ email: user.email, password });

        if (response.status !== 200 || !response.body?.accessToken) {
          throw new Error(`Login failed with status ${response.status}`);
        }

        accessToken = response.body.accessToken as string;
        refreshToken = response.body.refreshToken as string | undefined;
      } else {
        const tokenPayload = {
          userId: user.id,
          tenantId: tenantId ?? 'shared',
          email: user.email,
          role: user.role,
        };
        accessToken = generateAccessToken(tokenPayload);
        const refreshInfo = generateRefreshToken(tokenPayload);
        refreshToken = refreshInfo.token;
        await storeRefreshToken(pool, user.id, refreshToken, refreshInfo.expiresAt);
      }

      const duration = performance.now() - start;
      durations.push(duration);
      metricsByRole[roleKey].times.push(duration);
      successes += 1;

      const sessionRecord: SessionRecord = {
        token: accessToken,
        refreshToken,
        tenantId,
        schema,
        role: user.role,
      };
      sessions.set(user.id, sessionRecord);

      await recordSharedAuditLog({
        userId: user.id,
        actorRole: user.role,
        action: 'session_started_phase6',
        entityType: 'USER_SESSION',
        entityId: null,
        target: tenantId ? `tenant_id:${tenantId}` : 'shared',
        details: {
          simulationPhase: 'phase6',
          ipAddress: '127.0.0.1',
          durationMs: round(duration),
        },
      });
    } catch {
      failures += 1;
      metricsByRole[roleKey].failures += 1;
      sessions.delete(user.id);
    }
  });

  await Promise.all(loginTasks);

  const averageLoginMs = durations.length
    ? round(durations.reduce((sum, value) => sum + value, 0) / durations.length)
    : 0;

  const byRole: Record<Role | 'unknown', { count: number; avgMs: number; failures: number }> =
    {} as Record<Role | 'unknown', { count: number; avgMs: number; failures: number }>;

  (Object.keys(metricsByRole) as Array<Role | 'unknown'>).forEach((role) => {
    const roleMetrics = metricsByRole[role];
    const avg =
      roleMetrics.times.length > 0
        ? round(roleMetrics.times.reduce((sum, value) => sum + value, 0) / roleMetrics.times.length)
        : 0;
    byRole[role] = {
      count: roleMetrics.times.length,
      avgMs: avg,
      failures: roleMetrics.failures,
    };
  });

  return {
    sessions,
    metrics: {
      totalUsers: users.length,
      successes,
      failures,
      averageLoginMs,
      byRole,
    },
  };
}

async function measureHttpEndpoint(
  label: string,
  method: 'get' | 'post',
  url: string,
  session: SessionRecord,
  tenantIdentifier?: string | null,
  body?: Record<string, unknown>,
  runs: number = 20,
  concurrency: number = 5
): Promise<TimingStats> {
  const samples: number[] = [];

  for (let index = 0; index < runs; index += concurrency) {
    const batch = Math.min(concurrency, runs - index);
    const tasks = Array.from({ length: batch }, async () => {
      const start = performance.now();
      let response = request(app)[method](url).set('Authorization', `Bearer ${session.token}`);
      if (tenantIdentifier) {
        response = response.set('x-tenant-id', tenantIdentifier);
      }
      if (body && method === 'post') {
        response = response.send(body);
      }

      const result = await response;
      if (result.status >= 400) {
        throw new Error(`Endpoint ${url} responded with status ${result.status}`);
      }
      samples.push(performance.now() - start);
    });
    await Promise.all(tasks);
  }

  return computeStats(samples);
}

async function measureAttendanceMark(
  pool: Pool,
  tenant: TenantRow,
  teacherUser: SharedUserRow
): Promise<TimingStats> {
  const payloadSamples: AttendanceMark[][] = [];

  await withTenantSearchPath(pool, tenant.schema_name, async (client) => {
    const assignments = await client.query<{
      teacher_id: string;
      class_id: string;
      subject_id: string;
      class_name: string;
      subject_name: string;
    }>(
      `
        SELECT
          teacher_id,
          class_id,
          subject_id,
          c.name AS class_name,
          s.name AS subject_name
        FROM teacher_assignments ta
        INNER JOIN classes c ON c.id = ta.class_id
        INNER JOIN subjects s ON s.id = ta.subject_id
        WHERE teacher_id = $1
        LIMIT 3
      `,
      [teacherUser.id]
    );

    for (const assignment of assignments.rows) {
      const studentsResult = await client.query<{ id: string }>(
        `SELECT id FROM students WHERE class_uuid = $1 ORDER BY id LIMIT 30`,
        [assignment.class_id]
      );
      const today = new Date().toISOString().slice(0, 10);
      const marks: AttendanceMark[] = studentsResult.rows.map((student) => {
        const random = Math.random();
        const status = random > 0.95 ? 'late' : random > 0.85 ? 'absent' : 'present';
        return {
          studentId: student.id,
          classId: assignment.class_id,
          status,
          markedBy: assignment.teacher_id,
          date: today,
          metadata: {
            simulationPhase: 'phase6',
            className: assignment.class_name,
            subjectName: assignment.subject_name,
          },
        };
      });
      if (marks.length > 0) {
        payloadSamples.push(marks);
      }
    }
  });

  if (payloadSamples.length === 0) {
    return { average: 0, p95: 0, samples: [] };
  }

  const timings: number[] = [];

  for (const marks of payloadSamples) {
    await withTenantSearchPath(pool, tenant.schema_name, async (client) => {
      await client.query('BEGIN');
      try {
        const start = performance.now();
        await markAttendance(client, tenant.schema_name, marks);
        timings.push(performance.now() - start);
      } finally {
        await client.query('ROLLBACK');
      }
    });
  }

  return computeStats(timings);
}

async function measureResultsEntry(
  pool: Pool,
  tenant: TenantRow,
  teacherUser: SharedUserRow
): Promise<TimingStats> {
  const timings: number[] = [];

  await withTenantSearchPath(pool, tenant.schema_name, async (client) => {
    const assignments = await client.query<{
      teacher_id: string;
      class_id: string;
      subject_id: string;
      class_name: string;
      subject_name: string;
    }>(
      `
        SELECT
          teacher_id,
          class_id,
          subject_id,
          c.name AS class_name,
          s.name AS subject_name
        FROM teacher_assignments ta
        INNER JOIN classes c ON c.id = ta.class_id
        INNER JOIN subjects s ON s.id = ta.subject_id
        WHERE teacher_id = $1
        LIMIT 2
      `,
      [teacherUser.id]
    );

    for (const assignment of assignments.rows) {
      await client.query('BEGIN');
      try {
        const examRecord = (await createExam(client, tenant.schema_name, {
          name: `Phase6 Benchmark - ${assignment.class_name}`,
          description: 'Phase 6 simulated exam',
          metadata: { simulationPhase: 'phase6' },
        })) as { id: string };

        await createExamSession(
          client,
          tenant.schema_name,
          examRecord.id,
          {
            classId: assignment.class_id,
            subject: assignment.subject_name,
            scheduledAt: new Date().toISOString(),
            invigilator: 'Simulation Bot',
          },
          teacherUser.id
        );

        const studentsResult = await client.query<{ id: string }>(
          `SELECT id FROM students WHERE class_uuid = $1 ORDER BY id LIMIT 30`,
          [assignment.class_id]
        );

        const gradeEntries = studentsResult.rows.map((student, index) => ({
          studentId: student.id,
          subject: assignment.subject_name,
          score: 55 + Math.round(Math.random() * 40),
          remarks: `Phase6 simulated score #${index + 1}`,
          classId: assignment.class_id,
        }));

        const start = performance.now();
        await bulkUpsertGrades(
          client,
          tenant.schema_name,
          examRecord.id,
          gradeEntries,
          teacherUser.id
        );
        timings.push(performance.now() - start);
      } finally {
        await client.query('ROLLBACK');
      }
    }
  });

  return computeStats(timings);
}

async function measureReportGeneration(pool: Pool, tenant: TenantRow): Promise<TimingStats> {
  const samples: number[] = [];

  await withTenantSearchPath(pool, tenant.schema_name, async (client) => {
    const examResult = await client.query<{ id: string }>(
      `
        SELECT id
        FROM exams
        WHERE metadata ->> 'simulationPhase' IN ('phase5', 'phase6')
        ORDER BY created_at DESC
        LIMIT 1
      `
    );
    if (examResult.rowCount === 0) {
      return;
    }
    const examId = examResult.rows[0].id;

    await client.query('BEGIN');
    try {
      const start = performance.now();
      await generateExamExport(client, tenant.schema_name, examId, 'pdf');
      samples.push(performance.now() - start);
    } finally {
      await client.query('ROLLBACK');
    }
  });

  return computeStats(samples);
}

async function measureNotificationFetch(
  session: SessionRecord,
  tenantIdentifier: string
): Promise<TimingStats> {
  return measureHttpEndpoint(
    'notifications',
    'get',
    '/student/messages',
    session,
    tenantIdentifier,
    undefined,
    20,
    5
  );
}

async function executeRbacChecks(
  sessions: Map<string, SessionRecord>,
  users: SharedUserRow[],
  tenants: Map<string, TenantRow>
): Promise<RbacResult[]> {
  const results: RbacResult[] = [];

  const getSessionByRole = (role: Role, tenantId?: string | null) => {
    const user = users.find(
      (candidate) => candidate.role === role && (tenantId ? candidate.tenant_id === tenantId : true)
    );
    if (!user) return null;
    return sessions.get(user.id) ?? null;
  };

  const sampleTenant = Array.from(tenants.values())[0];
  if (!sampleTenant) {
    return results;
  }

  const adminSession = getSessionByRole('admin', sampleTenant.id);
  const studentSession = getSessionByRole('student', sampleTenant.id);
  const teacherSession = getSessionByRole('teacher', sampleTenant.id);
  const superuserSession = getSessionByRole('superadmin');

  if (studentSession) {
    const response = await request(app)
      .get('/teacher/classes')
      .set('Authorization', `Bearer ${studentSession.token}`)
      .set('x-tenant-id', sampleTenant.id);
    results.push({
      actorRole: 'student',
      endpoint: 'GET /teacher/classes',
      method: 'GET',
      expectedStatus: 403,
      actualStatus: response.status,
      passed: response.status === 403,
      description: 'Student cannot access teacher class roster',
    });
  }

  if (teacherSession) {
    const response = await request(app)
      .get('/superuser/schools')
      .set('Authorization', `Bearer ${teacherSession.token}`);
    results.push({
      actorRole: 'teacher',
      endpoint: 'GET /superuser/schools',
      method: 'GET',
      expectedStatus: 403,
      actualStatus: response.status,
      passed: response.status === 403,
      description: 'Teacher cannot view superuser school list',
    });
  }

  if (adminSession) {
    const response = await request(app)
      .delete('/superuser/schools/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminSession.token}`);
    results.push({
      actorRole: 'admin',
      endpoint: 'DELETE /superuser/schools/:id',
      method: 'DELETE',
      expectedStatus: 403,
      actualStatus: response.status,
      passed: response.status === 403,
      description: 'Admin cannot delete schools outside their scope',
    });
  }

  if (superuserSession && sampleTenant) {
    const response = await request(app)
      .get('/students')
      .set('Authorization', `Bearer ${superuserSession.token}`)
      .set('x-tenant-id', sampleTenant.id);
    results.push({
      actorRole: 'superadmin',
      endpoint: 'GET /students',
      method: 'GET',
      expectedStatus: 200,
      actualStatus: response.status,
      passed: response.status === 200,
      description: 'Superuser can list students for any tenant',
    });
  }

  return results;
}

async function writeReports(
  performanceSummary: PerformanceSummary,
  rbacResults: RbacResult[]
): Promise<void> {
  await ensureReportsDir();
  await fs.writeFile(PERFORMANCE_REPORT_PATH, JSON.stringify(performanceSummary, null, 2), 'utf-8');

  const logLines = rbacResults.map((result) =>
    [
      `[${result.passed ? 'PASS' : 'FAIL'}]`,
      result.actorRole.toUpperCase(),
      `${result.method} ${result.endpoint}`,
      `expected=${result.expectedStatus}`,
      `actual=${result.actualStatus}`,
      `message="${result.description}"`,
    ].join(' ')
  );
  await fs.writeFile(RBAC_LOG_PATH, logLines.join('\n'), 'utf-8');
}

async function main(): Promise<void> {
  const pool = getPool();
  try {
    const tenants = await fetchTenants(pool);
    const users = await fetchUsers(pool);

    const { sessions, metrics: loginMetrics } = await simulateLogins(pool, tenants, users);

    const sampleTenant = Array.from(tenants.values())[0];
    const sampleTeacherUser = users.find(
      (user) => user.role === 'teacher' && user.tenant_id === sampleTenant?.id
    );
    const sampleStudentUser = users.find(
      (user) => user.role === 'student' && user.tenant_id === sampleTenant?.id
    );
    const sampleStudentSession = sampleStudentUser ? sessions.get(sampleStudentUser.id) : null;

    const sampleAdminUser = users.find(
      (user) => user.role === 'admin' && user.tenant_id === sampleTenant?.id
    );
    const sampleAdminSession = sampleAdminUser ? sessions.get(sampleAdminUser.id) : null;

    const endpointMetrics: EndpointMetric[] = [];
    const cacheMetrics: Record<string, number> = {};

    if (sampleAdminSession && sampleTenant) {
      const dashboardStats = await measureHttpEndpoint(
        'dashboard',
        'get',
        '/admin/overview',
        sampleAdminSession,
        sampleTenant.id,
        undefined,
        40,
        8
      );

      endpointMetrics.push({
        label: 'dashboard',
        runs: 40,
        concurrency: 8,
        averageMs: round(dashboardStats.average),
        p95Ms: round(dashboardStats.p95),
        maxThresholdMs: ENDPOINT_TARGETS.dashboard.max,
      });

      const firstRun = await measureHttpEndpoint(
        'dashboard-cache-first',
        'get',
        '/admin/overview',
        sampleAdminSession,
        sampleTenant.id,
        undefined,
        10,
        5
      );
      const secondRun = await measureHttpEndpoint(
        'dashboard-cache-second',
        'get',
        '/admin/overview',
        sampleAdminSession,
        sampleTenant.id,
        undefined,
        10,
        5
      );
      const ratio =
        firstRun.average > 0 ? round(Math.min(1, secondRun.average / firstRun.average)) : 0;
      cacheMetrics['dashboard'] = ratio;
    }

    if (sampleStudentSession && sampleTenant) {
      const notificationStats = await measureNotificationFetch(
        sampleStudentSession,
        sampleTenant.id
      );
      endpointMetrics.push({
        label: 'notifications',
        runs: 20,
        concurrency: 5,
        averageMs: round(notificationStats.average),
        p95Ms: round(notificationStats.p95),
        maxThresholdMs: ENDPOINT_TARGETS.notifications.max,
      });
    }

    if (sampleTeacherUser && sampleTenant) {
      const attendanceStats = await measureAttendanceMark(pool, sampleTenant, sampleTeacherUser);
      endpointMetrics.push({
        label: 'attendance_mark',
        runs: attendanceStats.samples.length,
        concurrency: 1,
        averageMs: round(attendanceStats.average),
        p95Ms: round(attendanceStats.p95),
        maxThresholdMs: ENDPOINT_TARGETS.attendance.max,
        notes: 'Measured inside transaction (rolled back)',
      });

      const resultsStats = await measureResultsEntry(pool, sampleTenant, sampleTeacherUser);
      endpointMetrics.push({
        label: 'results_enter',
        runs: resultsStats.samples.length,
        concurrency: 1,
        averageMs: round(resultsStats.average),
        p95Ms: round(resultsStats.p95),
        maxThresholdMs: ENDPOINT_TARGETS.results.max,
        notes: 'Measured inside transaction (rolled back)',
      });

      const reportStats = await measureReportGeneration(pool, sampleTenant);
      endpointMetrics.push({
        label: 'reports_generate',
        runs: reportStats.samples.length,
        concurrency: 1,
        averageMs: round(reportStats.average),
        p95Ms: round(reportStats.p95),
        maxThresholdMs: ENDPOINT_TARGETS.report.max,
      });
    }

    const rbacResults = await executeRbacChecks(sessions, users, tenants);

    const passedChecks = rbacResults.filter((result) => result.passed).length;
    const failedChecks = rbacResults.length - passedChecks;

    const performanceSummary: PerformanceSummary = {
      summary: {
        total_users_tested: loginMetrics.totalUsers,
        successful_logins: loginMetrics.successes,
        failed_logins: loginMetrics.failures,
        average_login_time_ms: loginMetrics.averageLoginMs,
        report_generated_at: new Date().toISOString(),
      },
      login_metrics: loginMetrics,
      endpoints: endpointMetrics,
      cache_metrics: cacheMetrics,
      rbac: {
        checks_passed: passedChecks,
        violations: failedChecks,
      },
    };

    await writeReports(performanceSummary, rbacResults);

    console.log('[phase6] Performance summary written to', PERFORMANCE_REPORT_PATH);
    console.log('[phase6] RBAC validation log written to', RBAC_LOG_PATH);
    console.log(
      '[phase6] Endpoint metrics:',
      endpointMetrics.map((metric) => metric.label)
    );
  } finally {
    await closePool();
  }
}

if (require.main === module) {
  main()
    .then(() => {
      console.log('[phase6] Simulation complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('[phase6] Simulation failed', error);
      process.exit(1);
    });
}
