"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = __importDefault(require("crypto"));
const supertest_1 = __importDefault(require("supertest"));
const app_1 = __importDefault(require("../src/app"));
const tenantManager_1 = require("../src/db/tenantManager");
const testDb_1 = require("./utils/testDb");
const connection_1 = require("../src/db/connection");
jest.mock('../src/middleware/authenticate', () => ({
    __esModule: true,
    default: (req, _res, next) => {
        req.user = {
            id: '11111111-2222-3333-4444-555555555555',
            role: 'admin',
            tenantId: 'tenant_alpha',
            email: 'admin@example.com',
            tokenId: 'token'
        };
        next();
    }
}));
jest.mock('../src/db/connection', () => ({
    getPool: jest.fn(),
    closePool: jest.fn()
}));
const mockedGetPool = connection_1.getPool;
describe('Admin academics routes', () => {
    const authHeaders = { Authorization: 'Bearer fake', 'x-tenant-id': 'tenant_alpha' };
    let classIdA;
    let classIdB;
    let teacherId;
    let studentId;
    let termId;
    let subjectId;
    let examId;
    let pool;
    beforeAll(async () => {
        const testPool = await (0, testDb_1.createTestPool)();
        pool = testPool.pool;
        mockedGetPool.mockReturnValue(pool);
        await (0, tenantManager_1.createTenant)({
            name: 'Test School',
            schemaName: 'tenant_alpha'
        }, pool);
        const classResultA = await pool.query(`INSERT INTO tenant_alpha.classes (name, description) VALUES ('Grade 7', 'Junior high') RETURNING id`);
        classIdA = classResultA.rows[0].id;
        classIdB = crypto_1.default.randomUUID();
        await pool.query(`INSERT INTO tenant_alpha.classes (id, name, description) VALUES ($1, 'Grade 8', 'Junior high')`, [classIdB]);
        const teacherResult = await pool.query(`INSERT INTO tenant_alpha.teachers (name, email) VALUES ('Jane Mentor', 'jane@example.com') RETURNING id`);
        teacherId = teacherResult.rows[0].id;
        const termResult = await pool.query(`
        INSERT INTO tenant_alpha.academic_terms (name, starts_on, ends_on)
        VALUES ('Term 1', '2025-01-01', '2025-03-31')
        RETURNING id
      `);
        termId = termResult.rows[0].id;
        const studentResult = await pool.query(`
        INSERT INTO tenant_alpha.students (first_name, last_name, class_id)
        VALUES ('Alex', 'Johnson', $1)
        RETURNING id
      `, [classIdA]);
        studentId = studentResult.rows[0].id;
        const examResult = await pool.query(`
        INSERT INTO tenant_alpha.exams (name, exam_date)
        VALUES ('Mid Term Assessment', '2025-02-15')
        RETURNING id
      `);
        examId = examResult.rows[0].id;
        await pool.query(`
        INSERT INTO tenant_alpha.fee_invoices (student_id, amount, status, due_date)
        VALUES ($1, 500, 'partial', '2025-02-20')
      `, [studentId]);
        await pool.query(`
        INSERT INTO tenant_alpha.attendance_records (id, student_id, class_id, status, attendance_date)
        VALUES ($1, $2, $3, 'present', '2025-02-01')
      `, [crypto_1.default.randomUUID(), studentId, classIdA]);
        await pool.query(`
        INSERT INTO tenant_alpha.attendance_records (id, student_id, class_id, status, attendance_date)
        VALUES ($1, $2, $3, 'absent', '2025-02-05')
      `, [crypto_1.default.randomUUID(), studentId, classIdA]);
        await pool.query(`
        INSERT INTO tenant_alpha.grades (id, student_id, exam_id, subject, score, grade)
        VALUES ($1, $2, $3, 'Mathematics', 88, 'A')
      `, [crypto_1.default.randomUUID(), studentId, examId]);
        await pool.query(`
        INSERT INTO tenant_alpha.grades (id, student_id, exam_id, subject, score, grade)
        VALUES ($1, $2, $3, 'Science', 79, 'B')
      `, [crypto_1.default.randomUUID(), studentId, examId]);
    });
    it('manages subjects, assignments, promotions, and report export', async () => {
        const createdSubject = await (0, supertest_1.default)(app_1.default)
            .post('/admin/subjects')
            .set(authHeaders)
            .send({ name: 'Mathematics', code: 'MATH', description: 'Core math' })
            .expect(201);
        subjectId = createdSubject.body.id;
        expect(createdSubject.body.name).toBe('Mathematics');
        await (0, supertest_1.default)(app_1.default)
            .post(`/admin/classes/${classIdA}/subjects`)
            .set(authHeaders)
            .send({ subjectIds: [subjectId] })
            .expect(200);
        const classSubjects = await (0, supertest_1.default)(app_1.default)
            .get(`/admin/classes/${classIdA}/subjects`)
            .set(authHeaders)
            .expect(200);
        expect(classSubjects.body).toHaveLength(1);
        const assignment = await (0, supertest_1.default)(app_1.default)
            .post(`/admin/teachers/${teacherId}/assignments`)
            .set(authHeaders)
            .send({ classId: classIdA, subjectId, isClassTeacher: true })
            .expect(201);
        expect(assignment.body.teacher_id).toBe(teacherId);
        await (0, supertest_1.default)(app_1.default)
            .post(`/admin/students/${studentId}/subjects`)
            .set(authHeaders)
            .send({ subjectIds: [subjectId] })
            .expect(200);
        const promotion = await (0, supertest_1.default)(app_1.default)
            .post(`/admin/students/${studentId}/promote`)
            .set(authHeaders)
            .send({ toClassId: classIdB })
            .expect(200);
        expect(promotion.body.class_id).toBe(classIdB);
        const reportResponse = await (0, supertest_1.default)(app_1.default)
            .post('/admin/reports/term')
            .set(authHeaders)
            .send({ studentId, termId })
            .expect(201);
        expect(reportResponse.headers['content-type']).toMatch(/application\/pdf/);
        expect(Buffer.isBuffer(reportResponse.body)).toBe(true);
        expect(reportResponse.body.length).toBeGreaterThan(0);
        const reportRecord = await pool.query(`SELECT id FROM tenant_alpha.term_reports ORDER BY generated_at DESC LIMIT 1`);
        const reportId = reportRecord.rows[0].id;
        const retrievePdf = await (0, supertest_1.default)(app_1.default)
            .get(`/admin/reports/term/${reportId}/pdf`)
            .set(authHeaders)
            .expect(200);
        expect(retrievePdf.headers['content-type']).toMatch(/application\/pdf/);
    });
});
