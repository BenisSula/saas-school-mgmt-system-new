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
    getPool: jest.fn().mockImplementation(() => {
        throw new Error('should be mocked in test');
    }),
    closePool: jest.fn()
}));
const mockedGetPool = connection_1.getPool;
describe('Configuration routes', () => {
    const headers = { Authorization: 'Bearer fake', 'x-tenant-id': 'tenant_alpha' };
    const mockTerms = [
        { name: 'Term 1 2025', startsOn: '2025-01-10', endsOn: '2025-04-10' },
        { name: 'Term 2 2025', startsOn: '2025-05-05', endsOn: '2025-08-20' }
    ];
    beforeAll(async () => {
        const { pool } = await (0, testDb_1.createTestPool)();
        mockedGetPool.mockReturnValue(pool);
        await (0, tenantManager_1.createTenant)({
            name: 'Alpha Academy',
            schemaName: 'tenant_alpha'
        }, pool);
    });
    it('updates branding', async () => {
        const response = await (0, supertest_1.default)(app_1.default)
            .put('/configuration/branding')
            .set(headers)
            .send({
            logoUrl: 'https://example.com/logo.png',
            primaryColor: '#1d4ed8',
            secondaryColor: '#0f172a',
            themeFlags: { darkMode: true },
            typography: { fontFamily: 'Inter' },
            navigation: { style: 'top', showLogo: true }
        });
        expect(response.status).toBe(200);
        expect(response.body.logo_url).toBe('https://example.com/logo.png');
        const branding = await (0, supertest_1.default)(app_1.default).get('/configuration/branding').set(headers);
        expect(branding.status).toBe(200);
        expect(branding.body.primary_color).toBe('#1d4ed8');
    });
    it('creates, updates, lists, and deletes academic terms and classes', async () => {
        const createdTerms = [];
        for (const termInput of mockTerms) {
            const term = await (0, supertest_1.default)(app_1.default)
                .post('/configuration/terms')
                .set(headers)
                .send(termInput);
            expect(term.status).toBe(201);
            expect(term.body.name).toBe(termInput.name);
            createdTerms.push(term.body);
        }
        const [firstTerm] = createdTerms;
        const updatedTerm = await (0, supertest_1.default)(app_1.default)
            .put(`/configuration/terms/${firstTerm.id}`)
            .set(headers)
            .send({
            name: `${firstTerm.name} Updated`,
            startsOn: firstTerm.starts_on.slice(0, 10),
            endsOn: firstTerm.ends_on.slice(0, 10)
        });
        expect(updatedTerm.status).toBe(200);
        expect(updatedTerm.body.name).toContain('Updated');
        const listTerms = await (0, supertest_1.default)(app_1.default).get('/configuration/terms').set(headers);
        expect(listTerms.status).toBe(200);
        expect(listTerms.body.length).toBeGreaterThanOrEqual(2);
        const listClassesBefore = await (0, supertest_1.default)(app_1.default).get('/configuration/classes').set(headers);
        expect(listClassesBefore.status).toBe(200);
        const classResponse = await (0, supertest_1.default)(app_1.default)
            .post('/configuration/classes')
            .set(headers)
            .send({
            name: 'Grade 10',
            description: 'Senior class'
        });
        expect(classResponse.status).toBe(201);
        expect(classResponse.body.name).toBe('Grade 10');
        const updatedClass = await (0, supertest_1.default)(app_1.default)
            .put(`/configuration/classes/${classResponse.body.id}`)
            .set(headers)
            .send({
            name: 'Grade 10 Updated',
            description: 'Senior class updated'
        });
        expect(updatedClass.status).toBe(200);
        expect(updatedClass.body.name).toBe('Grade 10 Updated');
        const deleteClassResponse = await (0, supertest_1.default)(app_1.default)
            .delete(`/configuration/classes/${classResponse.body.id}`)
            .set(headers);
        expect(deleteClassResponse.status).toBe(204);
        const deleteTermResponse = await (0, supertest_1.default)(app_1.default)
            .delete(`/configuration/terms/${firstTerm.id}`)
            .set(headers);
        expect(deleteTermResponse.status).toBe(204);
        const missingTermDelete = await (0, supertest_1.default)(app_1.default)
            .delete(`/configuration/terms/${firstTerm.id}`)
            .set(headers);
        expect(missingTermDelete.status).toBe(404);
    });
});
