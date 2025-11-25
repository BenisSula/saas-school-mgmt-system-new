import { Router } from 'express';
import tenantResolver from '../middleware/tenantResolver';
import { getPaymentProvider } from '../services/payments/provider';
import { recordPaymentEvent } from '../services/paymentService';

const router = Router();

router.post('/', tenantResolver(), async (req, res, next) => {
  try {
    if (!req.tenantClient || !req.tenant) {
      return res.status(500).json({ message: 'Tenant context missing' });
    }
    const provider = getPaymentProvider();
    const signature = req.headers['stripe-signature'] as string | undefined;
    const event = await provider.handleWebhook(req.body, signature);
    await recordPaymentEvent(req.tenantClient, req.tenant.schema, event);
    res.status(200).json({ received: true });
  } catch (error) {
    next(error);
    return;
  }
});

export default router;
