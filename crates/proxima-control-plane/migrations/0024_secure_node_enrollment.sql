-- Secure bootstrap lifecycle for newly issued node enrollment tokens.
-- Existing nodes are left intact; tokens issued before this migration cannot
-- be exchanged because they have no expiry timestamp and must be re-issued.
ALTER TABLE nodes
  ADD COLUMN IF NOT EXISTS enrollment_token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS enrollment_token_consumed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_nodes_active_enrollment_token
  ON nodes (enrollment_token_hash, enrollment_token_expires_at)
  WHERE enrollment_token_hash IS NOT NULL
    AND enrollment_token_consumed_at IS NULL;
