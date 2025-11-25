/**
 * Script to verify Stripe configuration
 * Checks environment variables and Stripe API connectivity
 * Usage: ts-node src/scripts/verifyStripeConfig.ts
 */

import Stripe from 'stripe';

async function verifyStripeConfig(): Promise<void> {
  console.log('🔍 Verifying Stripe Configuration...\n');

  // Check environment variables
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const billingCurrency = process.env.BILLING_DEFAULT_CURRENCY || 'USD';

  console.log('📋 Environment Variables:');
  console.log(`  STRIPE_SECRET_KEY: ${stripeSecretKey ? '✅ Set' : '❌ Missing'}`);
  console.log(`  STRIPE_WEBHOOK_SECRET: ${stripeWebhookSecret ? '✅ Set' : '❌ Missing'}`);
  console.log(`  BILLING_DEFAULT_CURRENCY: ${billingCurrency}`);

  if (!stripeSecretKey) {
    console.error('\n❌ STRIPE_SECRET_KEY is required');
    process.exit(1);
  }

  if (!stripeWebhookSecret) {
    console.warn('\n⚠️  STRIPE_WEBHOOK_SECRET is not set. Webhook verification will fail.');
    console.warn('   For local development, use: stripe listen --forward-to localhost:3001/api/webhooks/stripe');
  }

  // Test Stripe API connection
  console.log('\n🔌 Testing Stripe API Connection...');
  try {
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2025-11-17.clover'
    });

    // Test API connection by retrieving account
    const account = await stripe.accounts.retrieve();
    console.log(`  ✅ Connected to Stripe`);
    console.log(`  Account ID: ${account.id}`);
    console.log(`  Account Type: ${account.type || 'Standard'}`);
    console.log(`  Country: ${account.country || 'N/A'}`);

    // Check if in test mode
    const isTestMode = stripeSecretKey.startsWith('sk_test_');
    console.log(`  Mode: ${isTestMode ? '🧪 Test Mode' : '🚀 Live Mode'}`);

    // List products to verify access
    console.log('\n📦 Checking Products...');
    const products = await stripe.products.list({ limit: 5 });
    console.log(`  Found ${products.data.length} product(s)`);
    if (products.data.length > 0) {
      console.log('  Products:');
      for (const product of products.data.slice(0, 3)) {
        console.log(`    - ${product.name} (${product.id})`);
      }
    } else {
      console.warn('  ⚠️  No products found. Create products in Stripe Dashboard.');
    }

    // List prices
    console.log('\n💰 Checking Prices...');
    const prices = await stripe.prices.list({ limit: 5 });
    console.log(`  Found ${prices.data.length} price(s)`);
    if (prices.data.length > 0) {
      console.log('  Prices:');
      for (const price of prices.data.slice(0, 3)) {
        const amount = price.unit_amount ? (price.unit_amount / 100).toFixed(2) : 'N/A';
        const currency = price.currency.toUpperCase();
        console.log(`    - ${price.id}: ${currency} ${amount}/${price.recurring?.interval || 'one-time'}`);
      }
    } else {
      console.warn('  ⚠️  No prices found. Create prices in Stripe Dashboard.');
    }

    console.log('\n✅ Stripe configuration verified successfully!');
    console.log('\n📝 Next Steps:');
    console.log('  1. Create products and prices in Stripe Dashboard');
    console.log('  2. Configure webhook endpoint (see STRIPE_WEBHOOK_CONFIGURATION.md)');
    console.log('  3. Test subscription creation');
  } catch (error) {
    console.error('\n❌ Failed to connect to Stripe API:');
    if (error instanceof Stripe.errors.StripeError) {
      console.error(`  Error: ${error.message}`);
      console.error(`  Type: ${error.type}`);
    } else {
      console.error(`  Error: ${error instanceof Error ? error.message : String(error)}`);
    }
    process.exit(1);
  }
}

verifyStripeConfig().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});

