"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
jest.mock('../src/middleware/authenticate', () => ({
    __esModule: true,
    default: (req, _res, next) => {
        req.user = {
            id: 'test-user',
            role: 'admin',
            tenantId: 'tenant_alpha',
            email: 'admin@test.com',
            tokenId: 'token'
        };
        next();
    }
}));
const app_1 = __importDefault(require("../src/app"));
const tenantManager_1 = require("../src/db/tenantManager");
const testDb_1 = require("./utils/testDb");
const connection_1 = require("../src/db/connection");
jest.mock('../src/db/connection', () => ({
    getPool: jest.fn(),
    closePool: jest.fn()
}));
const mockedGetPool = connection_1.getPool;
describe('Student routes', () => {
    beforeAll(async () => {
        const testPool = await (0, testDb_1.createTestPool)();
        mockedGetPool.mockReturnValue(testPool.pool);
        await (0, tenantManager_1.createTenant)({
            name: 'Test School',
            schemaName: 'tenant_alpha'
        }, testPool.pool);
    });
    const authHeaders = { Authorization: 'Bearer fake', 'x-tenant-id': 'tenant_alpha' };
    it('creates and retrieves students', async () => {
        const create = await (0, supertest_1.default)(app_1.default)
            .post('/students')
            .set(authHeaders)
            .send({
            firstName: 'Ada',
            lastName: 'Lovelace',
            admissionNumber: 'A001'
        });
        expect(create.status).toBe(201);
        const list = await (0, supertest_1.default)(app_1.default).get('/students').set(authHeaders);
        expect(list.status).toBe(200);
        expect(list.body.length).toBeGreaterThanOrEqual(1);
    });
});
