-- Retention follows the organization's current entitlement. The cleanup function
-- preserves events for organizations whose entitlement state is missing.
CREATE INDEX IF NOT EXISTS idx_audit_events_retention
    ON audit_events(organization_id, created_at);

CREATE OR REPLACE FUNCTION proxima_purge_expired_audit_events()
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
    removed BIGINT;
BEGIN
    DELETE FROM audit_events AS a
    USING organization_entitlements AS e
    WHERE e.organization_id = a.organization_id
      AND a.created_at < now() - make_interval(days => e.audit_retention_days);

    GET DIAGNOSTICS removed = ROW_COUNT;
    RETURN removed;
END;
$$;
