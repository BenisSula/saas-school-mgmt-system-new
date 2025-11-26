import { Router } from 'express';
import { z } from 'zod';
import authenticate from '../middleware/authenticate';
import tenantResolver from '../middleware/tenantResolver';
import ensureTenantContext from '../middleware/ensureTenantContext';
import { requirePermission } from '../middleware/rbac';
import { exportLimiter } from '../middleware/mutationRateLimiter';
// TODO: Fix export service functions - these need to be implemented
// import { exportToPdf, exportToExcel, exportToCsv, type ExportDataRow } from '../services/exportService';
type ExportDataRow = Record<string, string>;
import { listStudents } from '../services/studentService';
import { listTeachers } from '../services/teacherService';
import { listEntities } from '../lib/crudHelpers';

const router = Router();

router.use(authenticate, tenantResolver(), ensureTenantContext());

// Export request schema
const exportRequestSchema = z.object({
  type: z.enum(['students', 'teachers', 'hods', 'custom']),
  format: z.enum(['pdf', 'excel', 'csv']),
  title: z.string().optional(),
  columns: z
    .array(
      z.object({
        key: z.string(),
        label: z.string(),
      })
    )
    .optional(),
  filters: z
    .object({
      classId: z.string().optional(),
      enrollmentStatus: z.string().optional(),
      search: z.string().optional(),
    })
    .optional(),
  customData: z.array(z.record(z.string(), z.unknown())).optional(), // For custom exports
});

/**
 * POST /export
 * Export data in PDF, Excel, or CSV format
 */
router.post('/', requirePermission('reports:view'), exportLimiter, async (req, res, next) => {
  try {
    if (!req.user || !req.tenant || !req.tenantClient) {
      return res.status(500).json({ message: 'User or tenant context missing' });
    }

    const parsed = exportRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }

    const { type, filters, customData } = parsed.data;

    let data: ExportDataRow[] = [];

    // Fetch data based on type
    if (type === 'students') {
      const students = await listStudents(
        req.tenantClient,
        req.tenant.schema,
        filters
          ? {
              enrollmentStatus: filters.enrollmentStatus,
              classId: filters.classId,
              search: filters.search,
            }
          : undefined
      );
      // Filters are already applied by listStudents service
      data = students.map(
        (s: Record<string, unknown>): ExportDataRow => ({
          'First Name': String(s.first_name || ''),
          'Last Name': String(s.last_name || ''),
          'Admission Number': String(s.admission_number || ''),
          Class: String(s.class_id || ''),
          'Date of Birth': s.date_of_birth
            ? new Date(s.date_of_birth as string).toLocaleDateString()
            : '',
          'Enrollment Status': String(s.enrollment_status || 'active'),
        })
      );
    } else if (type === 'teachers') {
      const teachers = await listTeachers(req.tenantClient, req.tenant.schema);

      data = (teachers as Record<string, unknown>[]).map(
        (t: Record<string, unknown>): ExportDataRow => ({
          Name: String(t.name || ''),
          Email: String(t.email || ''),
          Subjects: Array.isArray(t.subjects) ? (t.subjects as string[]).join(', ') : '',
          Classes: Array.isArray(t.assigned_classes)
            ? (t.assigned_classes as string[]).join(', ')
            : '',
        })
      );
    } else if (type === 'hods') {
      // Get users with HOD role from shared.users table
      const users = await listEntities<
        Record<string, unknown> & {
          additional_roles?: Array<{ role: string; metadata?: { department?: string } }>;
        }
      >(req.tenantClient, req.tenant.schema, 'users');
      const hods = users.filter((u) =>
        u.additional_roles?.some((r: { role: string }) => r.role === 'hod')
      );

      data = hods.map((h): ExportDataRow => {
        const hodRole = h.additional_roles?.find((r: { role: string }) => r.role === 'hod');
        return {
          Name: String(h.name || h.full_name || ''),
          Email: String(h.email || ''),
          Department: String(hodRole?.metadata?.department || ''),
        };
      });
    } else if (type === 'custom' && customData) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      data = customData as ExportDataRow[];
    } else {
      return res.status(400).json({ message: 'Invalid export type or missing data' });
    }

    // TODO: Implement export functions in exportService
    // For now, return error for PDF/Excel/CSV exports
    // Note: data variable is prepared but not used yet (will be used when export is implemented)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    void data; // Suppress unused variable warning until export is implemented
    return res.status(501).json({
      message:
        'Export functionality not yet implemented. Use teacher-specific export endpoints instead.',
    });
  } catch (error) {
    next(error);
    return;
  }
});

export default router;
