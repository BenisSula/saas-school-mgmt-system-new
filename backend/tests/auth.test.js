"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const app_1 = __importDefault(require("../src/app"));
const testDb_1 = require("./utils/testDb");
const connection_1 = require("../src/db/connection");
jest.mock('../src/db/connection', () => ({
    getPool: jest.fn(),
    closePool: jest.fn()
}));
const mockedGetPool = connection_1.getPool;
jest.setTimeout(15000);
describe('Authentication & RBAC', () => {
    let pool;
    let tenantId;
    beforeAll(async () => {
        process.env.JWT_ACCESS_SECRET = 'test-access-secret';
        process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
        process.env.ACCESS_TOKEN_TTL = '900s';
        process.env.REFRESH_TOKEN_TTL = (60 * 60).toString();
        const testPool = await (0, testDb_1.createTestPool)();
        pool = testPool.pool;
        mockedGetPool.mockReturnValue(pool);
        const tenantResult = await pool.query(`
        INSERT INTO shared.tenants (name, domain, schema_name)
        VALUES ($1, $2, $3)
        RETURNING id
      `, ['Test Academy', 'test.local', 'tenant_test']);
        tenantId = tenantResult.rows[0].id;
    });
    it('allows signup, login, refresh, and access to protected route', async () => {
        const email = 'admin@testacademy.com';
        const password = 'StrongPassw0rd!';
        const signupResponse = await (0, supertest_1.default)(app_1.default).post('/auth/signup').send({
            email,
            password,
            role: 'admin',
            tenantId
        });
        expect(signupResponse.status).toBe(201);
        expect(signupResponse.body).toHaveProperty('accessToken');
        expect(signupResponse.body.user.role).toBe('admin');
        expect(signupResponse.body.user.tenantId).toBe(tenantId);
        const loginResponse = await (0, supertest_1.default)(app_1.default).post('/auth/login').send({
            email,
            password
        });
        expect(loginResponse.status).toBe(200);
        expect(loginResponse.body).toHaveProperty('accessToken');
        expect(loginResponse.body).toHaveProperty('refreshToken');
        const accessToken = loginResponse.body.accessToken;
        const refreshToken = loginResponse.body.refreshToken;
        const protectedResponse = await (0, supertest_1.default)(app_1.default)
            .get('/admin/overview')
            .set('Authorization', `Bearer ${accessToken}`);
        expect(protectedResponse.status).toBe(200);
        expect(protectedResponse.body.message).toContain('Welcome');
        const refreshResponse = await (0, supertest_1.default)(app_1.default).post('/auth/refresh').send({
            refreshToken
        });
        expect(refreshResponse.status).toBe(200);
        expect(refreshResponse.body).toHaveProperty('accessToken');
        expect(refreshResponse.body).toHaveProperty('refreshToken');
    });
    it('blocks users without permission from protected route', async () => {
        const email = 'student@testacademy.com';
        const password = 'StrongPassw0rd!';
        const signupResponse = await (0, supertest_1.default)(app_1.default).post('/auth/signup').send({
            email,
            password,
            role: 'student',
            tenantId
        });
        expect(signupResponse.status).toBe(201);
        const loginResponse = await (0, supertest_1.default)(app_1.default).post('/auth/login').send({
            email,
            password
        });
        expect(loginResponse.status).toBe(200);
        const studentToken = loginResponse.body.accessToken;
        const protectedResponse = await (0, supertest_1.default)(app_1.default)
            .get('/admin/overview')
            .set('Authorization', `Bearer ${studentToken}`);
        expect(protectedResponse.status).toBe(403);
    });
});
