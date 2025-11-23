-- Notifications table for tenant schemas
CREATE TABLE IF NOT EXISTS {{schema}}.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
  read BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON {{schema}}.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON {{schema}}.notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON {{schema}}.notifications(created_at DESC);

