#!/usr/bin/env bash
set -euo pipefail

fail() { echo "FAIL: $1" >&2; exit 1; }
pass() { echo "PASS: $1"; }

root="crates/proxima-control-plane/migrations"
test_db="proxima_capacity_test"

: "${PGHOST:=localhost}"
: "${PGPORT:=5432}"
: "${PGUSER:=proxima}"
: "${PGPASSWORD:=proxima-dev-only}"
export PGHOST PGPORT PGUSER PGPASSWORD

psql -v ON_ERROR_STOP=1 -d postgres -c "DROP DATABASE IF EXISTS ${test_db}" >/dev/null
psql -v ON_ERROR_STOP=1 -d postgres -c "CREATE DATABASE ${test_db}" >/dev/null
for migration in "${root}"/*.sql; do
  psql -v ON_ERROR_STOP=1 -d "${test_db}" -f "${migration}" >/dev/null
done

org_a="a0000000-0000-4000-8000-000000000001"
org_b="a0000000-0000-4000-8000-000000000002"
project_a="b0000000-0000-4000-8000-000000000001"
project_b="b0000000-0000-4000-8000-000000000002"

psql -v ON_ERROR_STOP=1 -d "${test_db}" <<SQL
INSERT INTO organizations(id,name,slug) VALUES
 ('${org_a}','Capacity Test A','capacity-test-a'),
 ('${org_b}','Capacity Test B','capacity-test-b');
INSERT INTO projects(id,organization_id,name,slug) VALUES
 ('${project_a}','${org_a}','Production','production'),
 ('${project_b}','${org_b}','Production','production');
UPDATE organization_entitlements
   SET node_limit=1, tenant_limit=1, environment_limit=1, billing_status='active'
 WHERE organization_id IN ('${org_a}','${org_b}');
SQL

psql -v ON_ERROR_STOP=1 -d "${test_db}" <<'SQL'
INSERT INTO nodes(id,organization_id,name,environment,region)
VALUES ('c0000000-0000-4000-8000-000000000001',
        'a0000000-0000-4000-8000-000000000001','node-1','production','auto');
DO $$
DECLARE message_text text;
BEGIN
  BEGIN
    INSERT INTO nodes(id,organization_id,name,environment,region)
    VALUES ('c0000000-0000-4000-8000-000000000002',
            'a0000000-0000-4000-8000-000000000001','node-2','production','auto');
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    GET STACKED DIAGNOSTICS message_text = MESSAGE_TEXT;
  END;
  IF message_text IS NULL OR message_text NOT LIKE 'AGATA_PLAN_LIMIT: nodes%' THEN
    RAISE EXCEPTION 'Node capacity trigger did not reject the over-limit insert: %', message_text;
  END IF;
END $$;
SQL
pass "node capacity is enforced in the database"

psql -v ON_ERROR_STOP=1 -d "${test_db}" -c "UPDATE organization_entitlements SET node_limit=10 WHERE organization_id='${org_a}'" >/dev/null
psql -v ON_ERROR_STOP=1 -d "${test_db}" <<'SQL'
DO $$
DECLARE message_text text;
BEGIN
  BEGIN
    INSERT INTO nodes(id,organization_id,name,environment,region)
    VALUES ('c0000000-0000-4000-8000-000000000003',
            'a0000000-0000-4000-8000-000000000001','node-staging','staging','auto');
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    GET STACKED DIAGNOSTICS message_text = MESSAGE_TEXT;
  END;
  IF message_text IS NULL OR message_text NOT LIKE 'AGATA_PLAN_LIMIT: environments%' THEN
    RAISE EXCEPTION 'Environment capacity trigger did not reject the over-limit insert: %', message_text;
  END IF;
END $$;
SQL
pass "environment capacity is enforced in the database"

psql -v ON_ERROR_STOP=1 -d "${test_db}" <<'SQL'
INSERT INTO tenants(id,project_id,name,slug)
VALUES ('d0000000-0000-4000-8000-000000000001',
        'b0000000-0000-4000-8000-000000000001','tenant-1','tenant-1');
DO $$
DECLARE message_text text;
BEGIN
  BEGIN
    INSERT INTO tenants(id,project_id,name,slug)
    VALUES ('d0000000-0000-4000-8000-000000000002',
            'b0000000-0000-4000-8000-000000000001','tenant-2','tenant-2');
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    GET STACKED DIAGNOSTICS message_text = MESSAGE_TEXT;
  END;
  IF message_text IS NULL OR message_text NOT LIKE 'AGATA_PLAN_LIMIT: tenants%' THEN
    RAISE EXCEPTION 'Tenant capacity trigger did not reject the over-limit insert: %', message_text;
  END IF;
END $$;
SQL
pass "tenant capacity is enforced across the organization"

psql -v ON_ERROR_STOP=1 -d "${test_db}" -c "DELETE FROM organization_entitlements WHERE organization_id='${org_b}'" >/dev/null
psql -v ON_ERROR_STOP=1 -d "${test_db}" <<'SQL'
DO $$
DECLARE message_text text;
BEGIN
  BEGIN
    INSERT INTO nodes(id,organization_id,name,environment,region)
    VALUES ('c0000000-0000-4000-8000-000000000004',
            'a0000000-0000-4000-8000-000000000002','no-entitlement','production','auto');
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    GET STACKED DIAGNOSTICS message_text = MESSAGE_TEXT;
  END;
  IF message_text IS NULL OR message_text NOT LIKE 'AGATA_ENTITLEMENT_MISSING:%' THEN
    RAISE EXCEPTION 'Missing entitlement state did not fail closed: %', message_text;
  END IF;
END $$;
SQL
pass "missing entitlement state fails closed"

# Race two writers against one remaining node slot. The transaction-scoped
# advisory lock must serialize the count-and-insert check so exactly one wins.
psql -v ON_ERROR_STOP=1 -d "${test_db}" -c "INSERT INTO organization_entitlements(organization_id,node_limit,tenant_limit,environment_limit,billing_status) VALUES('${org_b}',1,10,5,'active') ON CONFLICT(organization_id) DO UPDATE SET node_limit=1,tenant_limit=10,environment_limit=5,billing_status='active'" >/dev/null
set +e
psql -v ON_ERROR_STOP=1 -d "${test_db}" -c "INSERT INTO nodes(id,organization_id,name,environment,region) VALUES ('c0000000-0000-4000-8000-000000000005','${org_b}','race-a','production','auto')" >/tmp/phase322-b-race-a.log 2>&1 &
pid_a=$!
psql -v ON_ERROR_STOP=1 -d "${test_db}" -c "INSERT INTO nodes(id,organization_id,name,environment,region) VALUES ('c0000000-0000-4000-8000-000000000006','${org_b}','race-b','production','auto')" >/tmp/phase322-b-race-b.log 2>&1 &
pid_b=$!
wait "$pid_a"; result_a=$?
wait "$pid_b"; result_b=$?
set -e
if [[ $result_a -eq 0 && $result_b -eq 0 ]]; then
  fail "concurrent node creation exceeded the configured capacity"
fi
if [[ $result_a -ne 0 && $result_b -ne 0 ]]; then
  cat /tmp/phase322-b-race-a.log /tmp/phase322-b-race-b.log >&2
  fail "both concurrent node creations failed; expected exactly one to succeed"
fi
pass "concurrent node creation cannot exceed capacity"

echo "PASS: Phase 3.22-B capacity enforcement checks"
