CREATE TABLE IF NOT EXISTS security_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    node_id text NOT NULL CHECK (length(trim(node_id)) BETWEEN 1 AND 200),
    event_type text NOT NULL CHECK (event_type IN ('peer_breaker_opened')),
    severity text NOT NULL CHECK (severity IN ('warning', 'critical')),
    source_peer text NOT NULL CHECK (length(trim(source_peer)) BETWEEN 1 AND 128),
    details jsonb NOT NULL DEFAULT '{}'::jsonb,
    observed_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS security_events_org_created_idx
    ON security_events (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS security_events_node_created_idx
    ON security_events (organization_id, node_id, created_at DESC);

CREATE OR REPLACE FUNCTION prevent_security_event_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'security events are append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS security_events_immutable ON security_events;
CREATE TRIGGER security_events_immutable
    BEFORE UPDATE OR DELETE ON security_events
    FOR EACH ROW EXECUTE FUNCTION prevent_security_event_mutation();
