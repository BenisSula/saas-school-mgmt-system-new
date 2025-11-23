"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const app_1 = __importDefault(require("../src/app"));
const testDb_1 = require("./utils/testDb");
const tenantManager_1 = require("../src/db/tenantManager");
const connection_1 = require("../src/db/connection");
jest.mock('../src/middleware/authenticate', () => ({
    __esModule: true,
    default: (req, _res, next) => {
        req.user = {
            id: 'auth-user',
            role: 'admin',
            tenantId: 'tenant_alpha',
            email: `admin@test.com`,
            tokenId: 'token'
        };
        next();
    }
}));
jest.mock('../src/middleware/tenantResolver', () => {
    const actual = jest.requireActual('../src/middleware/tenantResolver');
    return actual;
});
jest.mock('../src/db/connection', () => ({
    getPool: jest.fn(),
    closePool: jest.fn()
}));
const mockedGetPool = connection_1.getPool;
describe('Attendance routes', () => {
    beforeAll(async () => {
        const testPool = await (0, testDb_1.createTestPool)();
        mockedGetPool.mockReturnValue(testPool.pool);
        await (0, tenantManager_1.createTenant)({
            name: 'Attendance School',
            schemaName: 'tenant_alpha'
        }, testPool.pool);
        await testPool.pool.query(`
        INSERT INTO tenant_alpha.students (first_name, last_name, admission_number)
        VALUES ('Test', 'Student', 'ADM-001')
      `);
    });
    const teacherHeaders = { Authorization: 'Bearer fake', 'x-tenant-id': 'tenant_alpha' };
    it('marks attendance in bulk and fetches history', async () => {
        const studentIdResult = await mockedGetPool().query(`SELECT id FROM tenant_alpha.students WHERE admission_number = 'ADM-001' LIMIT 1`);
        const studentId = studentIdResult.rows[0].id;
        const mark = await (0, supertest_1.default)(app_1.default)
            .post('/attendance/mark')
            .set(teacherHeaders)
            .send({
            records: [
                {
                    studentId,
                    classId: 'Class-A',
                    status: 'present',
                    markedBy: '11111111-1111-1111-1111-111111111111',
                    date: '2025-01-01'
                }
            ]
        });
        expect(mark.status).toBe(204);
        const secondMark = await (0, supertest_1.default)(app_1.default)
            .post('/attendance/mark')
            .set(teacherHeaders)
            .send({
            records: [
                {
                    studentId,
                    classId: 'Class-A',
                    status: 'present',
                    markedBy: '11111111-1111-1111-1111-111111111111',
                    date: '2025-01-01'
                }
            ]
        });
        expect(secondMark.status).toBe(204);
        const history = await (0, supertest_1.default)(app_1.default)
            .get(`/attendance/${studentId}`)
            .set(teacherHeaders);
        expect(history.status).toBe(200);
        expect(history.body.history.length).toBeGreaterThanOrEqual(1);
    });
    it('returns class report', async () => {
        const report = await (0, supertest_1.default)(app_1.default)
            .get('/attendance/report/class')
            .set(teacherHeaders)
            .query({ class_id: 'Class-A', date: '2025-01-01' });
        expect(report.status).toBe(200);
        expect(report.body.length).toBeGreaterThanOrEqual(1);
    });
});
