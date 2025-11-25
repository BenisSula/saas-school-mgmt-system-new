/**
 * Script to test subscription creation
 * Creates a test subscription for a tenant
 * Usage: ts-node src/scripts/testSubscriptionCreation.ts <tenantId> <priceId>
 */

import { getPool, closePool } from '../db/connection';
import {
  getOrCreateStripeCustomer,
  createStripeSubscription,
} from '../services/billing/stripeService';
import { listTenants } from '../services/shared/tenantQueries';

async function testSubscriptionCreation(): Promise<void> {
  const args = process.argv.slice(2);
  const tenantId = args[0];
  const priceId = args[1];

  if (!tenantId) {
    console.error('❌ Usage: ts-node src/scripts/testSubscriptionCreation.ts <tenantId> <priceId>');
    console.error('\nExample:');
    console.error('  ts-node src/scripts/testSubscriptionCreation.ts tenant-123 price_1234567890');
    process.exit(1);
  }

  if (!priceId) {
    console.error('❌ Price ID is required');
    console.error('   Get price ID from Stripe Dashboard → Products → Prices');
    process.exit(1);
  }

  const pool = getPool();

  try {
    console.log('🔍 Finding tenant...');
    const tenants = await listTenants();
    const tenant = tenants.find((t) => t.id === tenantId);

    if (!tenant) {
      console.error(`❌ Tenant not found: ${tenantId}`);
      console.log('\nAvailable tenants:');
      tenants.forEach((t) => {
        console.log(`  - ${t.id} (${t.name})`);
      });
      process.exit(1);
    }

    console.log(`✅ Found tenant: ${tenant.name} (${tenant.id})`);

    // Get tenant admin email for customer creation
    const client = await pool.connect();
    try {
      const userResult = await client.query(
        `SELECT email, first_name, last_name 
         FROM shared.users 
         WHERE tenant_id = $1 AND role = 'admin' 
         LIMIT 1`,
        [tenant.id]
      );

      if (userResult.rows.length === 0) {
        console.error('❌ No admin user found for tenant');
        process.exit(1);
      }

      const adminUser = userResult.rows[0];
      const customerEmail = adminUser.email;
      const customerName =
        `${adminUser.first_name || ''} ${adminUser.last_name || ''}`.trim() || tenant.name;

      console.log(`\n👤 Creating Stripe customer...`);
      const customerId = await getOrCreateStripeCustomer(
        client,
        tenant.id,
        customerName,
        customerEmail
      );
      console.log(`✅ Customer ID: ${customerId}`);

      console.log(`\n💳 Creating subscription...`);
      console.log(`   Price ID: ${priceId}`);
      console.log(`   Customer ID: ${customerId}`);

      await createStripeSubscription(client, tenant.id, priceId);
      // Get subscription from database
      const subResult = await client.query<{
        id: string;
        tenant_id: string;
        stripe_subscription_id?: string;
        plan_id: string;
        status: string;
        current_period_end?: Date | string;
        price_cents?: number;
        currency?: string;
      }>(
        'SELECT * FROM shared.subscriptions WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 1',
        [tenant.id]
      );

      if (subResult.rows.length === 0) {
        console.error('❌ Subscription created in Stripe but not found in database');
        process.exit(1);
      }

      const dbSubscription = subResult.rows[0];
      console.log(`\n✅ Subscription created successfully!`);
      console.log(`\n📋 Subscription Details:`);
      console.log(`   Subscription ID: ${dbSubscription.id}`);
      console.log(`   Stripe Subscription ID: ${dbSubscription.stripe_subscription_id || 'N/A'}`);
      console.log(`   Status: ${dbSubscription.status}`);
      console.log(`   Plan ID: ${dbSubscription.plan_id}`);
      if (dbSubscription.current_period_end) {
        console.log(
          `   Current Period End: ${new Date(dbSubscription.current_period_end).toLocaleString()}`
        );
      }
      if (dbSubscription.price_cents) {
        const amount = (dbSubscription.price_cents / 100).toFixed(2);
        console.log(`   Amount: ${dbSubscription.currency || 'USD'} ${amount}`);
      }

      if (dbSubscription.stripe_subscription_id) {
        console.log(`\n🔗 View in Stripe Dashboard:`);
        console.log(
          `   https://dashboard.stripe.com/subscriptions/${dbSubscription.stripe_subscription_id}`
        );
      }

      console.log(`\n✅ Test completed successfully!`);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('\n❌ Failed to create subscription:');
    if (error instanceof Error) {
      console.error(`  Error: ${error.message}`);
      if (error.stack) {
        console.error(`  Stack: ${error.stack}`);
      }
    } else {
      console.error(`  Error: ${String(error)}`);
    }
    process.exit(1);
  } finally {
    await closePool();
  }
}

testSubscriptionCreation().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
