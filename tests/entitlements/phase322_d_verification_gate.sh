#!/usr/bin/env bash
set -euo pipefail

fail() { echo "FAIL: $1" >&2; exit 1; }
pass() { echo "PASS: $1"; }

root="crates/proxima-control-plane/migrations"
test_db="proxima_verification_test"
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

org_a="91000000-0000-4000-8000-000000000001"
org_b="91000000-0000-4000-8000-000000000002"
org_c="91000000-0000-4000-8000-000000000003"
org_d="91000000-0000-4000-8000-000000000004"

psql -v ON_ERROR_STOP=1 -d "${test_db}" <<SQL
INSERT INTO organizations(id,name,slug) VALUES
 ('${org_a}','Verification Test A','verification-test-a'),
 ('${org_b}','Verification Test B','verification-test-b'),
 ('${org_c}','Verification Test C','verification-test-c'),
 ('${org_d}','Verification Test D','verification-test-d');
INSERT INTO organization_entitlements(organization_id,plan_key,billing_status,verification_limit_monthly)
VALUES ('${org_a}','free','active',1), ('${org_b}','free','active',1), ('${org_d}','free','active',1)
ON CONFLICT (organization_id) DO UPDATE
SET plan_key=EXCLUDED.plan_key,billing_status=EXCLUDED.billing_status,
    verification_limit_monthly=EXCLUDED.verification_limit_monthly;
SQL

psql -v ON_ERROR_STOP=1 -d "${test_db}" <<'SQL'
INSERT INTO verification_results(id,organization_id,kind,status,evidence)
VALUES ('92000000-0000-4000-8000-000000000001',
        '91000000-0000-4000-8000-000000000001','basic','pass','{}'::jsonb);
DO $$
DECLARE message_text text;
BEGIN
  BEGIN
    INSERT INTO verification_results(id,organization_id,kind,status,evidence)
    VALUES ('92000000-0000-4000-8000-000000000002',
            '91000000-0000-4000-8000-000000000001','basic','pass','{}'::jsonb);
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    GET STACKED DIAGNOSTICS message_text = MESSAGE_TEXT;
  END;
  IF message_text IS NULL OR message_text NOT LIKE 'AGATA_PLAN_LIMIT: verifications%' THEN
    RAISE EXCEPTION 'Monthly verification quota did not reject the over-limit insert: %', message_text;
  END IF;
END $$;
SQL
pass "monthly verification quota is enforced"

# A previous month's consumed quota must not consume the current month's allowance.
psql -v ON_ERROR_STOP=1 -d "${test_db}" <<'SQL'
INSERT INTO organization_verification_usage(organization_id,period_start,used_count)
VALUES ('91000000-0000-4000-8000-000000000002',
        date_trunc('month',(now() AT TIME ZONE 'UTC') - interval '1 month')::date,1);
INSERT INTO verification_results(id,organization_id,kind,status,evidence)
VALUES ('92000000-0000-4000-8000-000000000003',
        '91000000-0000-4000-8000-000000000002','basic','pass','{}'::jsonb);
DO $$
DECLARE message_text text;
BEGIN
  BEGIN
    INSERT INTO verification_results(id,organization_id,kind,status,evidence)
    VALUES ('92000000-0000-4000-8000-000000000004',
            '91000000-0000-4000-8000-000000000002','basic','pass','{}'::jsonb);
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    GET STACKED DIAGNOSTICS message_text = MESSAGE_TEXT;
  END;
  IF message_text IS NULL OR message_text NOT LIKE 'AGATA_PLAN_LIMIT: verifications%' THEN
    RAISE EXCEPTION 'Current-month usage did not enforce the reset quota: %', message_text;
  END IF;
END $$;
SQL
pass "quota resets on the UTC calendar-month boundary"

# Missing entitlement state must fail closed.
psql -v ON_ERROR_STOP=1 -d "${test_db}" <<'SQL'
DO $$
DECLARE message_text text;
BEGIN
  BEGIN
    INSERT INTO verification_results(id,organization_id,kind,status,evidence)
    VALUES ('92000000-0000-4000-8000-000000000005',
            '91000000-0000-4000-8000-000000000003','basic','pass','{}'::jsonb);
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    GET STACKED DIAGNOSTICS message_text = MESSAGE_TEXT;
  END;
  IF message_text IS NULL OR message_text NOT LIKE 'AGATA_ENTITLEMENT_MISSING: verifications%' THEN
    RAISE EXCEPTION 'Missing verification entitlement did not fail closed: %', message_text;
  END IF;
END $$;
SQL
pass "missing verification entitlement fails closed"

# Race two inserts against one monthly verification slot; exactly one may commit.
set +e
psql -v ON_ERROR_STOP=1 -d "${test_db}" -c "INSERT INTO verification_results(id,organization_id,kind,status,evidence) VALUES ('92000000-0000-4000-8000-000000000006','${org_d}','basic','pass','{}'::jsonb)" >/tmp/phase322-d-race-a.log 2>&1 &
pid_a=$!
psql -v ON_ERROR_STOP=1 -d "${test_db}" -c "INSERT INTO verification_results(id,organization_id,kind,status,evidence) VALUES ('92000000-0000-4000-8000-000000000007','${org_d}','basic','pass','{}'::jsonb)" >/tmp/phase322-d-race-b.log 2>&1 &
pid_b=$!
wait "$pid_a"; result_a=$?
wait "$pid_b"; result_b=$?
set -e
if [[ $result_a -eq 0 && $result_b -eq 0 ]]; then
  fail "concurrent verification creation exceeded monthly quota"
fi
if [[ $result_a -ne 0 && $result_b -ne 0 ]]; then
  cat /tmp/phase322-d-race-a.log /tmp/phase322-d-race-b.log >&2
  fail "both concurrent verification inserts failed; expected exactly one to succeed"
fi
pass "concurrent verification creation cannot exceed quota"

echo "PASS: Phase 3.22-D verification quota checks"
