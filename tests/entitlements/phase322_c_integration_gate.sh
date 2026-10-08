#!/usr/bin/env bash
set -euo pipefail

fail() { echo "FAIL: $1" >&2; exit 1; }
pass() { echo "PASS: $1"; }

root="crates/proxima-control-plane/migrations"
test_db="proxima_integration_test"
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

org_a="e0000000-0000-4000-8000-000000000001"
org_b="e0000000-0000-4000-8000-000000000002"
org_c="e0000000-0000-4000-8000-000000000003"
project_a="f0000000-0000-4000-8000-000000000001"
project_b="f0000000-0000-4000-8000-000000000002"
project_c="f0000000-0000-4000-8000-000000000003"

psql -v ON_ERROR_STOP=1 -d "${test_db}" <<SQL
INSERT INTO organizations(id,name,slug) VALUES
 ('${org_a}','Integration Test A','integration-test-a'),
 ('${org_b}','Integration Test B','integration-test-b'),
 ('${org_c}','Integration Test C','integration-test-c');
INSERT INTO projects(id,organization_id,name,slug) VALUES
 ('${project_a}','${org_a}','Production','production'),
 ('${project_b}','${org_b}','Production','production'),
 ('${project_c}','${org_c}','Production','production');
INSERT INTO organization_entitlements(organization_id,plan_key,billing_status,integration_limit)
VALUES ('${org_a}','free','active',1), ('${org_b}','free','active',1)
ON CONFLICT (organization_id) DO UPDATE
SET plan_key=EXCLUDED.plan_key,billing_status=EXCLUDED.billing_status,
    integration_limit=EXCLUDED.integration_limit;
SQL

psql -v ON_ERROR_STOP=1 -d "${test_db}" <<'SQL'
INSERT INTO webhooks(id,organization_id,name,endpoint_url,signing_secret_hash,signing_secret_hint,events,enabled)
VALUES ('10000000-0000-4000-8000-000000000001',
        'e0000000-0000-4000-8000-000000000001','webhook-1','https://example.com/hooks',
        decode(repeat('1',64),'hex'),'hint-1','[]'::jsonb,true);
DO $$
DECLARE message_text text;
BEGIN
  BEGIN
    INSERT INTO webhooks(id,organization_id,name,endpoint_url,signing_secret_hash,signing_secret_hint,events,enabled)
    VALUES ('10000000-0000-4000-8000-000000000002',
            'e0000000-0000-4000-8000-000000000001','webhook-2','https://example.com/hooks-2',
            decode(repeat('2',64),'hex'),'hint-2','[]'::jsonb,true);
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    GET STACKED DIAGNOSTICS message_text = MESSAGE_TEXT;
  END;
  IF message_text IS NULL OR message_text NOT LIKE 'AGATA_PLAN_LIMIT: integrations%' THEN
    RAISE EXCEPTION 'Integration quota did not reject the over-limit webhook: %', message_text;
  END IF;
END $$;
SQL
pass "active webhook integration limit is enforced"

# Disabled integrations are retained but do not consume an active integration slot.
psql -v ON_ERROR_STOP=1 -d "${test_db}" -c "INSERT INTO webhooks(id,organization_id,name,endpoint_url,signing_secret_hash,signing_secret_hint,events,enabled) VALUES ('10000000-0000-4000-8000-000000000003','${org_a}','webhook-disabled','https://example.com/disabled',decode(repeat('3',64),'hex'),'hint-3','[]'::jsonb,false)" >/dev/null
psql -v ON_ERROR_STOP=1 -d "${test_db}" <<'SQL'
DO $$
DECLARE message_text text;
BEGIN
  BEGIN
    UPDATE webhooks SET enabled=true
     WHERE id='10000000-0000-4000-8000-000000000003';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    GET STACKED DIAGNOSTICS message_text = MESSAGE_TEXT;
  END;
  IF message_text IS NULL OR message_text NOT LIKE 'AGATA_PLAN_LIMIT: integrations%' THEN
    RAISE EXCEPTION 'Re-enabling an integration beyond quota was not rejected: %', message_text;
  END IF;
END $$;
SQL
pass "disabled integrations can be retained and re-enable is quota-checked"

# A missing entitlement row must never be interpreted as unlimited access.
psql -v ON_ERROR_STOP=1 -d "${test_db}" -c "DELETE FROM organization_entitlements WHERE organization_id='${org_c}'" >/dev/null
psql -v ON_ERROR_STOP=1 -d "${test_db}" <<'SQL'
DO $$
DECLARE message_text text;
BEGIN
  BEGIN
    INSERT INTO webhooks(id,organization_id,name,endpoint_url,signing_secret_hash,signing_secret_hint,events,enabled)
    VALUES ('10000000-0000-4000-8000-000000000004',
            'e0000000-0000-4000-8000-000000000003','no-entitlement','https://example.com/no-entitlement',
            decode(repeat('4',64),'hex'),'hint-4','[]'::jsonb,true);
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    GET STACKED DIAGNOSTICS message_text = MESSAGE_TEXT;
  END;
  IF message_text IS NULL OR message_text NOT LIKE 'AGATA_ENTITLEMENT_MISSING: integrations%' THEN
    RAISE EXCEPTION 'Missing integration entitlement did not fail closed: %', message_text;
  END IF;
END $$;
SQL
pass "missing integration entitlement fails closed"

# Race two writers against a single integration slot; exactly one may commit.
set +e
psql -v ON_ERROR_STOP=1 -d "${test_db}" -c "INSERT INTO webhooks(id,organization_id,name,endpoint_url,signing_secret_hash,signing_secret_hint,events,enabled) VALUES ('10000000-0000-4000-8000-000000000005','${org_b}','race-a','https://example.com/race-a',decode(repeat('5',64),'hex'),'hint-5','[]'::jsonb,true)" >/tmp/phase322-c-race-a.log 2>&1 &
pid_a=$!
psql -v ON_ERROR_STOP=1 -d "${test_db}" -c "INSERT INTO webhooks(id,organization_id,name,endpoint_url,signing_secret_hash,signing_secret_hint,events,enabled) VALUES ('10000000-0000-4000-8000-000000000006','${org_b}','race-b','https://example.com/race-b',decode(repeat('6',64),'hex'),'hint-6','[]'::jsonb,true)" >/tmp/phase322-c-race-b.log 2>&1 &
pid_b=$!
wait "$pid_a"; result_a=$?
wait "$pid_b"; result_b=$?
set -e
if [[ $result_a -eq 0 && $result_b -eq 0 ]]; then
  fail "concurrent integration creation exceeded quota"
fi
if [[ $result_a -ne 0 && $result_b -ne 0 ]]; then
  cat /tmp/phase322-c-race-a.log /tmp/phase322-c-race-b.log >&2
  fail "both concurrent integration creations failed; expected exactly one to succeed"
fi
pass "concurrent integration creation cannot exceed quota"

echo "PASS: Phase 3.22-C integration quota checks"
