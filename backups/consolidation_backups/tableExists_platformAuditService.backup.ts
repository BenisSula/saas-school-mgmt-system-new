/**
 * BACKUP: Original tableExists implementation from platformAuditService.ts
 * Date: 2025-11-25
 * This file preserves the original implementation before consolidation
 */

/**
 * Check if a table exists
 * ORIGINAL IMPLEMENTATION - Now replaced with import from dbHelpers
 */
async function tableExists(pool: Pool, schema: string, tableName: string): Promise<boolean> {
  try {
    const result = await pool.query(
      `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = $1 
          AND table_name = $2
        )
      `,
      [schema, tableName]
    );
    return result.rows[0]?.exists || false;
  } catch {
    return false;
  }
}

