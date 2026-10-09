#!/usr/bin/env bash
set -euo pipefail

fail() { echo "FAIL: $1" >&2; exit 1; }
pass() { echo "PASS: $1"; }

root="crates/proxima-control-plane/migrations"
test_db="proxima_api_entitlements_test"
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

org_a="a4000000-0000-4000-8000-000000000001"
org_b="a4000000-0000-4000-8000-000000000002"
org_c="a4000000-0000-4000-8000-000000000003"
user_a="b4000000-0000-4000-8000-000000000001"

psql -v ON_ERROR_STOP=1 -d "${test_db}" <<SQL
INSERT INTO users(id,email,display_name,password_hash)
VALUES ('${user_a}','api-owner@example.test','API Owner','test-hash');
INSERT INTO organizations(id,name,slug) VALUES
 ('${org_a}','API Entitlement A','api-entitlement-a'),
 ('${org_b}','API Entitlement B','api-entitlement-b'),
 ('${org_c}','API Entitlement C','api-entitlement-c');
UPDATE organization_entitlements
   SET api_key_limit=1,api_requests_per_minute=2,support_level='community',billing_status='active'
 WHERE organization_id IN ('${org_a}','${org_b}','${org_c}');
SQL

psql -v ON_ERROR_STOP=1 -d "${test_db}" <<'SQL'
INSERT INTO api_keys(id,organization_id,created_by,name,key_prefix,key_hash)
VALUES ('a5000000-0000-4000-8000-000000000001',
        'a4000000-0000-4000-8000-000000000001',
        'b4000000-0000-4000-8000-000000000001','key-1','aga_test00001',decode(repeat('1',64),'hex'));
DO $$
DECLARE message_text text;
BEGIN
  BEGIN
    INSERT INTO api_keys(id,organization_id,created_by,name,key_prefix,key_hash)
    VALUES ('a5000000-0000-4000-8000-000000000002',
            'a4000000-0000-4000-8000-000000000001',
            'b4000000-0000-4000-8000-000000000001','key-2','aga_test00002',decode(repeat('2',64),'hex'));
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    GET STACKED DIAGNOSTICS message_text = MESSAGE_TEXT;
  END;
  IF message_text IS NULL OR message_text NOT LIKE 'AGATA_PLAN_LIMIT: api_keys%' THEN
    RAISE EXCEPTION 'API key quota did not reject the over-limit key: %', message_text;
  END IF;
END $$;
UPDATE api_keys SET revoked_at=now()
 WHERE id='a5000000-0000-4000-8000-000000000001';
INSERT INTO api_keys(id,organization_id,created_by,name,key_prefix,key_hash)
VALUES ('a5000000-0000-4000-8000-000000000003',
        'a4000000-0000-4000-8000-000000000001',
        'b4000000-0000-4000-8000-000000000001','key-after-revoke','aga_test00003',decode(repeat('3',64),'hex'));
SQL
pass "active API key count is enforced and revocation frees a slot"

first=$(psql -v ON_ERROR_STOP=1 -d "${test_db}" -Atc "SELECT proxima_consume_api_request('${org_a}')")
second=$(psql -v ON_ERROR_STOP=1 -d "${test_db}" -Atc "SELECT proxima_consume_api_request('${org_a}')")
third=$(psql -v ON_ERROR_STOP=1 -d "${test_db}" -Atc "SELECT proxima_consume_api_request('${org_a}')")
[[ "$first" == "t" && "$second" == "t" && "$third" == "f" ]] || fail "per-minute API rate quota expected true,true,false; got ${first},${second},${third}"
pass "per-organization requests-per-minute quota is enforced"

# Concurrent creation must not race past the API-key inventory ceiling.
set +e
psql -v ON_ERROR_STOP=1 -d "${test_db}" -c "INSERT INTO api_keys(id,organization_id,created_by,name,key_prefix,key_hash) VALUES ('a5000000-0000-4000-8000-000000000004','${org_b}','${user_a}','race-a','aga_race00004',decode(repeat('4',64),'hex'))" >/tmp/phase322-g-race-a.log 2>&1 &
pid_a=$!
psql -v ON_ERROR_STOP=1 -d "${test_db}" -c "INSERT INTO api_keys(id,organization_id,created_by,name,key_prefix,key_hash) VALUES ('a5000000-0000-4000-8000-000000000005','${org_b}','${user_a}','race-b','aga_race00005',decode(repeat('5',64),'hex'))" >/tmp/phase322-g-race-b.log 2>&1 &
pid_b=$!
wait "$pid_a"; result_a=$?
wait "$pid_b"; result_b=$?
set -e
if [[ $result_a -eq 0 && $result_b -eq 0 ]]; then
  fail "concurrent API-key creation exceeded the key limit"
fi
if [[ $result_a -ne 0 && $result_b -ne 0 ]]; then
  cat /tmp/phase322-g-race-a.log /tmp/phase322-g-race-b.log >&2
  fail "both concurrent API-key creations failed; expected exactly one to succeed"
fi
pass "concurrent API-key creation cannot exceed the key limit"

# Missing entitlement state must fail closed for request metering.
psql -v ON_ERROR_STOP=1 -d "${test_db}" -c "DELETE FROM organization_entitlements WHERE organization_id='${org_c}'" >/dev/null
psql -v ON_ERROR_STOP=1 -d "${test_db}" <<'SQL'
DO $$
DECLARE message_text text;
BEGIN
  BEGIN
    PERFORM proxima_consume_api_request('a4000000-0000-4000-8000-000000000003');
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    GET STACKED DIAGNOSTICS message_text = MESSAGE_TEXT;
  END;
  IF message_text IS NULL OR message_text NOT LIKE 'AGATA_ENTITLEMENT_MISSING: api_requests%' THEN
    RAISE EXCEPTION 'Missing API entitlement did not fail closed: %', message_text;
  END IF;
END $$;
SQL
pass "missing API entitlement fails closed"

grep -Fq 'unknown_feature_entitlement' crates/proxima-control-plane/src/production.rs || fail "unknown feature keys do not fail closed"
grep -Fq 'header::AUTHORIZATION' crates/proxima-control-plane/src/main.rs || fail "Bearer API-key authentication is not wired"
grep -Fq 'production::consume_api_request' crates/proxima-control-plane/src/main.rs || fail "request-rate limiting is not called by authentication"
grep -Fq 'production::enforce_api_key_capacity' crates/proxima-control-plane/src/main.rs || fail "API-key creation does not enforce its quota"
grep -Fq 'contains(&requested)' crates/proxima-control-plane/src/production/lemonsqueezy.rs || fail "Self-service checkout does not use the allowed-plan list"
grep -Fq 'plan_for_variant(requested)' crates/proxima-control-plane/src/production/lemonsqueezy.rs || fail "Unknown plans, Free and Enterprise cannot be mapped to self-service checkout"
grep -Fq 'support_level' crates/proxima-control-plane/src/production.rs || fail "support-level entitlement is not exposed"
echo "PASS: Phase 3.22-G API, enterprise, and support checks"
