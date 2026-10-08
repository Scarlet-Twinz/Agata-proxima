-- Integration quota for active outbound webhook integrations.
ALTER TABLE organization_entitlements
  ADD COLUMN IF NOT EXISTS integration_limit INTEGER NOT NULL DEFAULT 1
  CHECK (integration_limit >= 0);

UPDATE organization_entitlements
   SET integration_limit = CASE plan_key
       WHEN 'starter' THEN 5
       WHEN 'growth' THEN 20
       WHEN 'scale' THEN 100
       WHEN 'enterprise' THEN 2147483647
       ELSE 1
   END;

CREATE OR REPLACE FUNCTION proxima_enforce_integration_capacity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    ent RECORD;
    active_integrations BIGINT;
BEGIN
    IF NEW.enabled IS NOT TRUE THEN
        RETURN NEW;
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(NEW.organization_id::text || ':integration-capacity', 0));

    SELECT integration_limit, billing_status
      INTO ent
      FROM organization_entitlements
     WHERE organization_id = NEW.organization_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGATA_ENTITLEMENT_MISSING: integrations';
    END IF;

    IF ent.billing_status IN ('canceled', 'unpaid') THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGATA_SUBSCRIPTION_INACTIVE: integrations';
    END IF;

    SELECT count(*)
      INTO active_integrations
      FROM webhooks
     WHERE organization_id = NEW.organization_id
       AND enabled IS TRUE
       AND id IS DISTINCT FROM NEW.id;

    IF active_integrations >= ent.integration_limit THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGATA_PLAN_LIMIT: integrations';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS webhooks_entitlement_capacity_insert ON webhooks;
CREATE TRIGGER webhooks_entitlement_capacity_insert
BEFORE INSERT ON webhooks
FOR EACH ROW EXECUTE FUNCTION proxima_enforce_integration_capacity();

DROP TRIGGER IF EXISTS webhooks_entitlement_capacity_update ON webhooks;
CREATE TRIGGER webhooks_entitlement_capacity_update
BEFORE UPDATE OF enabled, organization_id ON webhooks
FOR EACH ROW EXECUTE FUNCTION proxima_enforce_integration_capacity();
