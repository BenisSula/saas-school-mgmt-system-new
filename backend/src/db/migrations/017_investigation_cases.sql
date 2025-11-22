-- Investigation Cases
-- Enables superuser to create and manage security investigation cases
-- Tracks behavioral anomalies, user actions across tenants, and investigation workflows

-- Investigation Cases Table
-- Tracks security investigations from creation to resolution
CREATE TABLE IF NOT EXISTS shared.investigation_cases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_number TEXT NOT NULL UNIQUE, -- Human-readable case number (e.g., INV-2025-001)
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL CHECK (status IN ('open', 'investigating', 'resolved', 'closed')) DEFAULT 'open',
  priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
  case_type TEXT NOT NULL CHECK (case_type IN ('anomaly', 'security', 'compliance', 'abuse', 'other')),
  
  -- Related entities (can span multiple tenants)
  related_user_id UUID REFERENCES shared.users(id) ON DELETE SET NULL,
  related_tenant_id UUID REFERENCES shared.tenants(id) ON DELETE SET NULL,
  
  -- Investigation metadata
  assigned_to UUID REFERENCES shared.users(id) ON DELETE SET NULL, -- Superuser assigned to case
  created_by UUID NOT NULL REFERENCES shared.users(id) ON DELETE RESTRICT,
  resolved_by UUID REFERENCES shared.users(id) ON DELETE SET NULL,
  
  -- Timestamps
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  investigated_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  
  -- Resolution details
  resolution TEXT,
  resolution_notes TEXT,
  
  -- Additional metadata
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Case Notes/Updates Table
-- Tracks investigation progress and notes
CREATE TABLE IF NOT EXISTS shared.investigation_case_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES shared.investigation_cases(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  note_type TEXT NOT NULL CHECK (note_type IN ('note', 'finding', 'evidence', 'action')) DEFAULT 'note',
  created_by UUID NOT NULL REFERENCES shared.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Case Evidence/Audit Trail Links
-- Links audit logs and other evidence to cases
CREATE TABLE IF NOT EXISTS shared.investigation_case_evidence (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES shared.investigation_cases(id) ON DELETE CASCADE,
  evidence_type TEXT NOT NULL CHECK (evidence_type IN ('audit_log', 'session', 'login_attempt', 'password_change', 'file', 'other')),
  evidence_id TEXT NOT NULL, -- ID of the related record (audit_log.id, session.id, etc.)
  evidence_source TEXT, -- Table name or source identifier
  description TEXT,
  added_by UUID NOT NULL REFERENCES shared.users(id) ON DELETE RESTRICT,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_investigation_cases_status ON shared.investigation_cases(status);
CREATE INDEX IF NOT EXISTS idx_investigation_cases_priority ON shared.investigation_cases(priority);
CREATE INDEX IF NOT EXISTS idx_investigation_cases_case_type ON shared.investigation_cases(case_type);
CREATE INDEX IF NOT EXISTS idx_investigation_cases_related_user ON shared.investigation_cases(related_user_id);
CREATE INDEX IF NOT EXISTS idx_investigation_cases_related_tenant ON shared.investigation_cases(related_tenant_id);
CREATE INDEX IF NOT EXISTS idx_investigation_cases_assigned_to ON shared.investigation_cases(assigned_to);
CREATE INDEX IF NOT EXISTS idx_investigation_cases_created_by ON shared.investigation_cases(created_by);
CREATE INDEX IF NOT EXISTS idx_investigation_cases_opened_at ON shared.investigation_cases(opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_investigation_cases_case_number ON shared.investigation_cases(case_number);
CREATE INDEX IF NOT EXISTS idx_investigation_cases_tags ON shared.investigation_cases USING GIN(tags);

CREATE INDEX IF NOT EXISTS idx_investigation_case_notes_case_id ON shared.investigation_case_notes(case_id);
CREATE INDEX IF NOT EXISTS idx_investigation_case_notes_created_at ON shared.investigation_case_notes(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_investigation_case_evidence_case_id ON shared.investigation_case_evidence(case_id);
CREATE INDEX IF NOT EXISTS idx_investigation_case_evidence_type ON shared.investigation_case_evidence(evidence_type);
CREATE INDEX IF NOT EXISTS idx_investigation_case_evidence_id ON shared.investigation_case_evidence(evidence_id);

-- Function to generate case number
CREATE OR REPLACE FUNCTION generate_case_number()
RETURNS TEXT AS $$
DECLARE
  year_part TEXT;
  seq_num INTEGER;
  case_num TEXT;
BEGIN
  year_part := TO_CHAR(NOW(), 'YYYY');
  
  -- Get next sequence number for this year
  SELECT COALESCE(MAX(CAST(SUBSTRING(case_number FROM 'INV-\d{4}-(\d+)') AS INTEGER)), 0) + 1
  INTO seq_num
  FROM shared.investigation_cases
  WHERE case_number LIKE 'INV-' || year_part || '-%';
  
  case_num := 'INV-' || year_part || '-' || LPAD(seq_num::TEXT, 4, '0');
  RETURN case_num;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate case number
CREATE OR REPLACE FUNCTION set_case_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.case_number IS NULL OR NEW.case_number = '' THEN
    NEW.case_number := generate_case_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_case_number ON shared.investigation_cases;
CREATE TRIGGER trigger_set_case_number
  BEFORE INSERT ON shared.investigation_cases
  FOR EACH ROW
  EXECUTE FUNCTION set_case_number();

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_investigation_cases_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_investigation_cases_updated_at ON shared.investigation_cases;
CREATE TRIGGER trigger_investigation_cases_updated_at
  BEFORE UPDATE ON shared.investigation_cases
  FOR EACH ROW
  EXECUTE FUNCTION update_investigation_cases_updated_at();

