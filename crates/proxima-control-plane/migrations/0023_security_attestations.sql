CREATE TABLE IF NOT EXISTS security_attestation_blocks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    node_id text NOT NULL CHECK (length(trim(node_id)) BETWEEN 1 AND 200),
    epoch_timestamp_start bigint NOT NULL,
    epoch_timestamp_end bigint NOT NULL CHECK (epoch_timestamp_end > epoch_timestamp_start),
    total_processed_queries bigint NOT NULL DEFAULT 0 CHECK (total_processed_queries >= 0),
    authenticated_tenant_sessions bigint NOT NULL DEFAULT 0 CHECK (authenticated_tenant_sessions >= 0),
    blocked_unauthorized_violations bigint NOT NULL DEFAULT 0 CHECK (blocked_unauthorized_violations >= 0),
    p99_latency_overhead_ms double precision,
    force_rls_active boolean,
    tls_termination_enforced boolean,
    circuit_breaker_tripped boolean,
    previous_block_hash text NOT NULL DEFAULT '',
    block_hash text NOT NULL,
    signature_algorithm text NOT NULL,
    signing_key_id text NOT NULL,
    signature bytea NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (organization_id, node_id, epoch_timestamp_start),
    CHECK (p99_latency_overhead_ms IS NULL OR p99_latency_overhead_ms >= 0)
);
CREATE INDEX IF NOT EXISTS security_attestation_org_epoch_idx
    ON security_attestation_blocks (organization_id, epoch_timestamp_start DESC);
CREATE INDEX IF NOT EXISTS security_attestation_node_epoch_idx
    ON security_attestation_blocks (organization_id, node_id, epoch_timestamp_start DESC);

CREATE OR REPLACE FUNCTION prevent_attestation_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'security attestation blocks are append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS security_attestation_immutable ON security_attestation_blocks;
CREATE TRIGGER security_attestation_immutable
    BEFORE UPDATE OR DELETE ON security_attestation_blocks
    FOR EACH ROW EXECUTE FUNCTION prevent_attestation_mutation();
