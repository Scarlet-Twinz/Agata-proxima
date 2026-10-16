ALTER TABLE nodes
    ADD COLUMN IF NOT EXISTS enrollment_token_expires_at timestamptz
        NOT NULL DEFAULT (now() + interval '30 minutes'),
    ADD COLUMN IF NOT EXISTS enrollment_token_consumed_at timestamptz,
    ADD COLUMN IF NOT EXISTS node_signing_key_ciphertext bytea,
    ADD COLUMN IF NOT EXISTS node_signing_key_nonce bytea;
