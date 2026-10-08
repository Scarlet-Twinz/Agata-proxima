-- Team seats include active memberships plus invitations that are still valid and unaccepted.
ALTER TABLE organization_entitlements
  ADD COLUMN IF NOT EXISTS team_seat_limit INTEGER NOT NULL DEFAULT 1
  CHECK (team_seat_limit >= 0);

UPDATE organization_entitlements
   SET team_seat_limit = CASE plan_key
       WHEN 'starter' THEN 5
       WHEN 'growth' THEN 15
       WHEN 'scale' THEN 50
       WHEN 'enterprise' THEN 2147483647
       ELSE 1
   END;

-- New organizations must always receive a Free entitlement row. Earlier migrations
-- backfilled only organizations that existed when the migration ran.
CREATE OR REPLACE FUNCTION proxima_initialize_organization_entitlements()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO organization_entitlements(organization_id)
    VALUES (NEW.id)
    ON CONFLICT (organization_id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organizations_initialize_entitlements ON organizations;
CREATE TRIGGER organizations_initialize_entitlements
AFTER INSERT ON organizations
FOR EACH ROW EXECUTE FUNCTION proxima_initialize_organization_entitlements();

INSERT INTO organization_entitlements(organization_id)
SELECT id FROM organizations
ON CONFLICT (organization_id) DO NOTHING;


CREATE OR REPLACE FUNCTION proxima_enforce_team_seat_capacity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    org_id UUID;
    ent RECORD;
    active_members BIGINT;
    pending_invites BIGINT;
    total_seats BIGINT;
BEGIN
    org_id := NEW.organization_id;

    IF TG_TABLE_NAME = 'organization_invites'
       AND (NEW.accepted_at IS NOT NULL OR NEW.expires_at <= now()) THEN
        RETURN NEW;
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(org_id::text || ':team-seat-capacity', 0));

    SELECT team_seat_limit, billing_status
      INTO ent
      FROM organization_entitlements
     WHERE organization_id = org_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGATA_ENTITLEMENT_MISSING: team_seats';
    END IF;

    IF ent.billing_status IN ('canceled', 'unpaid') THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGATA_SUBSCRIPTION_INACTIVE: team_seats';
    END IF;

    SELECT count(*)
      INTO active_members
      FROM memberships
     WHERE organization_id = org_id
       AND (TG_TABLE_NAME <> 'memberships' OR user_id IS DISTINCT FROM NEW.user_id);

    SELECT count(*)
      INTO pending_invites
      FROM organization_invites
     WHERE organization_id = org_id
       AND accepted_at IS NULL
       AND expires_at > now()
       AND (TG_TABLE_NAME <> 'organization_invites' OR id IS DISTINCT FROM NEW.id);

    total_seats := active_members + pending_invites;
    IF total_seats >= ent.team_seat_limit THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGATA_PLAN_LIMIT: team_seats';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS memberships_entitlement_capacity_insert ON memberships;
CREATE TRIGGER memberships_entitlement_capacity_insert
BEFORE INSERT ON memberships
FOR EACH ROW EXECUTE FUNCTION proxima_enforce_team_seat_capacity();

DROP TRIGGER IF EXISTS memberships_entitlement_capacity_update ON memberships;
CREATE TRIGGER memberships_entitlement_capacity_update
BEFORE UPDATE OF organization_id, user_id ON memberships
FOR EACH ROW EXECUTE FUNCTION proxima_enforce_team_seat_capacity();

DROP TRIGGER IF EXISTS organization_invites_entitlement_capacity_insert ON organization_invites;
CREATE TRIGGER organization_invites_entitlement_capacity_insert
BEFORE INSERT ON organization_invites
FOR EACH ROW EXECUTE FUNCTION proxima_enforce_team_seat_capacity();

DROP TRIGGER IF EXISTS organization_invites_entitlement_capacity_update ON organization_invites;
CREATE TRIGGER organization_invites_entitlement_capacity_update
BEFORE UPDATE OF organization_id, email, expires_at, accepted_at ON organization_invites
FOR EACH ROW EXECUTE FUNCTION proxima_enforce_team_seat_capacity();
