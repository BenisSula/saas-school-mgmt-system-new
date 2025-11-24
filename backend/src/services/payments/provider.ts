export type PaymentIntentRequest = {
  amount: number;
  currency: string;
  invoiceId: string;
  metadata?: Record<string, unknown>;
};

export type PaymentIntentResponse = {
  provider: string;
  clientSecret: string;
  paymentId: string;
};

export type WebhookEvent = {
  provider: string;
  type: 'payment.succeeded' | 'payment.failed' | 'payment.refunded';
  paymentId: string;
  amount: number;
  currency: string;
  invoiceId: string;
  rawPayload: unknown;
};

export interface PaymentProvider {
  createPaymentIntent(input: PaymentIntentRequest): Promise<PaymentIntentResponse>;
  handleWebhook(payload: unknown, signature?: string): Promise<WebhookEvent>;
  confirmPayment(paymentId: string): Promise<WebhookEvent>;
}

class MockPaymentProvider implements PaymentProvider {
  providerName = 'mock-payments';

  async createPaymentIntent(input: PaymentIntentRequest): Promise<PaymentIntentResponse> {
    return {
      provider: this.providerName,
      clientSecret: `cs_${input.invoiceId}`,
      paymentId: `pay_${input.invoiceId}`,
    };
  }

  async handleWebhook(payload: unknown): Promise<WebhookEvent> {
    const data = payload as Record<string, unknown>;
    return {
      provider: this.providerName,
      type: (data.type as WebhookEvent['type']) ?? 'payment.succeeded',
      paymentId: (data.paymentId as string) ?? 'unknown',
      amount: Number(data.amount ?? 0),
      currency: (data.currency as string) ?? 'USD',
      invoiceId: (data.invoiceId as string) ?? 'unknown',
      rawPayload: payload,
    };
  }

  async confirmPayment(paymentId: string): Promise<WebhookEvent> {
    return {
      provider: this.providerName,
      type: 'payment.succeeded',
      paymentId,
      amount: 0,
      currency: 'USD',
      invoiceId: paymentId.replace('pay_', ''),
      rawPayload: {},
    };
  }
}

let providerInstance: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (providerInstance) {
    return providerInstance;
  }

  switch (process.env.PAYMENT_PROVIDER) {
    case 'stripe':
    case 'paystack':
    case 'mollie':
      // Placeholder to plug real implementation later
      providerInstance = new MockPaymentProvider();
      break;
    default:
      providerInstance = new MockPaymentProvider();
  }

  return providerInstance;
}
