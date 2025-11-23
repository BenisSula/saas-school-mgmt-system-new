-- Migration: Add Stripe integration fields to billing tables
-- Date: 2025-01-XX
-- Phase: 8.1 - Billing & Stripe Integration

-- Ensure subscriptions table exists (it should from 004_platform_billing.sql)
-- Add Stripe-specific fields to subscriptions table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'shared' AND table_name = 'subscriptions') THEN
    ALTER TABLE shared.subscriptions
      ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
      ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
      ADD COLUMN IF NOT EXISTS price_cents BIGINT,
      ADD COLUMN IF NOT EXISTS billing_interval TEXT;
    
    -- Add check constraint if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.constraint_column_usage 
      WHERE table_schema = 'shared' 
      AND table_name = 'subscriptions' 
      AND constraint_name = 'subscriptions_billing_interval_check'
    ) THEN
      ALTER TABLE shared.subscriptions
        ADD CONSTRAINT subscriptions_billing_interval_check 
        CHECK (billing_interval IS NULL OR billing_interval IN ('month', 'year'));
    END IF;
  END IF;
END $$;

-- Create indexes on Stripe subscription ID for webhook lookups (only if table and columns exist)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'shared' AND table_name = 'subscriptions'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'shared' AND table_name = 'subscriptions' AND column_name = 'stripe_subscription_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription_id 
      ON shared.subscriptions(stripe_subscription_id) 
      WHERE stripe_subscription_id IS NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'shared' AND table_name = 'subscriptions'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'shared' AND table_name = 'subscriptions' AND column_name = 'stripe_customer_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer_id 
      ON shared.subscriptions(stripe_customer_id) 
      WHERE stripe_customer_id IS NOT NULL;
  END IF;
END $$;

-- Add Stripe-specific fields to payments table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'shared' AND table_name = 'payments') THEN
    ALTER TABLE shared.payments
      ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
      ADD COLUMN IF NOT EXISTS stripe_charge_id TEXT,
      ADD COLUMN IF NOT EXISTS amount_cents BIGINT;
    
    -- Add user_id column only if users table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'shared' AND table_name = 'users') THEN
      ALTER TABLE shared.payments
        ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES shared.users(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- Create index on Stripe payment intent ID
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'shared' AND table_name = 'payments'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'shared' AND table_name = 'payments' AND column_name = 'stripe_payment_intent_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_payments_stripe_payment_intent_id 
      ON shared.payments(stripe_payment_intent_id) 
      WHERE stripe_payment_intent_id IS NOT NULL;
  END IF;
END $$;

-- Add Stripe-specific fields to invoices table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'shared' AND table_name = 'invoices') THEN
    ALTER TABLE shared.invoices
      ADD COLUMN IF NOT EXISTS stripe_invoice_id TEXT,
      ADD COLUMN IF NOT EXISTS amount_cents BIGINT;
  END IF;
END $$;

-- Create index on Stripe invoice ID
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'shared' AND table_name = 'invoices'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'shared' AND table_name = 'invoices' AND column_name = 'stripe_invoice_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_invoices_stripe_invoice_id 
      ON shared.invoices(stripe_invoice_id) 
      WHERE stripe_invoice_id IS NOT NULL;
  END IF;
END $$;

-- Add Stripe customer ID to tenants metadata (will be stored in metadata JSONB)
-- Note: We'll access this via metadata->>'stripe_customer_id' in queries

-- Create external_events table for webhook idempotency
-- This must be created first before other operations
CREATE TABLE IF NOT EXISTS shared.external_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add unique constraint separately to avoid issues
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'external_events_provider_event_id_key'
  ) THEN
    ALTER TABLE shared.external_events
      ADD CONSTRAINT external_events_provider_event_id_key 
      UNIQUE (provider, provider_event_id);
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_external_events_provider_event_id 
  ON shared.external_events(provider, provider_event_id);

CREATE INDEX IF NOT EXISTS idx_external_events_processed_at 
  ON shared.external_events(processed_at);

