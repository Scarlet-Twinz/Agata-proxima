CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE,
  display_name text NOT NULL,
  password_hash text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY, name text NOT NULL, slug text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS memberships (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner','admin','operator','viewer')),
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (user_id, organization_id)
);
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL, slug text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (organization_id, slug)
);
CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY, project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL, slug text NOT NULL, status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','deleting')),
  isolation_mode text NOT NULL DEFAULT 'enforced-proxy', created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (project_id, slug)
);
CREATE TABLE IF NOT EXISTS policies (
  id uuid PRIMARY KEY, organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL, version integer NOT NULL, status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','archived')),
  document jsonb NOT NULL, created_by uuid REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (organization_id, name, version)
);
CREATE TABLE IF NOT EXISTS nodes (
  id uuid PRIMARY KEY, organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL, environment text NOT NULL DEFAULT 'production', region text NOT NULL DEFAULT 'auto',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','enrolling','healthy','degraded','offline','revoked')),
  version text NOT NULL DEFAULT 'unknown', enrollment_token_hash bytea, last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS deployments (
  id uuid PRIMARY KEY, organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  node_id uuid NOT NULL REFERENCES nodes(id) ON DELETE CASCADE, version text NOT NULL,
  desired_state text NOT NULL CHECK (desired_state IN ('running','stopped','draining')),
  observed_state text NOT NULL DEFAULT 'unknown',
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','applying','healthy','failed','rolled_back')),
  created_by uuid REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS verification_results (
  id uuid PRIMARY KEY, organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES tenants(id) ON DELETE SET NULL, kind text NOT NULL,
  status text NOT NULL CHECK (status IN ('pass','fail','review','running')), evidence jsonb NOT NULL,
  created_by uuid REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL, action text NOT NULL, resource_type text NOT NULL,
  resource_id uuid, metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  token_hash bytea NOT NULL UNIQUE, csrf_token text NOT NULL, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_tenants_project ON tenants(project_id);
CREATE INDEX IF NOT EXISTS idx_policies_org ON policies(organization_id);
CREATE INDEX IF NOT EXISTS idx_nodes_org ON nodes(organization_id);
CREATE INDEX IF NOT EXISTS idx_deployments_org ON deployments(organization_id);
CREATE INDEX IF NOT EXISTS idx_verifications_org ON verification_results(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_org_created ON audit_events(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);

CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS policies_touch ON policies;
CREATE TRIGGER policies_touch BEFORE UPDATE ON policies FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
DROP TRIGGER IF EXISTS nodes_touch ON nodes;
CREATE TRIGGER nodes_touch BEFORE UPDATE ON nodes FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
DROP TRIGGER IF EXISTS deployments_touch ON deployments;
CREATE TRIGGER deployments_touch BEFORE UPDATE ON deployments FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TABLE IF NOT EXISTS support_requests (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  subject text NOT NULL,
  message text NOT NULL,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_support_org_created ON support_requests(organization_id, created_at DESC);
DROP TRIGGER IF EXISTS support_touch ON support_requests;
CREATE TRIGGER support_touch BEFORE UPDATE ON support_requests FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
