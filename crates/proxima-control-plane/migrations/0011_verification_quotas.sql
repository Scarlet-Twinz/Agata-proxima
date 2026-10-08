-- Monthly verification usage is consumed atomically at the database boundary.
ALTER TABLE organization_entitlements
  ADD COLUMN IF NOT EXISTS verification_limit_monthly INTEGER NOT NULL DEFAULT 100
  CHECK (verification_limit_monthly >= 0);

UPDATE organization_entitlements
   SET verification_limit_monthly = CASE plan_key
       WHEN 'starter' THEN 1000
       WHEN 'growth' THEN 10000
       WHEN 'scale' THEN 100000
       WHEN 'enterprise' THEN 2147483647
       ELSE 100
   END;

CREATE TABLE IF NOT EXISTS organization_verification_usage (
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    used_count BIGINT NOT NULL DEFAULT 0 CHECK (used_count >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (organization_id, period_start),
    CHECK (period_start = date_trunc('month', period_start)::date)
);

CREATE OR REPLACE FUNCTION proxima_enforce_verification_quota()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    ent RECORD;
    period DATE;
    used BIGINT;
BEGIN
    period := date_trunc('month', now() AT TIME ZONE 'UTC')::date;
    PERFORM pg_advisory_xact_lock(
        hashtextextended(NEW.organization_id::text || ':verification:' || period::text, 0)
    );

    SELECT verification_limit_monthly, billing_status
      INTO ent
      FROM organization_entitlements
     WHERE organization_id = NEW.organization_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGATA_ENTITLEMENT_MISSING: verifications';
    END IF;

    IF ent.billing_status IN ('canceled', 'unpaid') THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGATA_SUBSCRIPTION_INACTIVE: verifications';
    END IF;

    INSERT INTO organization_verification_usage(organization_id, period_start, used_count)
    VALUES (NEW.organization_id, period, 0)
    ON CONFLICT (organization_id, period_start) DO NOTHING;

    SELECT used_count
      INTO used
      FROM organization_verification_usage
     WHERE organization_id = NEW.organization_id
       AND period_start = period
     FOR UPDATE;

    IF used >= ent.verification_limit_monthly THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGATA_PLAN_LIMIT: verifications';
    END IF;

    UPDATE organization_verification_usage
       SET used_count = used_count + 1, updated_at = now()
     WHERE organization_id = NEW.organization_id
       AND period_start = period;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS verification_results_entitlement_quota ON verification_results;
CREATE TRIGGER verification_results_entitlement_quota
BEFORE INSERT ON verification_results
FOR EACH ROW EXECUTE FUNCTION proxima_enforce_verification_quota();

CREATE INDEX IF NOT EXISTS idx_verification_usage_period
    ON organization_verification_usage(period_start);
