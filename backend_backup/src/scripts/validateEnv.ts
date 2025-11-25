/**
 * Script to validate environment variables for Phase 8.1
 * Checks all required and optional environment variables
 * Usage: ts-node src/scripts/validateEnv.ts
 */

interface EnvVar {
  name: string;
  required: boolean;
  description: string;
  validate?: (value: string) => boolean | string;
}

const envVars: EnvVar[] = [
  {
    name: 'STRIPE_SECRET_KEY',
    required: true,
    description: 'Stripe API secret key (sk_test_... or sk_live_...)',
    validate: (value) => {
      if (!value.startsWith('sk_test_') && !value.startsWith('sk_live_')) {
        return 'Must start with sk_test_ or sk_live_';
      }
      return true;
    }
  },
  {
    name: 'STRIPE_WEBHOOK_SECRET',
    required: false,
    description: 'Stripe webhook signing secret (whsec_...)',
    validate: (value) => {
      if (!value.startsWith('whsec_')) {
        return 'Must start with whsec_';
      }
      return true;
    }
  },
  {
    name: 'BILLING_DEFAULT_CURRENCY',
    required: false,
    description: 'Default currency for billing (e.g., USD, EUR)',
    validate: (value) => {
      if (value.length !== 3) {
        return 'Must be a 3-letter currency code';
      }
      return true;
    }
  },
  {
    name: 'DATABASE_URL',
    required: true,
    description: 'PostgreSQL database connection string'
  },
  {
    name: 'JWT_SECRET',
    required: true,
    description: 'JWT signing secret'
  }
];

function validateEnv(): void {
  console.log('🔍 Validating Environment Variables for Phase 8.1...\n');

  let hasErrors = false;
  let hasWarnings = false;

  for (const envVar of envVars) {
    const value = process.env[envVar.name];

    if (!value) {
      if (envVar.required) {
        console.error(`❌ ${envVar.name}: MISSING (Required)`);
        console.error(`   ${envVar.description}`);
        hasErrors = true;
      } else {
        console.warn(`⚠️  ${envVar.name}: Not set (Optional)`);
        console.warn(`   ${envVar.description}`);
        hasWarnings = true;
      }
      continue;
    }

    // Validate value if validator provided
    if (envVar.validate) {
      const validationResult = envVar.validate(value);
      if (validationResult === true) {
        console.log(`✅ ${envVar.name}: Set`);
      } else {
        console.error(`❌ ${envVar.name}: Invalid value`);
        console.error(`   ${validationResult}`);
        hasErrors = true;
      }
    } else {
      console.log(`✅ ${envVar.name}: Set`);
    }
  }

  console.log('\n' + '='.repeat(50));

  if (hasErrors) {
    console.error('\n❌ Validation failed. Please fix the errors above.');
    process.exit(1);
  } else if (hasWarnings) {
    console.warn('\n⚠️  Validation passed with warnings.');
    console.warn('   Some optional variables are not set, but this may be expected.');
  } else {
    console.log('\n✅ All environment variables are valid!');
  }

  // Additional checks
  console.log('\n📋 Additional Checks:');

  // Check if in test mode
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (stripeKey) {
    if (stripeKey.startsWith('sk_test_')) {
      console.log('   🧪 Stripe Mode: Test Mode');
      console.log('   💡 Use test cards: https://stripe.com/docs/testing');
    } else {
      console.log('   🚀 Stripe Mode: Live Mode');
      console.log('   ⚠️  You are using LIVE Stripe keys. Be careful!');
    }
  }

  // Check webhook secret
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.log('   ⚠️  Webhook secret not set');
    console.log('   💡 For local development:');
    console.log('      stripe listen --forward-to localhost:3001/api/webhooks/stripe');
  } else {
    console.log('   ✅ Webhook secret configured');
  }

  console.log('\n✅ Environment validation complete!');
}

validateEnv();

