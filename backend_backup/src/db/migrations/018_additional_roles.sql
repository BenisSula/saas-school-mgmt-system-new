-- Migration: Create additional_roles table for HOD and other additional role assignments
-- Date: 2025-01-XX
-- Phase: 4 - Backend Code Patches

CREATE TABLE IF NOT EXISTS shared.additional_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES shared.users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL,
  granted_at TIMESTAMP NOT NULL DEFAULT NOW(),
  granted_by UUID REFERENCES shared.users(id),
  tenant_id UUID REFERENCES shared.tenants(id),
  UNIQUE(user_id, role, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_additional_roles_user_id ON shared.additional_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_additional_roles_tenant_id ON shared.additional_roles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_additional_roles_role ON shared.additional_roles(role);

