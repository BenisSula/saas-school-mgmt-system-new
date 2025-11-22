import { Router } from 'express';
import { z } from 'zod';
import authenticate from '../middleware/authenticate';
import tenantResolver from '../middleware/tenantResolver';
import ensureTenantContext from '../middleware/ensureTenantContext';
import { requirePermission } from '../middleware/rbac';
import { exportLimiter } from '../middleware/mutationRateLimiter';
import { exportToPdf, exportToExcel, exportToCsv, type ExportDataRow } from '../services/exportService';
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
  columns: z.array(z.object({
    key: z.string(),
    label: z.string()
  })).optional(),
  filters: z.object({
    classId: z.string().optional(),
    enrollmentStatus: z.string().optional(),
    search: z.string().optional()
  }).optional(),
  customData: z.array(z.record(z.string(), z.unknown())).optional() // For custom exports
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

    const { type, format, title, columns, filters, customData } = parsed.data;

    let data: ExportDataRow[] = [];
    let defaultColumns: Array<{ key: string; label: string }> = [];
    let exportTitle = title || 'Export';

    // Fetch data based on type
    if (type === 'students') {
      const students = await listStudents(
        req.tenantClient,
        req.tenant.schema,
        filters ? {
          enrollmentStatus: filters.enrollmentStatus,
          classId: filters.classId,
          search: filters.search
        } : undefined
      );
      // Filters are already applied by listStudents service
      data = students.map((s: Record<string, unknown>): ExportDataRow => ({
        'First Name': String(s.first_name || ''),
        'Last Name': String(s.last_name || ''),
        'Admission Number': String(s.admission_number || ''),
        'Class': String(s.class_id || ''),
        'Date of Birth': s.date_of_birth ? new Date(s.date_of_birth as string).toLocaleDateString() : '',
        'Enrollment Status': String(s.enrollment_status || 'active')
      }));

      defaultColumns = [
        { key: 'First Name', label: 'First Name' },
        { key: 'Last Name', label: 'Last Name' },
        { key: 'Admission Number', label: 'Admission Number' },
        { key: 'Class', label: 'Class' },
        { key: 'Date of Birth', label: 'Date of Birth' },
        { key: 'Enrollment Status', label: 'Enrollment Status' }
      ];
      exportTitle = title || 'Students Export';
    } else if (type === 'teachers') {
      const teachers = await listTeachers(req.tenantClient, req.tenant.schema);
      
      data = (teachers as Record<string, unknown>[]).map((t: Record<string, unknown>): ExportDataRow => ({
        'Name': String(t.name || ''),
        'Email': String(t.email || ''),
        'Subjects': Array.isArray(t.subjects) ? (t.subjects as string[]).join(', ') : '',
        'Classes': Array.isArray(t.assigned_classes) ? (t.assigned_classes as string[]).join(', ') : ''
      }));

      defaultColumns = [
        { key: 'Name', label: 'Name' },
        { key: 'Email', label: 'Email' },
        { key: 'Subjects', label: 'Subjects' },
        { key: 'Classes', label: 'Classes' }
      ];
      exportTitle = title || 'Teachers Export';
    } else if (type === 'hods') {
      // Get users with HOD role from shared.users table
      const users = await listEntities<Record<string, unknown> & { additional_roles?: Array<{ role: string; metadata?: { department?: string } }> }>(
        req.tenantClient,
        req.tenant.schema,
        'users'
      );
      const hods = users.filter((u) =>
        u.additional_roles?.some((r: { role: string }) => r.role === 'hod')
      );

      data = hods.map((h): ExportDataRow => {
        const hodRole = h.additional_roles?.find((r: { role: string }) => r.role === 'hod');
        return {
          'Name': String(h.name || h.full_name || ''),
          'Email': String(h.email || ''),
          'Department': String(hodRole?.metadata?.department || '')
        };
      });

      defaultColumns = [
        { key: 'Name', label: 'Name' },
        { key: 'Email', label: 'Email' },
        { key: 'Department', label: 'Department' }
      ];
      exportTitle = title || 'HODs Export';
    } else if (type === 'custom' && customData) {
      data = customData as ExportDataRow[];
      if (!columns || columns.length === 0) {
        // Infer columns from first row
        if (data.length > 0) {
          defaultColumns = Object.keys(data[0]).map(key => ({ key, label: key }));
        }
      } else {
        defaultColumns = columns;
      }
      exportTitle = title || 'Custom Export';
    } else {
      return res.status(400).json({ message: 'Invalid export type or missing data' });
    }

    // Use provided columns or defaults
    const exportColumns = columns && columns.length > 0 ? columns : defaultColumns;

    // Generate export
    let buffer: Buffer;
    let mimeType: string;
    let fileExtension: string;

    if (format === 'pdf') {
      buffer = await exportToPdf({
        data,
        columns: exportColumns,
        title: exportTitle,
        metadata: {
          exportedAt: new Date().toISOString(),
          exportedBy: req.user.email,
          totalRows: data.length
        }
      });
      mimeType = 'application/pdf';
      fileExtension = 'pdf';
    } else if (format === 'excel') {
      buffer = exportToExcel({
        data,
        columns: exportColumns,
        title: exportTitle
      });
      mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      fileExtension = 'xlsx';
    } else {
      buffer = exportToCsv({
        data,
        columns: exportColumns,
        title: exportTitle
      });
      mimeType = 'text/csv';
      fileExtension = 'csv';
    }

    // Set response headers
    const filename = `${exportTitle.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.${fileExtension}`;
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length.toString());

    res.send(buffer);
  } catch (error) {
    next(error);
  }
});

export default router;

