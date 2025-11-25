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
            id: 'teacher-user',
            role: 'teacher',
            tenantId: 'tenant_alpha',
            email: 'jane@example.com',
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
describe('Teacher dashboard routes', () => {
    const authHeaders = { Authorization: 'Bearer fake', 'x-tenant-id': 'tenant_alpha' };
    let pool;
    let classAId;
    let classBId;
    let subjectMathId;
    let subjectSciId;
    let teacherId;
    let assignmentMathId;
    let studentAId;
    let studentBId;
    beforeAll(async () => {
        const testPool = await (0, testDb_1.createTestPool)();
        pool = testPool.pool;
        mockedGetPool.mockReturnValue(pool);
        await (0, tenantManager_1.createTenant)({
            name: 'Teacher School',
            schemaName: 'tenant_alpha'
        }, pool);
        classAId = crypto_1.default.randomUUID();
        classBId = crypto_1.default.randomUUID();
        subjectMathId = crypto_1.default.randomUUID();
        subjectSciId = crypto_1.default.randomUUID();
        teacherId = crypto_1.default.randomUUID();
        assignmentMathId = crypto_1.default.randomUUID();
        const assignmentSciId = crypto_1.default.randomUUID();
        studentAId = crypto_1.default.randomUUID();
        studentBId = crypto_1.default.randomUUID();
        await pool.query(`
        INSERT INTO tenant_alpha.classes (id, name, description)
        VALUES ($1, 'Grade 7', 'Junior class'),
               ($2, 'Grade 8', 'Intermediate class')
      `, [classAId, classBId]);
        await pool.query(`
        INSERT INTO tenant_alpha.subjects (id, name, code)
        VALUES ($1, 'Mathematics', 'MATH'),
               ($2, 'Science', 'SCI')
      `, [subjectMathId, subjectSciId]);
        await pool.query(`
        INSERT INTO tenant_alpha.teachers (id, name, email, subjects)
        VALUES ($1, 'Jane Mentor', 'jane@example.com', '["Mathematics","Science"]'::jsonb)
      `, [teacherId]);
        await pool.query(`
        INSERT INTO tenant_alpha.teacher_assignments (id, teacher_id, class_id, subject_id, is_class_teacher)
        VALUES ($1, $4, $2, $5, TRUE),
               ($3, $4, $2, $6, FALSE)
      `, [assignmentMathId, classAId, assignmentSciId, teacherId, subjectMathId, subjectSciId]);
        await pool.query(`
        INSERT INTO tenant_alpha.students (id, first_name, last_name, class_id, parent_contacts)
        VALUES ($1, 'Alex', 'Johnson', $3, '[]'::jsonb),
               ($2, 'Maya', 'Lee', $3, '[]'::jsonb)
      `, [studentAId, studentBId, classAId]);
        await pool.query(`
        INSERT INTO tenant_alpha.attendance_records (id, student_id, class_id, status, attendance_date)
        VALUES ($1, $3, $4, 'present', '2025-02-01'),
               ($2, $5, $4, 'absent', '2025-02-01')
      `, [crypto_1.default.randomUUID(), crypto_1.default.randomUUID(), studentAId, classAId, studentBId]);
        const invoiceAId = crypto_1.default.randomUUID();
        const invoiceBId = crypto_1.default.randomUUID();
        await pool.query(`
        INSERT INTO tenant_alpha.fee_invoices (id, student_id, amount, status)
        VALUES ($1, $3, 500, 'paid'),
               ($2, $4, 400, 'pending')
      `, [invoiceAId, invoiceBId, studentAId, studentBId]);
        await pool.query(`
        INSERT INTO tenant_alpha.payments (id, invoice_id, provider, provider_payment_id, amount, status)
        VALUES ($1, $2, 'mock-payments', 'mock_tx_1', 500, 'succeeded')
      `, [crypto_1.default.randomUUID(), invoiceAId]);
        const examId = crypto_1.default.randomUUID();
        await pool.query(`
        INSERT INTO tenant_alpha.exams (id, name, exam_date)
        VALUES ($1, 'Mid Term Assessment', '2025-02-15')
      `, [examId]);
        await pool.query(`
        INSERT INTO tenant_alpha.grades (id, student_id, exam_id, subject, score, grade, class_id)
        VALUES ($1, $3, $5, 'Mathematics', 88, 'A', $6),
               ($2, $4, $5, 'Mathematics', 76, 'B', $6)
      `, [crypto_1.default.randomUUID(), crypto_1.default.randomUUID(), studentAId, studentBId, examId, classAId]);
    });
    it('returns overview and classes', async () => {
        const overview = await (0, supertest_1.default)(app_1.default).get('/teacher/overview').set(authHeaders).expect(200);
        expect(overview.body.summary.totalClasses).toBe(1);
        const classes = await (0, supertest_1.default)(app_1.default).get('/teacher/classes').set(authHeaders).expect(200);
        expect(classes.body).toHaveLength(1);
        expect(classes.body[0].subjects[0].name).toBe('Mathematics');
    });
    it('returns roster for assigned class', async () => {
        const roster = await (0, supertest_1.default)(app_1.default)
            .get(`/teacher/classes/${classAId}/roster`)
            .set(authHeaders)
            .expect(200);
        expect(roster.body).toHaveLength(2);
    });
    it('allows requesting assignment drop', async () => {
        const drop = await (0, supertest_1.default)(app_1.default)
            .post(`/teacher/assignments/${assignmentMathId}/drop`)
            .set(authHeaders)
            .expect(200);
        expect(drop.body.metadata.dropRequested).toBeTruthy();
    });
    it('generates class report and pdf', async () => {
        const report = await (0, supertest_1.default)(app_1.default)
            .get(`/teacher/reports/class/${classAId}`)
            .set(authHeaders)
            .expect(200);
        expect(report.body.attendance.total).toBeGreaterThan(0);
        const pdf = await (0, supertest_1.default)(app_1.default)
            .get(`/teacher/reports/class/${classAId}/pdf`)
            .set(authHeaders)
            .expect(200);
        expect(pdf.headers['content-type']).toMatch(/application\/pdf/);
    });
    it('returns messages and profile details', async () => {
        const messages = await (0, supertest_1.default)(app_1.default).get('/teacher/messages').set(authHeaders).expect(200);
        expect(messages.body.length).toBeGreaterThan(0);
        const profile = await (0, supertest_1.default)(app_1.default).get('/teacher/profile').set(authHeaders).expect(200);
        expect(profile.body.name).toBe('Jane Mentor');
    });
});
