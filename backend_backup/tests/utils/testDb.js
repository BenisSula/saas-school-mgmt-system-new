"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTestPool = createTestPool;
const crypto_1 = __importDefault(require("crypto"));
const pg_mem_1 = require("pg-mem");
const runMigrations_1 = require("../../src/db/runMigrations");
const tenantManager_1 = require("../../src/db/tenantManager");
async function createTestPool() {
    const db = (0, pg_mem_1.newDb)({
        autoCreateForeignKeyIndices: true,
        noAstCoverageCheck: true
    });
    db.registerExtension('uuid-ossp', (schema) => {
        schema.registerFunction({
            name: 'uuid_generate_v4',
            returns: pg_mem_1.DataType.uuid,
            implementation: () => crypto_1.default.randomUUID()
        });
    });
    const { Pool: MemPool } = db.adapters.createPg();
    const pool = new MemPool();
    await (0, runMigrations_1.runMigrations)(pool);
    await pool.query('CREATE SCHEMA tenant_alpha');
    await (0, tenantManager_1.runTenantMigrations)(pool, 'tenant_alpha');
    return { pool };
}
