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
            id: 'super-admin',
            role: 'superadmin',
            tenantId: 'tenant_alpha',
            email: 'super@test.com',
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
describe('User management routes', () => {
    const headers = { Authorization: 'Bearer fake', 'x-tenant-id': 'tenant_alpha' };
    let tenantId;
    let targetUserId;
    beforeAll(async () => {
        const { pool } = await (0, testDb_1.createTestPool)();
        mockedGetPool.mockReturnValue(pool);
        const tenant = await (0, tenantManager_1.createTenant)({
            name: 'Alpha Academy',
            schemaName: 'tenant_alpha'
        }, pool);
        tenantId = tenant.id;
        targetUserId = (0, crypto_1.randomUUID)();
        await pool.query(`
        INSERT INTO shared.users (id, email, password_hash, role, tenant_id, is_verified)
        VALUES ($1, 'teacher@test.com', 'hash', 'teacher', $2, true)
      `, [targetUserId, tenantId]);
    });
    it('lists tenant users', async () => {
        const response = await (0, supertest_1.default)(app_1.default).get('/users').set(headers);
        expect(response.status).toBe(200);
        expect(response.body).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: targetUserId,
                email: 'teacher@test.com',
                role: 'teacher'
            })
        ]));
    });
    it('updates a user role', async () => {
        const response = await (0, supertest_1.default)(app_1.default)
            .patch(`/users/${targetUserId}/role`)
            .set(headers)
            .send({ role: 'admin' });
        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
            id: targetUserId,
            role: 'admin'
        });
        const listAfter = await (0, supertest_1.default)(app_1.default).get('/users').set(headers);
        const updated = listAfter.body.find((user) => user.id === targetUserId);
        expect(updated).toBeDefined();
        expect(updated?.role).toBe('admin');
    });
});
