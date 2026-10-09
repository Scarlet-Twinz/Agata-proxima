-- Billing lifecycle grace windows and retry-safe webhook processing.
ALTER TABLE organization_entitlements
  ADD COLUMN IF NOT EXISTS billing_grace_until TIMESTAMPTZ;

ALTER TABLE billing_events
  ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0);

CREATE OR REPLACE FUNCTION proxima_reconcile_billing_lifecycle()
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
    transitioned BIGINT := 0;
    changed BIGINT := 0;
BEGIN
    UPDATE billing_accounts
       SET status='canceled', cancel_at_period_end=false, updated_at=now()
     WHERE status='non-renewing'
       AND current_period_end IS NOT NULL
       AND current_period_end <= now();

    UPDATE organization_entitlements
       SET billing_status='unpaid', billing_grace_until=NULL, updated_at=now()
     WHERE billing_status='past_due'
       AND billing_grace_until IS NOT NULL
       AND billing_grace_until <= now();
    GET DIAGNOSTICS changed = ROW_COUNT;
    transitioned := transitioned + changed;

    UPDATE billing_accounts b
       SET status='unpaid', updated_at=now()
     WHERE b.status='attention'
       AND EXISTS (
           SELECT 1 FROM organization_entitlements e
            WHERE e.organization_id=b.organization_id
              AND e.billing_status='unpaid'
       );

    UPDATE organization_entitlements e
       SET billing_status='canceled', billing_grace_until=NULL, updated_at=now()
      FROM billing_accounts b
     WHERE b.organization_id=e.organization_id
       AND b.status='canceled'
       AND e.billing_status NOT IN ('canceled','unpaid');
    GET DIAGNOSTICS changed = ROW_COUNT;
    transitioned := transitioned + changed;

    RETURN transitioned;
END;
$$;


-- Downgrades preserve resources. The guards below reject capacity increases, not
-- harmless edits to existing resources, so owners can disable, move, or remediate
-- existing resources after a plan reduction without losing data.

CREATE OR REPLACE FUNCTION proxima_enforce_node_capacity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    ent RECORD;
    existing_nodes BIGINT;
    existing_environments BIGINT;
    target_environment_exists BOOLEAN;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended(NEW.organization_id::text || ':node-capacity', 0));

    SELECT node_limit, environment_limit, billing_status
      INTO ent
      FROM organization_entitlements
     WHERE organization_id = NEW.organization_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGATA_ENTITLEMENT_MISSING: nodes';
    END IF;
    IF ent.billing_status IN ('canceled', 'unpaid') THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGATA_SUBSCRIPTION_INACTIVE: nodes';
    END IF;

    IF TG_OP = 'INSERT' OR NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
        SELECT count(*) INTO existing_nodes
          FROM nodes
         WHERE organization_id = NEW.organization_id
           AND id IS DISTINCT FROM NEW.id;
        IF existing_nodes >= ent.node_limit THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGATA_PLAN_LIMIT: nodes';
        END IF;
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM nodes
         WHERE organization_id = NEW.organization_id
           AND environment = NEW.environment
           AND id IS DISTINCT FROM NEW.id
    ) INTO target_environment_exists;

    IF NOT target_environment_exists THEN
        SELECT count(DISTINCT environment) INTO existing_environments
          FROM nodes
         WHERE organization_id = NEW.organization_id
           AND id IS DISTINCT FROM NEW.id;
        IF existing_environments >= ent.environment_limit THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGATA_PLAN_LIMIT: environments';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


CREATE OR REPLACE FUNCTION proxima_enforce_tenant_capacity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    org_id UUID;
    old_org_id UUID;
    ent RECORD;
    existing_tenants BIGINT;
BEGIN
    SELECT organization_id INTO org_id FROM projects WHERE id = NEW.project_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGATA_ENTITLEMENT_MISSING: project';
    END IF;

    IF TG_OP = 'UPDATE' THEN
        SELECT organization_id INTO old_org_id FROM projects WHERE id = OLD.project_id;
        IF old_org_id = org_id THEN
            RETURN NEW;
        END IF;
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(org_id::text || ':tenant-capacity', 0));
    SELECT tenant_limit, billing_status INTO ent
      FROM organization_entitlements WHERE organization_id = org_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGATA_ENTITLEMENT_MISSING: tenants';
    END IF;
    IF ent.billing_status IN ('canceled', 'unpaid') THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGATA_SUBSCRIPTION_INACTIVE: tenants';
    END IF;

    SELECT count(*) INTO existing_tenants
      FROM tenants t JOIN projects p ON p.id=t.project_id
     WHERE p.organization_id=org_id AND t.id IS DISTINCT FROM NEW.id;
    IF existing_tenants >= ent.tenant_limit THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGATA_PLAN_LIMIT: tenants';
    END IF;
    RETURN NEW;
