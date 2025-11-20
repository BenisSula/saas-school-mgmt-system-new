"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const crypto_1 = require("crypto");
const app_1 = __importDefault(require("../src/app"));
const testDb_1 = require("./utils/testDb");
const tenantManager_1 = require("../src/db/tenantManager");
const connection_1 = require("../src/db/connection");
jest.mock('../src/middleware/authenticate', () => ({
    __esModule: true,
    default: (req, _res, next) => {
        req.user = {
            id: 'admin-user',
            role: 'admin',
            tenantId: 'tenant_alpha',
            email: 'admin@test.com',
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
describe('Report routes', () => {
    const headers = { Authorization: 'Bearer fake', 'x-tenant-id': 'tenant_alpha' };
    let pool;
    let examId;
    beforeAll(async () => {
        const result = await (0, testDb_1.createTestPool)();
        pool = result.pool;
        mockedGetPool.mockReturnValue(pool);
        await (0, tenantManager_1.createTenant)({
            name: 'Alpha Academy',
            schemaName: 'tenant_alpha'
        }, pool);
        const studentId = (0, crypto_1.randomUUID)();
        const secondStudentId = (0, crypto_1.randomUUID)();
        const classId = 'grade-10';
        const teacherId = (0, crypto_1.randomUUID)();
        examId = (0, crypto_1.randomUUID)();
        await pool.query(`INSERT INTO tenant_alpha.students (id, first_name, last_name, admission_number, class_id)
       VALUES ($1, 'Jane', 'Doe', 'AD-100', $2)`, [studentId, classId]);
        await pool.query(`INSERT INTO tenant_alpha.students (id, first_name, last_name, admission_number, class_id)
       VALUES ($1, 'John', 'Smith', 'AD-101', $2)`, [secondStudentId, classId]);
        await pool.query(`INSERT INTO tenant_alpha.attendance_records (id, student_id, class_id, status, attendance_date, marked_by)
       VALUES
         (uuid_generate_v4(), $1, $3, 'present', '2025-01-01', $4),
         (uuid_generate_v4(), $2, $3, 'late', '2025-01-01', $4)`, [studentId, secondStudentId, classId, teacherId]);
        await pool.query(`INSERT INTO tenant_alpha.exams (id, name, exam_date) VALUES ($1, 'Mid Term', '2025-02-01')`, [examId]);
        await pool.query(`INSERT INTO tenant_alpha.grades (id, student_id, exam_id, subject, score, grade, class_id)
       VALUES
        (uuid_generate_v4(), $1, $2, 'Mathematics', 90, 'A', $3),
        (uuid_generate_v4(), $1, $2, 'Science', 78, 'B', $3)`, [studentId, examId, classId]);
        const invoiceId = (0, crypto_1.randomUUID)();
        await pool.query(`INSERT INTO tenant_alpha.fee_invoices (id, student_id, amount, status, due_date)
       VALUES ($1, $2, 500, 'pending', '2025-03-01')`, [invoiceId, studentId]);
        await pool.query(`INSERT INTO tenant_alpha.payments (id, invoice_id, provider, provider_payment_id, amount, status)
       VALUES (uuid_generate_v4(), $1, 'mock', 'txn_123', 200, 'succeeded')`, [invoiceId]);
    });
    it('returns attendance summary', async () => {
        const response = await (0, supertest_1.default)(app_1.default)
            .get('/reports/attendance?from=2025-01-01&to=2025-01-01')
            .set(headers);
        expect(response.status).toBe(200);
        const attendanceRows = response.body;
        const counts = Object.fromEntries(attendanceRows.map((row) => [row.status, Number(row.count)]));
        expect(counts.present).toBe(1);
        expect(counts.late).toBe(1);
    });
    it('returns grade distribution', async () => {
        const response = await (0, supertest_1.default)(app_1.default)
            .get('/reports/grades')
            .query({ exam_id: examId })
            .set(headers);
        const gradeRows = response.body;
        expect(response.status).toBe(200);
        expect(gradeRows).toEqual(expect.arrayContaining([
            expect.objectContaining({ subject: 'Mathematics', grade: 'A', count: 1 }),
            expect.objectContaining({ subject: 'Science', grade: 'B', count: 1 })
        ]));
    });
    it('returns fee outstanding summary', async () => {
        const response = await (0, supertest_1.default)(app_1.default).get('/reports/fees').set(headers);
        expect(response.status).toBe(200);
        const feeRows = response.body;
        const pending = feeRows.find((row) => row.status === 'pending');
        expect(pending).toBeDefined();
        expect(Number(pending?.invoice_count)).toBe(1);
        expect(Number(pending?.total_amount)).toBe(500);
        expect(Number(pending?.total_paid)).toBe(200);
    });
});
