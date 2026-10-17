-- Make tenant organization scope explicit for every tenant query and enforce
-- consistency between the tenant's organization and its owning project.
ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS organization_id uuid;

UPDATE tenants AS t
   SET organization_id = p.organization_id
  FROM projects AS p
 WHERE p.id = t.project_id
   AND t.organization_id IS DISTINCT FROM p.organization_id;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM pg_constraint
         WHERE conname = 'tenants_organization_id_fkey'
           AND conrelid = 'tenants'::regclass
    ) THEN
        ALTER TABLE tenants
            ADD CONSTRAINT tenants_organization_id_fkey
            FOREIGN KEY (organization_id)
            REFERENCES organizations(id)
            ON DELETE CASCADE;
    END IF;
END
$$;

ALTER TABLE tenants
    ALTER COLUMN organization_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tenants_org
    ON tenants (organization_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_id_organization_unique
    ON projects (id, organization_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM pg_constraint
         WHERE conname = 'tenants_project_organization_fkey'
           AND conrelid = 'tenants'::regclass
    ) THEN
        ALTER TABLE tenants
            ADD CONSTRAINT tenants_project_organization_fkey
            FOREIGN KEY (project_id, organization_id)
            REFERENCES projects(id, organization_id)
            ON DELETE CASCADE;
    END IF;
END
$$;
