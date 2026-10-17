-- Organization-owned logical environments. These are distinct from organizations:
-- an organization is the account/security boundary; an environment is a named
-- deployment stage inside that organization.
CREATE TABLE IF NOT EXISTS organization_environments (
    id uuid PRIMARY KEY,
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
    slug text NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    description text NOT NULL DEFAULT '',
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (organization_id, slug)
);

CREATE INDEX IF NOT EXISTS organization_environments_org_status_idx
    ON organization_environments (organization_id, status, created_at DESC);

-- Preserve the environment labels already in use by registered nodes so the
-- new registry starts with the current inventory instead of an empty list.
INSERT INTO organization_environments
    (id, organization_id, name, slug, description, status)
SELECT
    gen_random_uuid(),
    existing.organization_id,
    initcap(existing.environment),
    lower(trim(both '-' from regexp_replace(
        regexp_replace(lower(trim(existing.environment)), '[^a-z0-9]+', '-', 'g'),
        '(^-+|-+$)', '', 'g'
    ))),
    'Imported from existing node environment metadata.',
    'active'
FROM (
    SELECT DISTINCT organization_id, trim(environment) AS environment
    FROM nodes
    WHERE trim(environment) <> ''
) AS existing
WHERE lower(trim(both '-' from regexp_replace(
    regexp_replace(lower(trim(existing.environment)), '[^a-z0-9]+', '-', 'g'),
    '(^-+|-+$)', '', 'g'
))) ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
ON CONFLICT (organization_id, slug) DO NOTHING;
