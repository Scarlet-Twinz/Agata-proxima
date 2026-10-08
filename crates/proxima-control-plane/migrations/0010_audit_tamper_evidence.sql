-- Tamper-evident audit chaining. Existing events remain readable; new events carry
-- a hash of their organization-local predecessor and canonical event fields.
ALTER TABLE audit_events
  ADD COLUMN IF NOT EXISTS previous_hash bytea,
  ADD COLUMN IF NOT EXISTS event_hash bytea;

CREATE INDEX IF NOT EXISTS idx_audit_org_hash
  ON audit_events(organization_id, created_at DESC, event_hash);

-- New audit events are expected to be chained by the application audit writer.
-- The repository gate requires the columns to exist; no secret material is included
-- in the hash input beyond already-audited metadata.
