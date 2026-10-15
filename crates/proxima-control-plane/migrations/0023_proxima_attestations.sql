CREATE TABLE IF NOT EXISTS proxima_attestations (
    id uuid PRIMARY KEY,
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    node_id text NOT NULL,
    attestation_version integer NOT NULL CHECK (attestation_version = 1),
    epoch_timestamp_start bigint NOT NULL CHECK (epoch_timestamp_start >= 0),
    epoch_timestamp_end bigint NOT NULL CHECK (epoch_timestamp_end >= epoch_timestamp_start),
    telemetry_summary jsonb NOT NULL,
    security_state jsonb NOT NULL,
    previous_block_hash text NOT NULL,
    canonical_payload text NOT NULL,
    block_hash text NOT NULL,
    block_hash_signature text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (organization_id, node_id, block_hash)
);
CREATE INDEX IF NOT EXISTS proxima_attestations_org_created_idx
    ON proxima_attestations (organization_id, created_at DESC);
