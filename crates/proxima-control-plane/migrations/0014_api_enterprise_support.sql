-- API-key inventory limits, per-organization request rate limits, and support tier.
ALTER TABLE organization_entitlements
  ADD COLUMN IF NOT EXISTS api_key_limit INTEGER NOT NULL DEFAULT 1
  CHECK (api_key_limit >= 0);

ALTER TABLE organization_entitlements
  ADD COLUMN IF NOT EXISTS api_requests_per_minute INTEGER NOT NULL DEFAULT 60
  CHECK (api_requests_per_minute >= 1);

ALTER TABLE organization_entitlements
  ADD COLUMN IF NOT EXISTS support_level TEXT NOT NULL DEFAULT 'community'
  CHECK (support_level IN ('community','standard','priority','priority_plus','enterprise_custom'));

ALTER TABLE api_keys
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

UPDATE organization_entitlements
   SET api_key_limit = CASE plan_key
       WHEN 'starter' THEN 5
       WHEN 'growth' THEN 25
       WHEN 'scale' THEN 100
       WHEN 'enterprise' THEN 2147483647
       ELSE 1
   END,
   api_requests_per_minute = CASE plan_key
       WHEN 'starter' THEN 300
       WHEN 'growth' THEN 1000
       WHEN 'scale' THEN 5000
       WHEN 'enterprise' THEN 2147483647
       ELSE 60
   END,
   support_level = CASE plan_key
       WHEN 'starter' THEN 'standard'
       WHEN 'growth' THEN 'priority'
       WHEN 'scale' THEN 'priority_plus'
       WHEN 'enterprise' THEN 'enterprise_custom'
       ELSE 'community'
   END;

CREATE TABLE IF NOT EXISTS api_rate_limit_windows (
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    window_start TIMESTAMPTZ NOT NULL,
    request_count BIGINT NOT NULL DEFAULT 0 CHECK (request_count >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (organization_id, window_start)
);

CREATE OR REPLACE FUNCTION proxima_enforce_api_key_capacity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    ent RECORD;
    active_keys BIGINT;
BEGIN
    IF NEW.revoked_at IS NOT NULL THEN
        RETURN NEW;
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(NEW.organization_id::text || ':api-key-capacity', 0));

    SELECT api_key_limit, billing_status
      INTO ent
      FROM organization_entitlements
     WHERE organization_id = NEW.organization_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGATA_ENTITLEMENT_MISSING: api_keys';
    END IF;

    IF ent.billing_status IN ('canceled', 'unpaid') THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGATA_SUBSCRIPTION_INACTIVE: api_keys';
    END IF;

    SELECT count(*)
      INTO active_keys
      FROM api_keys
     WHERE organization_id = NEW.organization_id
       AND revoked_at IS NULL
       AND id IS DISTINCT FROM NEW.id;

    IF active_keys >= ent.api_key_limit THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGATA_PLAN_LIMIT: api_keys';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS api_keys_entitlement_capacity_insert ON api_keys;
CREATE TRIGGER api_keys_entitlement_capacity_insert
BEFORE INSERT ON api_keys
FOR EACH ROW EXECUTE FUNCTION proxima_enforce_api_key_capacity();

DROP TRIGGER IF EXISTS api_keys_entitlement_capacity_update ON api_keys;
CREATE TRIGGER api_keys_entitlement_capacity_update
BEFORE UPDATE OF organization_id, revoked_at ON api_keys
FOR EACH ROW EXECUTE FUNCTION proxima_enforce_api_key_capacity();


CREATE OR REPLACE FUNCTION proxima_consume_api_request(target_organization UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    ent RECORD;
    bucket TIMESTAMPTZ;
    requests BIGINT;
BEGIN
    SELECT api_requests_per_minute, billing_status
      INTO ent
      FROM organization_entitlements
     WHERE organization_id = target_organization;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGATA_ENTITLEMENT_MISSING: api_requests';
    END IF;

    bucket := date_trunc('minute', now());
    INSERT INTO api_rate_limit_windows(organization_id, window_start, request_count)
    VALUES (target_organization, bucket, 1)
    ON CONFLICT (organization_id, window_start) DO UPDATE
       SET request_count = api_rate_limit_windows.request_count + 1,
           updated_at = now()
    RETURNING request_count INTO requests;

    RETURN requests <= ent.api_requests_per_minute;
END;
$$;

CREATE OR REPLACE FUNCTION proxima_purge_expired_api_rate_windows()
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
    removed BIGINT;
BEGIN
    DELETE FROM api_rate_limit_windows
     WHERE window_start < now() - interval '2 days';
    GET DIAGNOSTICS removed = ROW_COUNT;
    RETURN removed;
END;
$$;
