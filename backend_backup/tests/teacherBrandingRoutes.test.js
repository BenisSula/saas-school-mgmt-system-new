"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const app_1 = __importDefault(require("../src/app"));
const tenantManager_1 = require("../src/db/tenantManager");
const testDb_1 = require("./utils/testDb");
const connection_1 = require("../src/db/connection");
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
const authHeaders = { Authorization: 'Bearer fake', 'x-tenant-id': 'tenant_alpha' };
jest.mock('../src/db/connection', () => ({
    getPool: jest.fn(),
    closePool: jest.fn()
}));
const mockedGetPool = connection_1.getPool;
describe('Teacher and branding routes', () => {
    beforeAll(async () => {
        const testPool = await (0, testDb_1.createTestPool)();
        mockedGetPool.mockReturnValue(testPool.pool);
        await (0, tenantManager_1.createTenant)({
            name: 'Test School',
            schemaName: 'tenant_alpha'
        }, testPool.pool);
    });
    it('creates and lists teachers', async () => {
        const create = await (0, supertest_1.default)(app_1.default)
            .post('/teachers')
            .set(authHeaders)
            .send({
            name: 'Prof. Turing',
            email: 'turing@test.com',
            subjects: ['Mathematics']
        });
        expect(create.status).toBe(201);
        const list = await (0, supertest_1.default)(app_1.default).get('/teachers').set(authHeaders);
        expect(list.status).toBe(200);
        expect(list.body.length).toBeGreaterThanOrEqual(1);
    });
    it('updates branding', async () => {
        const update = await (0, supertest_1.default)(app_1.default)
            .put('/branding')
            .set(authHeaders)
            .send({
            logoUrl: 'https://example.com/logo.png',
            primaryColor: '#ff0000',
            themeFlags: { darkMode: true }
        });
        expect(update.status).toBe(200);
        expect(update.body.primary_color).toBe('#ff0000');
        const get = await (0, supertest_1.default)(app_1.default).get('/branding').set(authHeaders);
        expect(get.status).toBe(200);
        expect(get.body.primary_color).toBe('#ff0000');
    });
    it('upserts school profile', async () => {
        const update = await (0, supertest_1.default)(app_1.default)
            .put('/school')
            .set(authHeaders)
            .send({
            name: 'Updated Academy',
            address: {
                line1: '123 Main St',
                city: 'Example City'
            }
        });
        expect(update.status).toBe(200);
        expect(update.body.name).toBe('Updated Academy');
        const get = await (0, supertest_1.default)(app_1.default).get('/school').set(authHeaders);
        expect(get.status).toBe(200);
        expect(get.body.name).toBe('Updated Academy');
    });
});
