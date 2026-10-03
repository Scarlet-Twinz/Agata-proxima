CREATE TABLE IF NOT EXISTS organization_entitlements (
    organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    plan_key TEXT NOT NULL DEFAULT 'free'
        CHECK (plan_key IN ('free','starter','growth','scale','enterprise')),
    billing_status TEXT NOT NULL DEFAULT 'active',
    node_limit INTEGER NOT NULL DEFAULT 1,
    tenant_limit INTEGER NOT NULL DEFAULT 3,
    environment_limit INTEGER NOT NULL DEFAULT 1,
    audit_retention_days INTEGER NOT NULL DEFAULT 7,
    advanced_verification BOOLEAN NOT NULL DEFAULT FALSE,
    fleet_controls BOOLEAN NOT NULL DEFAULT FALSE,
    priority_support BOOLEAN NOT NULL DEFAULT FALSE,
    entra_oidc BOOLEAN NOT NULL DEFAULT FALSE,
    private_deployment BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO organization_entitlements (organization_id)
SELECT id FROM organizations
ON CONFLICT (organization_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_organization_entitlements_plan
    ON organization_entitlements(plan_key);
