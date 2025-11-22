-- Migration: Create subscription_tiers configuration table
-- Date: 2025-01-XX
-- Phase: 1 - Fix Placeholder Buttons (Subscription Tier Configuration)

CREATE TABLE IF NOT EXISTS shared.subscription_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier VARCHAR(20) NOT NULL UNIQUE CHECK (tier IN ('free', 'trial', 'paid')),
  name TEXT NOT NULL,
  description TEXT,
  monthly_price NUMERIC(12, 2) DEFAULT 0,
  yearly_price NUMERIC(12, 2) DEFAULT 0,
  max_users INTEGER,
  max_students INTEGER,
  max_teachers INTEGER,
  max_storage_gb INTEGER,
  features JSONB DEFAULT '{}'::jsonb,
  limits JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default tier configurations
INSERT INTO shared.subscription_tiers (tier, name, description, monthly_price, yearly_price, max_users, max_students, max_teachers, max_storage_gb, features, limits)
VALUES
  ('free', 'Free', 'Basic plan with limited features', 0, 0, 50, 100, 10, 1, '{"basic_reports": true, "email_support": false}'::jsonb, '{"api_calls_per_day": 1000}'::jsonb),
  ('trial', 'Trial', 'Full features for 30 days', 0, 0, 500, 1000, 50, 10, '{"all_features": true, "priority_support": true}'::jsonb, '{"api_calls_per_day": 10000}'::jsonb),
  ('paid', 'Paid', 'Full features with premium support', 99, 990, NULL, NULL, NULL, 100, '{"all_features": true, "priority_support": true, "custom_branding": true}'::jsonb, '{"api_calls_per_day": 100000}'::jsonb)
ON CONFLICT (tier) DO NOTHING;

