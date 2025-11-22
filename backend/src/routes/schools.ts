import { Router, Request, Response } from 'express';
import { getPool } from '../db/connection';
import { z } from 'zod';
import { assertValidSchemaName } from '../db/tenantManager';

const router = Router();

interface TenantRow {
  id: string;
  name: string;
  schema_name: string;
  created_at: Date;
  status: string;
}

interface SchoolResponse {
  id: string;
  name: string;
  logo_url: string | null;
  metric_label: string;
  metric_value: number;
}

/**
 * Public endpoint to get top schools for landing page
 * No authentication required
 */
router.get('/top', async (req: Request, res: Response): Promise<void> => {
  try {
    const limitSchema = z.object({
      limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 5))
    });
    
    const parsed = limitSchema.safeParse(req.query);
    const limit = parsed.success ? parsed.data.limit : 5;
    const safeLimit = Math.min(Math.max(limit || 5, 1), 20); // Clamp between 1 and 20

    const pool = getPool();
    
    // Get active tenants (schools)
    const schoolsResult = await pool.query<TenantRow>(
      `
        SELECT 
          id,
          name,
          schema_name,
          created_at,
          status
        FROM shared.tenants
        WHERE status = 'active'
        ORDER BY created_at DESC
        LIMIT $1
      `,
      [safeLimit]
    );

    const schools: SchoolResponse[] = await Promise.all(
      schoolsResult.rows.map(async (tenant): Promise<SchoolResponse> => {
        let logoUrl: string | null = null;
        let studentCount = 0;

        // Get logo and student count from tenant's schema
        try {
          // Validate schema name to prevent SQL injection
          assertValidSchemaName(tenant.schema_name);
          
          // Use a client with the tenant's schema set
          const client = await pool.connect();
          try {
            // Set search path to tenant schema
            // Note: SET search_path cannot use parameterized queries, but schema name is validated via assertValidSchemaName above
            await client.query(`SET search_path TO ${tenant.schema_name}, public`);
            
            // Get logo from branding settings
            const brandingResult = await client.query<{ logo_url: string | null }>(
              `SELECT logo_url FROM branding_settings ORDER BY updated_at DESC LIMIT 1`
            );
            logoUrl = brandingResult.rows[0]?.logo_url || null;
            
            // Get student count
            const studentCountResult = await client.query<{ count: string }>(
              `SELECT COUNT(*) as count FROM students`
            );
            studentCount = parseInt(studentCountResult.rows[0]?.count || '0', 10);
          } finally {
            client.release();
          }
        } catch (err: unknown) {
          // If schema doesn't exist or query fails, continue with defaults
          const errorMessage = err instanceof Error ? err.message : String(err);
          console.error(`[schools/top] Error querying tenant ${tenant.id}:`, errorMessage);
        }

        return {
          id: tenant.id,
          name: tenant.name,
          logo_url: logoUrl,
          metric_label: 'Students',
          metric_value: studentCount
        };
      })
    );

    res.json(schools);
  } catch (error: unknown) {
    // Don't expose internal errors to public endpoint
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[schools/top] Error:', errorMessage);
    res.json([]); // Return empty array on error
  }
});

export default router;