END;
$$;


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
    IF TG_OP = 'UPDATE'
       AND NEW.organization_id = OLD.organization_id
       AND NEW.enabled IS NOT DISTINCT FROM OLD.enabled THEN
        RETURN NEW;
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(NEW.organization_id::text || ':integration-capacity', 0));
    SELECT integration_limit, billing_status INTO ent
      FROM organization_entitlements WHERE organization_id=NEW.organization_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGATA_ENTITLEMENT_MISSING: integrations';
    END IF;
    IF ent.billing_status IN ('canceled', 'unpaid') THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGATA_SUBSCRIPTION_INACTIVE: integrations';
    END IF;

    SELECT count(*) INTO active_integrations
      FROM webhooks
     WHERE organization_id=NEW.organization_id AND enabled IS TRUE
       AND id IS DISTINCT FROM NEW.id;
    IF active_integrations >= ent.integration_limit THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGATA_PLAN_LIMIT: integrations';
    END IF;
    RETURN NEW;
END;
$$;


CREATE OR REPLACE FUNCTION proxima_enforce_team_seat_capacity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    org_id UUID;
    ent RECORD;
    active_members BIGINT;
    pending_invites BIGINT;
BEGIN
    org_id := NEW.organization_id;

    IF TG_TABLE_NAME = 'organization_invites' THEN
        IF NEW.accepted_at IS NOT NULL OR NEW.expires_at <= now() THEN
            RETURN NEW;
        END IF;
    ELSE
        IF TG_OP = 'UPDATE'
           AND NEW.organization_id = OLD.organization_id
           AND NEW.user_id = OLD.user_id THEN
            RETURN NEW;
        END IF;
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(org_id::text || ':team-seat-capacity', 0));
    SELECT team_seat_limit, billing_status INTO ent
      FROM organization_entitlements WHERE organization_id=org_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGATA_ENTITLEMENT_MISSING: team_seats';
    END IF;
    IF ent.billing_status IN ('canceled', 'unpaid') THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGATA_SUBSCRIPTION_INACTIVE: team_seats';
    END IF;

    IF TG_TABLE_NAME = 'memberships' THEN
        SELECT count(*) INTO active_members FROM memberships
         WHERE organization_id=org_id AND user_id IS DISTINCT FROM NEW.user_id;
    ELSE
        SELECT count(*) INTO active_members FROM memberships WHERE organization_id=org_id;
    END IF;

    IF TG_TABLE_NAME = 'organization_invites' THEN
        SELECT count(*) INTO pending_invites FROM organization_invites
         WHERE organization_id=org_id AND accepted_at IS NULL
           AND expires_at>now() AND id IS DISTINCT FROM NEW.id;
    ELSE
        SELECT count(*) INTO pending_invites FROM organization_invites
         WHERE organization_id=org_id AND accepted_at IS NULL AND expires_at>now();
    END IF;

    IF active_members + pending_invites >= ent.team_seat_limit THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGATA_PLAN_LIMIT: team_seats';
    END IF;
    RETURN NEW;
END;
$$;


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
    IF TG_OP = 'UPDATE'
       AND NEW.organization_id = OLD.organization_id
       AND NEW.revoked_at IS NOT DISTINCT FROM OLD.revoked_at THEN
        RETURN NEW;
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(NEW.organization_id::text || ':api-key-capacity', 0));
    SELECT api_key_limit, billing_status INTO ent
      FROM organization_entitlements WHERE organization_id=NEW.organization_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGATA_ENTITLEMENT_MISSING: api_keys';
    END IF;
    IF ent.billing_status IN ('canceled', 'unpaid') THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGATA_SUBSCRIPTION_INACTIVE: api_keys';
    END IF;

    SELECT count(*) INTO active_keys FROM api_keys
     WHERE organization_id=NEW.organization_id AND revoked_at IS NULL
       AND id IS DISTINCT FROM NEW.id;
    IF active_keys >= ent.api_key_limit THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGATA_PLAN_LIMIT: api_keys';
    END IF;
    RETURN NEW;
END;
$$;
