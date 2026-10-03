CREATE TABLE IF NOT EXISTS organization_oidc_connections (
    organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider = 'microsoft-entra'),
    tenant_id UUID NOT NULL,
    issuer TEXT NOT NULL,
    client_id TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_oidc_connection_provider_tenant
    ON organization_oidc_connections(provider, tenant_id);

CREATE TABLE IF NOT EXISTS oidc_login_states (
    state_hash BYTEA PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    nonce TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_oidc_login_states_expiry ON oidc_login_states(expires_at);

CREATE TABLE IF NOT EXISTS user_identities (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    issuer TEXT NOT NULL,
    subject TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(provider, issuer, subject)
);

CREATE INDEX IF NOT EXISTS idx_user_identities_org ON user_identities(organization_id);
