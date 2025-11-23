-- Platform-level billing and subscription management
-- This is separate from tenant-level fee_invoices (which are for student fees)

CREATE TABLE IF NOT EXISTS shared.subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES shared.tenants(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL, -- e.g., 'basic', 'pro', 'enterprise'
  plan_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'canceled', 'past_due', 'trialing', 'unpaid')),
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly')),
  amount NUMERIC(12, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  canceled_at TIMESTAMPTZ,
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  provider_subscription_id TEXT, -- External provider ID (Stripe subscription ID)
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, provider_subscription_id)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_id ON shared.subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON shared.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_period_end ON shared.subscriptions(current_period_end);

CREATE TABLE IF NOT EXISTS shared.invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id UUID REFERENCES shared.subscriptions(id) ON DELETE SET NULL,
  tenant_id UUID NOT NULL REFERENCES shared.tenants(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL UNIQUE,
  amount NUMERIC(12, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL CHECK (status IN ('draft', 'open', 'paid', 'void', 'uncollectible')),
  due_date TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  provider_invoice_id TEXT, -- External provider invoice ID
  pdf_url TEXT,
  hosted_invoice_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_tenant_id ON shared.invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_subscription_id ON shared.invoices(subscription_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON shared.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON shared.invoices(due_date);

CREATE TABLE IF NOT EXISTS shared.payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID REFERENCES shared.invoices(id) ON DELETE SET NULL,
  tenant_id UUID NOT NULL REFERENCES shared.tenants(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded', 'canceled')),
  provider TEXT NOT NULL, -- 'stripe', 'paypal', etc.
  provider_payment_id TEXT NOT NULL,
  payment_method TEXT, -- 'card', 'bank_transfer', etc.
  failure_reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, provider_payment_id)
);

CREATE INDEX IF NOT EXISTS idx_payments_tenant_id ON shared.payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON shared.payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON shared.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_provider ON shared.payments(provider);

CREATE TABLE IF NOT EXISTS shared.payment_methods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES shared.tenants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_payment_method_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('card', 'bank_account', 'paypal')),
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  last4 TEXT, -- Last 4 digits of card/account
  brand TEXT, -- Card brand (visa, mastercard, etc.)
  expiry_month INTEGER,
  expiry_year INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, provider, provider_payment_method_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_methods_tenant_id ON shared.payment_methods(tenant_id);

-- Dunning management for failed payments
CREATE TABLE IF NOT EXISTS shared.dunning_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES shared.invoices(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES shared.tenants(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'skipped')),
  scheduled_at TIMESTAMPTZ NOT NULL,
  attempted_at TIMESTAMPTZ,
  failure_reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dunning_attempts_invoice_id ON shared.dunning_attempts(invoice_id);
CREATE INDEX IF NOT EXISTS idx_dunning_attempts_tenant_id ON shared.dunning_attempts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dunning_attempts_scheduled_at ON shared.dunning_attempts(scheduled_at);

-- Subscription history for audit trail
CREATE TABLE IF NOT EXISTS shared.subscription_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id UUID NOT NULL REFERENCES shared.subscriptions(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES shared.tenants(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'created', 'updated', 'canceled', 'renewed', 'plan_changed'
  old_value JSONB,
  new_value JSONB,
  actor_id UUID REFERENCES shared.users(id),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_history_subscription_id ON shared.subscription_history(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_history_tenant_id ON shared.subscription_history(tenant_id);

