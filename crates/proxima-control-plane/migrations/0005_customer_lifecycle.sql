-- Phase 3A customer lifecycle: explicit projects, environments, and integration state.
CREATE TABLE IF NOT EXISTS environments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  kind text NOT NULL DEFAULT 'development' CHECK (kind IN ('development','staging','production')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','retired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_environments_project ON environments(project_id);

CREATE TABLE IF NOT EXISTS integration_installations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  environment_id uuid REFERENCES environments(id) ON DELETE SET NULL,
  mode text NOT NULL CHECK (mode IN ('engine','sdk','proxy')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','configured','verified','revoked')),
  endpoint text,
  verification_status text NOT NULL DEFAULT 'not_run' CHECK (verification_status IN ('not_run','running','pass','fail','review')),
  last_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_integrations_project ON integration_installations(project_id);

DROP TRIGGER IF EXISTS environments_touch ON environments;
CREATE TRIGGER environments_touch BEFORE UPDATE ON environments FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
DROP TRIGGER IF EXISTS integrations_touch ON integration_installations;
CREATE TRIGGER integrations_touch BEFORE UPDATE ON integration_installations FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Backfill the canonical Production environment for existing projects.
INSERT INTO environments(project_id,name,slug,kind)
SELECT p.id,'Production','production','production'
FROM projects p
WHERE NOT EXISTS (
  SELECT 1 FROM environments e WHERE e.project_id=p.id AND e.slug='production'
);

-- Keep the original default project model, but make its environment explicit.
