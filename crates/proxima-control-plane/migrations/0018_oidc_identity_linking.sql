-- Bind an OIDC authorization state to the already-authenticated user
-- when the flow is explicitly linking an identity instead of signing in.
ALTER TABLE oidc_login_states
    ADD COLUMN IF NOT EXISTS linking_user_id UUID REFERENCES users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_oidc_login_states_linking_user
    ON oidc_login_states(linking_user_id)
    WHERE linking_user_id IS NOT NULL;
