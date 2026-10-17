-- First-class machine identities. API keys may belong to a service account so
-- disabling the identity immediately blocks every key issued for it. An optional
-- environment is organizational context, not a separate database/network boundary.
CREATE TABLE IF NOT EXISTS service_accounts (
    id uuid PRIMARY KEY,
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
    description text NOT NULL DEFAULT '',
    environment_id uuid REFERENCES organization_environments(id) ON DELETE SET NULL,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (organization_id, name)
);

ALTER TABLE api_keys
    ADD COLUMN IF NOT EXISTS service_account_id uuid REFERENCES service_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS service_accounts_org_status_idx
    ON service_accounts (organization_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS api_keys_service_account_idx
    ON api_keys (service_account_id) WHERE service_account_id IS NOT NULL;
