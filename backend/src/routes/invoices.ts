import { Router } from 'express';
import authenticate from '../middleware/authenticate';
import tenantResolver from '../middleware/tenantResolver';
import { requirePermission } from '../middleware/rbac';
import { invoiceSchema } from '../validators/invoiceValidator';
import { createInvoice, getInvoicesForStudent } from '../services/invoiceService';

const router = Router();

router.use(authenticate, tenantResolver());

router.get('/', requirePermission('fees:view'), async (req, res, next) => {
  try {
    if (!req.tenantClient || !req.tenant) {
      return res.status(500).json({ message: 'Tenant context missing' });
    }

    const { studentId, status } = req.query;
    let invoices;

    if (studentId && typeof studentId === 'string') {
      invoices = await getInvoicesForStudent(req.tenantClient, req.tenant.schema, studentId);
    } else {
      // List all invoices for the tenant
      const result = await req.tenantClient.query(
        `
          SELECT 
            i.*,
            s.first_name || ' ' || s.last_name as student_name,
            s.admission_number
          FROM ${req.tenant.schema}.fee_invoices i
          LEFT JOIN ${req.tenant.schema}.students s ON i.student_id = s.id
          WHERE ($1::text IS NULL OR i.status = $1)
          ORDER BY i.created_at DESC
          LIMIT 100
        `,
        [status && typeof status === 'string' ? status : null]
      );

      const tenantSchema = req.tenant.schema;
      invoices = await Promise.all(
        result.rows.map(async (invoice) => {
          const [items, payments] = await Promise.all([
            req.tenantClient!.query(
              `SELECT description, amount FROM ${tenantSchema}.fee_items WHERE invoice_id = $1`,
              [invoice.id]
            ),
            req.tenantClient!.query(
              `SELECT amount, status, received_at FROM ${tenantSchema}.payments WHERE invoice_id = $1`,
              [invoice.id]
            )
          ]);

          return {
            ...invoice,
            items: items.rows,
            payments: payments.rows
          };
        })
      );
    }

    res.json(invoices);
  } catch (error) {
    next(error);
  }
});

router.post('/', requirePermission('fees:manage'), async (req, res, next) => {
  try {
    if (!req.tenantClient || !req.tenant) {
      return res.status(500).json({ message: 'Tenant context missing' });
    }

    const parsed = invoiceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }

    const invoice = await createInvoice(
      req.tenantClient,
      req.tenant.schema,
      parsed.data,
      req.user?.id
    );

    res.status(201).json(invoice);
  } catch (error) {
    next(error);
  }
});

router.get('/:studentId', requirePermission('fees:view'), async (req, res, next) => {
  try {
    if (!req.tenantClient || !req.tenant || !req.user) {
      return res.status(500).json({ message: 'Tenant context missing' });
    }

    const studentId = req.params.studentId;
    if (req.user.role === 'student' && req.user.id !== studentId) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const invoices = await getInvoicesForStudent(req.tenantClient, req.tenant.schema, studentId);
    res.json(invoices);
  } catch (error) {
    next(error);
  }
});

export default router;
