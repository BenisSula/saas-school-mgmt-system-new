import { Router } from 'express';
import authenticate from '../../middleware/authenticate';
import { requirePermission } from '../../middleware/rbac';
import { getPool } from '../../db/connection';
import {
  createSubscription,
  updateSubscription,
  getSubscriptionByTenantId,
  cancelSubscription,
  renewSubscription,
  getSubscriptionHistory
} from '../../services/billing/subscriptionService';
import {
  createPlatformInvoice,
  getInvoicesForTenant,
  getInvoiceById,
  markInvoiceAsPaid,
  generateInvoicePdf
} from '../../services/billing/invoiceService';
import {
  createPaymentIntent,
  recordPlatformPayment,
  updatePaymentStatus,
  getPaymentHistory,
  processDunning
} from '../../services/billing/paymentService';
import { z } from 'zod';

const router = Router();

router.use(authenticate, requirePermission('tenants:manage'));

const createSubscriptionSchema = z.object({
  tenantId: z.string().uuid(),
  planId: z.string(),
  planName: z.string(),
  billingCycle: z.enum(['monthly', 'yearly']),
  amount: z.number().positive(),
  currency: z.string().optional(),
  trialDays: z.number().int().min(0).optional(),
  providerSubscriptionId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

const updateSubscriptionSchema = z.object({
  planId: z.string().optional(),
  planName: z.string().optional(),
  status: z.enum(['active', 'canceled', 'past_due', 'trialing', 'unpaid']).optional(),
  cancelAtPeriodEnd: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

// Subscription endpoints
router.post('/subscriptions', async (req, res, next) => {
  try {
    const parsed = createSubscriptionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      const result = await createSubscription(client, parsed.data, req.user?.id);
      res.status(201).json(result);
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

router.get('/subscriptions/:tenantId', async (req, res, next) => {
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const subscription = await getSubscriptionByTenantId(client, req.params.tenantId);
      if (!subscription) {
        return res.status(404).json({ message: 'Subscription not found' });
      }
      res.json(subscription);
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

router.patch('/subscriptions/:subscriptionId', async (req, res, next) => {
  try {
    const parsed = updateSubscriptionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      const subscription = await updateSubscription(client, req.params.subscriptionId, parsed.data, req.user?.id);
      res.json(subscription);
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

router.post('/subscriptions/:subscriptionId/cancel', async (req, res, next) => {
  try {
    const cancelImmediately = req.body.immediate === true;
    const pool = getPool();
    const client = await pool.connect();
    try {
      const subscription = await cancelSubscription(client, req.params.subscriptionId, cancelImmediately, req.user?.id);
      res.json(subscription);
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

router.post('/subscriptions/:subscriptionId/renew', async (req, res, next) => {
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const subscription = await renewSubscription(client, req.params.subscriptionId, req.user?.id);
      res.json(subscription);
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

router.get('/subscriptions/:subscriptionId/history', async (req, res, next) => {
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const history = await getSubscriptionHistory(client, req.params.subscriptionId);
      res.json(history);
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

// Invoice endpoints
router.post('/invoices', async (req, res, next) => {
  try {
    const schema = z.object({
      subscriptionId: z.string().uuid().optional(),
      tenantId: z.string().uuid(),
      amount: z.number().positive(),
      currency: z.string().optional(),
      dueDate: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid datetime format' }).optional(),
      description: z.string().optional(),
      lineItems: z.array(z.object({
        description: z.string(),
        amount: z.number().positive(),
        quantity: z.number().int().positive().optional()
      })).optional()
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      const invoice = await createPlatformInvoice(
        client,
        {
          ...parsed.data,
          dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : undefined
        },
        parsed.data.lineItems
      );
      res.status(201).json(invoice);
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

router.get('/invoices', async (req, res, next) => {
  try {
    const tenantId = req.query.tenantId as string;
    if (!tenantId) {
      return res.status(400).json({ message: 'tenantId is required' });
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      const result = await getInvoicesForTenant(client, tenantId, {
        status: req.query.status as string,
        subscriptionId: req.query.subscriptionId as string,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined
      });
      res.json(result);
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

router.get('/invoices/:invoiceId', async (req, res, next) => {
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const invoice = await getInvoiceById(client, req.params.invoiceId);
      if (!invoice) {
        return res.status(404).json({ message: 'Invoice not found' });
      }
      res.json(invoice);
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

router.get('/invoices/:invoiceId/pdf', async (req, res, next) => {
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const pdfUrl = await generateInvoicePdf(client, req.params.invoiceId);
      res.json({ pdfUrl });
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

// Payment endpoints
router.post('/invoices/:invoiceId/payment-intent', async (req, res, next) => {
  try {
    const tenantId = req.body.tenantId as string;
    if (!tenantId) {
      return res.status(400).json({ message: 'tenantId is required' });
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      const paymentIntent = await createPaymentIntent(client, req.params.invoiceId, tenantId);
      res.json(paymentIntent);
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

router.get('/payments', async (req, res, next) => {
  try {
    const tenantId = req.query.tenantId as string;
    if (!tenantId) {
      return res.status(400).json({ message: 'tenantId is required' });
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      const result = await getPaymentHistory(client, tenantId, {
        invoiceId: req.query.invoiceId as string,
        status: req.query.status as string,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined
      });
      res.json(result);
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

router.post('/payments/webhook', async (req, res, next) => {
  try {
    const schema = z.object({
      provider: z.string(),
      providerPaymentId: z.string(),
      invoiceId: z.string().uuid(),
      tenantId: z.string().uuid(),
      amount: z.number().positive(),
      currency: z.string().optional(),
      status: z.enum(['pending', 'succeeded', 'failed', 'refunded', 'canceled']),
      paymentMethod: z.string().optional(),
      failureReason: z.string().optional()
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      if (parsed.data.status === 'succeeded') {
        await recordPlatformPayment(client, {
          invoiceId: parsed.data.invoiceId,
          tenantId: parsed.data.tenantId,
          amount: parsed.data.amount,
          currency: parsed.data.currency,
          provider: parsed.data.provider,
          providerPaymentId: parsed.data.providerPaymentId,
          paymentMethod: parsed.data.paymentMethod
        });
      }

      await updatePaymentStatus(
        client,
        parsed.data.provider,
        parsed.data.providerPaymentId,
        parsed.data.status,
        parsed.data.failureReason
      );

      res.json({ received: true });
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

router.post('/dunning/:invoiceId', async (req, res, next) => {
  try {
    const attemptNumber = req.body.attemptNumber || 1;
    const pool = getPool();
    const client = await pool.connect();
    try {
      const result = await processDunning(client, req.params.invoiceId, attemptNumber);
      res.json(result);
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

export default router;

