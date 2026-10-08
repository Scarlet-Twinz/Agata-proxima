-- Phase 3A customer integration foundation.
-- Secrets are never stored in plaintext. Customer database passwords are encrypted
-- with pgcrypto using a deployment-only key supplied through AGATA_SECRET_ENCRYPTION_KEY.

CREATE TABLE IF NOT EXISTS integrations (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','revoked')),
  mode text NOT NULL DEFAULT 'development' CHECK (mode IN ('development','shadow','enforcement','maintenance')),
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deactivated_at timestamptz,
  UNIQUE (organization_id, name)
);

CREATE TABLE IF NOT EXISTS integration_credentials (
  id uuid PRIMARY KEY,
  integration_id uuid NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  key_prefix text NOT NULL,
  key_hash bytea NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  active boolean NOT NULL DEFAULT true
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_integration_one_active_credential
  ON integration_credentials(integration_id) WHERE active=true;

CREATE TABLE IF NOT EXISTS environments (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  key text NOT NULL CHECK (key IN ('development','staging','production')),
  name text NOT NULL,
  mode text NOT NULL DEFAULT 'development' CHECK (mode IN ('development','shadow','enforcement','maintenance')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','decommissioned')),
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  deployment_state text NOT NULL DEFAULT 'not_deployed' CHECK (deployment_state IN ('not_deployed','deploying','healthy','degraded','failed')),
  verification_state text NOT NULL DEFAULT 'not_run' CHECK (verification_state IN ('not_run','running','pass','fail','blocked','error','inconclusive')),
  bypass_until timestamptz,
  bypass_authorized_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, key)
);

CREATE TABLE IF NOT EXISTS database_connections (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  environment_id uuid NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  host text NOT NULL,
  port integer NOT NULL CHECK (port BETWEEN 1 AND 65535),
  database_name text NOT NULL,
  username text NOT NULL,
  password_ciphertext bytea NOT NULL,
  tls_mode text NOT NULL CHECK (tls_mode IN ('disable','require','verify-ca','verify-full')),
  status text NOT NULL DEFAULT 'unvalidated' CHECK (status IN ('unvalidated','connected','rejected','failure','degraded')),
  last_health_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (environment_id)
);

CREATE TABLE IF NOT EXISTS tenant_policy_bindings (
  tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  policy_id uuid NOT NULL REFERENCES policies(id) ON DELETE RESTRICT,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenant_context_issuances (
  jti_hash bytea PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  integration_id uuid REFERENCES integrations(id) ON DELETE CASCADE,
  environment_id uuid REFERENCES environments(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS migration_runs (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  integration_id uuid REFERENCES integrations(id) ON DELETE SET NULL,
  source_environment text NOT NULL,
  target_environment text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','preflight','verified','canary','production','rolled_back','failed')),
  compatibility_report jsonb NOT NULL DEFAULT '{}'::jsonb,
  rollback_plan jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS migration_tenant_maps (
  id uuid PRIMARY KEY,
  migration_id uuid NOT NULL REFERENCES migration_runs(id) ON DELETE CASCADE,
  source_key text NOT NULL,
  tenant_id uuid REFERENCES tenants(id) ON DELETE SET NULL,
  target_key text,
  status text NOT NULL DEFAULT 'unmapped' CHECK (status IN ('unmapped','mapped','verified','blocked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (migration_id, source_key)
);

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS disabled_at timestamptz;

UPDATE tenants t
SET organization_id = p.organization_id
FROM projects p
WHERE p.id=t.project_id AND t.organization_id IS NULL;

ALTER TABLE verification_results
  ADD COLUMN IF NOT EXISTS integration_id uuid REFERENCES integrations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS environment_id uuid REFERENCES environments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS correlation_id text;

ALTER TABLE audit_events
  ADD COLUMN IF NOT EXISTS integration_id uuid REFERENCES integrations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS environment_id uuid REFERENCES environments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS policy_id uuid REFERENCES policies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS decision text,
  ADD COLUMN IF NOT EXISTS verification_result text,
  ADD COLUMN IF NOT EXISTS correlation_id text,
  ADD COLUMN IF NOT EXISTS failure_reason text;

UPDATE audit_events SET correlation_id=COALESCE(correlation_id, gen_random_uuid()::text)
WHERE correlation_id IS NULL;
ALTER TABLE audit_events ALTER COLUMN correlation_id SET DEFAULT gen_random_uuid()::text;

CREATE INDEX IF NOT EXISTS idx_integrations_org ON integrations(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_environments_org ON environments(organization_id, key);
CREATE INDEX IF NOT EXISTS idx_db_connections_org ON database_connections(organization_id);
CREATE INDEX IF NOT EXISTS idx_tenant_context_org ON tenant_context_issuances(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_migration_org ON migration_runs(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_org_correlation ON audit_events(organization_id, correlation_id);

DROP TRIGGER IF EXISTS integrations_touch ON integrations;
CREATE TRIGGER integrations_touch BEFORE UPDATE ON integrations FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
DROP TRIGGER IF EXISTS environments_touch ON environments;
CREATE TRIGGER environments_touch BEFORE UPDATE ON environments FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
DROP TRIGGER IF EXISTS database_connections_touch ON database_connections;
CREATE TRIGGER database_connections_touch BEFORE UPDATE ON database_connections FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
DROP TRIGGER IF EXISTS migration_runs_touch ON migration_runs;
CREATE TRIGGER migration_runs_touch BEFORE UPDATE ON migration_runs FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Every existing organization gets explicit Development, Staging and Production
-- environment records without inventing customer configuration.
INSERT INTO projects(id,organization_id,name,slug)
SELECT gen_random_uuid(),o.id,'Development','development'
FROM organizations o
WHERE NOT EXISTS (SELECT 1 FROM projects p WHERE p.organization_id=o.id AND p.slug='development');

INSERT INTO projects(id,organization_id,name,slug)
SELECT gen_random_uuid(),o.id,'Staging','staging'
FROM organizations o
WHERE NOT EXISTS (SELECT 1 FROM projects p WHERE p.organization_id=o.id AND p.slug='staging');

INSERT INTO projects(id,organization_id,name,slug)
SELECT gen_random_uuid(),o.id,'Production','production'
FROM organizations o
WHERE NOT EXISTS (SELECT 1 FROM projects p WHERE p.organization_id=o.id AND p.slug='production');

INSERT INTO environments(id,organization_id,project_id,key,name,mode)
SELECT gen_random_uuid(),p.organization_id,p.id,'development','Development','development'
FROM projects p
WHERE p.slug='development'
ON CONFLICT (organization_id,key) DO NOTHING;

INSERT INTO environments(id,organization_id,project_id,key,name,mode)
SELECT gen_random_uuid(),p.organization_id,p.id,'staging','Staging','shadow'
FROM projects p
WHERE p.slug='staging'
ON CONFLICT (organization_id,key) DO NOTHING;

INSERT INTO environments(id,organization_id,project_id,key,name,mode)
SELECT gen_random_uuid(),p.organization_id,p.id,'production','Production','enforcement'
FROM projects p
WHERE p.slug='production'
ON CONFLICT (organization_id,key) DO NOTHING;
