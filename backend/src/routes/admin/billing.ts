/**
 * Admin Billing Routes
 * Tenant-level billing management (subscriptions, invoices, payments)
 * Phase 8.1 - Billing & Stripe Integration
 */

import { Router } from 'express';
import authenticate from '../../middleware/authenticate';
import tenantResolver from '../../middleware/tenantResolver';
import ensureTenantContext from '../../middleware/ensureTenantContext';
import { requirePermission } from '../../middleware/rbac';
import { getPool } from '../../db/connection';
import { validateContextOrRespond } from '../../lib/contextHelpers';
import { createSuccessResponse, createErrorResponse } from '../../lib/responseHelpers';
import {
  createStripeSubscription,
  updateStripeSubscription,
  cancelStripeSubscription,
} from '../../services/billing/stripeService';
import { getSubscriptionByTenantId } from '../../services/billing/subscriptionService';
import { getInvoicesForTenant, getInvoiceById } from '../../services/billing/invoiceService';
import { getPaymentHistory } from '../../services/billing/paymentService';
import { z } from 'zod';

const router = Router();

router.use(authenticate, tenantResolver(), ensureTenantContext, requirePermission('billing:view'));

/**
 * GET /admin/billing/subscription
 * Get current tenant subscription
 */
router.get('/subscription', async (req, res, next) => {
  try {
    const context = validateContextOrRespond(req, res);
    if (!context) return;
    const { tenant } = context;

    const pool = getPool();
    const client = await pool.connect();
    try {
      const subscription = await getSubscriptionByTenantId(client, tenant.id);
      if (!subscription) {
        return res.status(404).json(createErrorResponse('No subscription found for this tenant'));
      }
      res.json(createSuccessResponse(subscription, 'Subscription retrieved successfully'));
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

/**
 * POST /admin/billing/subscription/subscribe
 * Create subscription for tenant (admin only)
 */
router.post(
  '/subscription/subscribe',
  requirePermission('billing:manage'),
  async (req, res, next) => {
    try {
      const context = validateContextOrRespond(req, res);
      if (!context) return;
      const { tenant } = context;

      const schema = z.object({
        priceId: z.string().min(1, 'Stripe price ID is required'),
        trialDays: z.number().int().min(0).max(365).optional(),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json(createErrorResponse(parsed.error.message));
      }

      const pool = getPool();
      const client = await pool.connect();
      try {
        // Get tenant name for customer creation
        const tenantResult = await client.query<{ name: string }>(
          'SELECT name FROM shared.tenants WHERE id = $1',
          [tenant.id]
        );

        if (tenantResult.rows.length === 0) {
          return res.status(404).json(createErrorResponse('Tenant not found'));
        }

        const subscription = await createStripeSubscription(
          client,
          tenant.id,
          parsed.data.priceId,
          {
            trialDays: parsed.data.trialDays,
            metadata: {
              created_by: req.user?.id,
              created_via: 'admin_portal',
            },
          }
        );

        res
          .status(201)
          .json(createSuccessResponse(subscription, 'Subscription created successfully'));
      } finally {
        client.release();
      }
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /admin/billing/subscription/cancel
 * Cancel subscription
 */
router.post('/subscription/cancel', requirePermission('billing:manage'), async (req, res, next) => {
  try {
    const context = validateContextOrRespond(req, res);
    if (!context) return;
    const { tenant } = context;

    const schema = z.object({
      cancelImmediately: z.boolean().optional().default(false),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(createErrorResponse(parsed.error.message));
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      const subscription = await getSubscriptionByTenantId(client, tenant.id);
      if (!subscription) {
        return res.status(404).json(createErrorResponse('No subscription found'));
      }

      const stripeSubscriptionId = (subscription as { stripe_subscription_id?: string })
        .stripe_subscription_id;
      if (!stripeSubscriptionId) {
        return res.status(400).json(createErrorResponse('Subscription is not linked to Stripe'));
      }

      const canceledSubscription = await cancelStripeSubscription(
        client,
        stripeSubscriptionId,
        parsed.data.cancelImmediately
      );

      res.json(createSuccessResponse(canceledSubscription, 'Subscription canceled successfully'));
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

/**
 * POST /admin/billing/subscription/update-plan
 * Update subscription plan (with proration)
 */
router.post(
  '/subscription/update-plan',
  requirePermission('billing:manage'),
  async (req, res, next) => {
    try {
      const context = validateContextOrRespond(req, res);
      if (!context) return;
      const { tenant } = context;

      const schema = z.object({
        newPriceId: z.string().min(1, 'New Stripe price ID is required'),
        prorate: z.boolean().optional().default(true),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json(createErrorResponse(parsed.error.message));
      }

      const pool = getPool();
      const client = await pool.connect();
      try {
        const subscription = await getSubscriptionByTenantId(client, tenant.id);
        if (!subscription) {
          return res.status(404).json(createErrorResponse('No subscription found'));
        }

        const stripeSubscriptionId = (subscription as { stripe_subscription_id?: string })
          .stripe_subscription_id;
        if (!stripeSubscriptionId) {
          return res.status(400).json(createErrorResponse('Subscription is not linked to Stripe'));
        }

        const updatedSubscription = await updateStripeSubscription(
          client,
          stripeSubscriptionId,
          parsed.data.newPriceId,
          parsed.data.prorate
        );

        res.json(createSuccessResponse(updatedSubscription, 'Subscription updated successfully'));
      } finally {
        client.release();
      }
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /admin/billing/invoices
 * Get invoices for tenant
 */
router.get('/invoices', async (req, res, next) => {
  try {
    const context = validateContextOrRespond(req, res);
    if (!context) return;
    const { tenant } = context;

    const pool = getPool();
    const client = await pool.connect();
    try {
      const result = await getInvoicesForTenant(client, tenant.id, {
        status: req.query.status as string,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
      });
      res.json(createSuccessResponse(result, 'Invoices retrieved successfully'));
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

/**
 * GET /admin/billing/invoices/:invoiceId
 * Get invoice by ID
 */
router.get('/invoices/:invoiceId', async (req, res, next) => {
  try {
    const context = validateContextOrRespond(req, res);
    if (!context) return;
    const { tenant } = context;

    const pool = getPool();
    const client = await pool.connect();
    try {
      const invoice = await getInvoiceById(client, req.params.invoiceId);
      if (!invoice) {
        return res.status(404).json(createErrorResponse('Invoice not found'));
      }

      // Verify invoice belongs to tenant
      if ((invoice as { tenant_id: string }).tenant_id !== tenant.id) {
        return res.status(403).json(createErrorResponse('Access denied'));
      }

      res.json(createSuccessResponse(invoice, 'Invoice retrieved successfully'));
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

/**
 * GET /admin/billing/payments
 * Get payment history for tenant
 */
router.get('/payments', async (req, res, next) => {
  try {
    const context = validateContextOrRespond(req, res);
    if (!context) return;
    const { tenant } = context;

    const pool = getPool();
    const client = await pool.connect();
    try {
      const result = await getPaymentHistory(client, tenant.id, {
        invoiceId: req.query.invoiceId as string,
        status: req.query.status as string,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
      });
      res.json(createSuccessResponse(result, 'Payments retrieved successfully'));
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

export default router;
