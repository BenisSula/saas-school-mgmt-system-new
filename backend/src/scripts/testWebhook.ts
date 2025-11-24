/**
 * Script to test Stripe webhook endpoint
 * Sends a test webhook event to verify endpoint is working
 * Usage: ts-node src/scripts/testWebhook.ts
 */

import Stripe from 'stripe';

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';
const WEBHOOK_ENDPOINT = `${API_BASE_URL}/api/webhooks/stripe`;

async function testWebhook(): Promise<void> {
  if (!STRIPE_WEBHOOK_SECRET) {
    console.error('❌ STRIPE_WEBHOOK_SECRET is not set');
    console.error(
      '   For local testing, run: stripe listen --forward-to localhost:3001/api/webhooks/stripe'
    );
    console.error('   Then copy the webhook secret to your .env file');
    process.exit(1);
  }

  console.log('🧪 Testing Stripe Webhook Endpoint...\n');
  console.log(`📍 Endpoint: ${WEBHOOK_ENDPOINT}`);
  console.log(`🔑 Webhook Secret: ${STRIPE_WEBHOOK_SECRET.substring(0, 10)}...\n`);

  // Create a test event payload
  const testSubscription = {
    id: 'sub_test_' + Date.now(),
    object: 'subscription' as const,
    status: 'active' as const,
    customer: 'cus_test',
    current_period_start: Math.floor(Date.now() / 1000),
    current_period_end: Math.floor(Date.now() / 1000) + 2592000, // 30 days
    items: {
      object: 'list' as const,
      data: [],
      has_more: false,
      url: '',
    },
  };

  const testEvent: Stripe.Event = {
    id: 'evt_test_webhook_' + Date.now(),
    object: 'event',
    api_version: '2025-11-17.clover',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: testSubscription as unknown as Stripe.Subscription,
      previous_attributes: {},
    },
    livemode: false,
    pending_webhooks: 0,
    request: {
      id: null,
      idempotency_key: null,
    },
    type: 'customer.subscription.updated',
  };

  // Create signature
  const payload = JSON.stringify(testEvent);
  const signature = Stripe.webhooks.generateTestHeaderString({
    payload,
    secret: STRIPE_WEBHOOK_SECRET,
  });

  console.log('📤 Sending test webhook event...');
  console.log(`   Event Type: ${testEvent.type}`);
  console.log(`   Event ID: ${testEvent.id}\n`);

  try {
    const response = await fetch(WEBHOOK_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': signature,
      },
      body: payload,
    });

    const responseText = await response.text();
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = responseText;
    }

    console.log(`📥 Response Status: ${response.status} ${response.statusText}`);

    if (response.ok) {
      console.log('✅ Webhook endpoint is working!');
      console.log(`\n📋 Response:`, responseData);
    } else {
      console.error('❌ Webhook endpoint returned an error');
      console.error(`\n📋 Response:`, responseData);
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Failed to send webhook:');
    if (error instanceof Error) {
      console.error(`  Error: ${error.message}`);
      if (error.message.includes('fetch')) {
        console.error('\n💡 Make sure the backend server is running:');
        console.error('   npm run dev');
      }
    } else {
      console.error(`  Error: ${String(error)}`);
    }
    process.exit(1);
  }
}

testWebhook().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
