-- Database-enforced capacity ceilings. The transaction-scoped advisory locks make the
-- count-and-insert invariant safe even when requests race or bypass HTTP prechecks.

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

    SELECT count(*)
      INTO existing_nodes
      FROM nodes
     WHERE organization_id = NEW.organization_id
       AND id IS DISTINCT FROM NEW.id;

    IF existing_nodes >= ent.node_limit THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGATA_PLAN_LIMIT: nodes';
    END IF;

    SELECT EXISTS (
        SELECT 1
          FROM nodes
         WHERE organization_id = NEW.organization_id
           AND environment = NEW.environment
           AND id IS DISTINCT FROM NEW.id
    ) INTO target_environment_exists;

    IF NOT target_environment_exists THEN
        SELECT count(DISTINCT environment)
          INTO existing_environments
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

DROP TRIGGER IF EXISTS nodes_entitlement_capacity_insert ON nodes;
CREATE TRIGGER nodes_entitlement_capacity_insert
BEFORE INSERT ON nodes
FOR EACH ROW EXECUTE FUNCTION proxima_enforce_node_capacity();

DROP TRIGGER IF EXISTS nodes_entitlement_capacity_update ON nodes;
CREATE TRIGGER nodes_entitlement_capacity_update
BEFORE UPDATE OF organization_id, environment ON nodes
FOR EACH ROW EXECUTE FUNCTION proxima_enforce_node_capacity();


CREATE OR REPLACE FUNCTION proxima_enforce_tenant_capacity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    org_id UUID;
    ent RECORD;
    existing_tenants BIGINT;
BEGIN
    SELECT organization_id
      INTO org_id
      FROM projects
     WHERE id = NEW.project_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGATA_ENTITLEMENT_MISSING: project';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(org_id::text || ':tenant-capacity', 0));

    SELECT tenant_limit, billing_status
      INTO ent
      FROM organization_entitlements
     WHERE organization_id = org_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGATA_ENTITLEMENT_MISSING: tenants';
    END IF;

    IF ent.billing_status IN ('canceled', 'unpaid') THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGATA_SUBSCRIPTION_INACTIVE: tenants';
    END IF;

    SELECT count(*)
      INTO existing_tenants
      FROM tenants t
      JOIN projects p ON p.id = t.project_id
     WHERE p.organization_id = org_id
       AND t.id IS DISTINCT FROM NEW.id;

    IF existing_tenants >= ent.tenant_limit THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGATA_PLAN_LIMIT: tenants';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tenants_entitlement_capacity_insert ON tenants;
CREATE TRIGGER tenants_entitlement_capacity_insert
BEFORE INSERT ON tenants
FOR EACH ROW EXECUTE FUNCTION proxima_enforce_tenant_capacity();

DROP TRIGGER IF EXISTS tenants_entitlement_capacity_update ON tenants;
CREATE TRIGGER tenants_entitlement_capacity_update
BEFORE UPDATE OF project_id ON tenants
FOR EACH ROW EXECUTE FUNCTION proxima_enforce_tenant_capacity();
