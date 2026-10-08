-- Environment-bound integration credentials. A global integration identity is
-- distinct from credentials issued to a specific Development, Staging or Production
-- environment. Secrets remain one-time values; only hashes and prefixes persist.

CREATE TABLE IF NOT EXISTS environment_integration_credentials (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  integration_id uuid NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  environment_id uuid NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  key_prefix text NOT NULL,
  key_hash bytea NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  UNIQUE (integration_id, environment_id)
);

CREATE INDEX IF NOT EXISTS idx_environment_integration_credentials_org
  ON environment_integration_credentials(organization_id, environment_id);

ALTER TABLE integration_credentials
  ADD COLUMN IF NOT EXISTS environment_id uuid REFERENCES environments(id) ON DELETE CASCADE;

-- Existing pre-3A integration credentials, if any, remain valid as integration
-- credentials. New environment credentials are stored in the explicit table above.
