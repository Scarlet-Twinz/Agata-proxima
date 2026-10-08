#!/usr/bin/env bash
set -euo pipefail

fail() { echo "FAIL: $1" >&2; exit 1; }
pass() { echo "PASS: $1"; }

root="crates/proxima-control-plane/migrations"
test_db="proxima_audit_retention_test"
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

org_a="a1000000-0000-4000-8000-000000000001"
org_b="a1000000-0000-4000-8000-000000000002"
org_c="a1000000-0000-4000-8000-000000000003"

psql -v ON_ERROR_STOP=1 -d "${test_db}" <<SQL
INSERT INTO organizations(id,name,slug) VALUES
 ('${org_a}','Audit Retention A','audit-retention-a'),
 ('${org_b}','Audit Retention B','audit-retention-b'),
 ('${org_c}','Audit Retention C','audit-retention-c');
INSERT INTO organization_entitlements(organization_id,plan_key,billing_status,audit_retention_days)
VALUES ('${org_a}','free','active',7), ('${org_b}','starter','active',30)
ON CONFLICT (organization_id) DO UPDATE
SET plan_key=EXCLUDED.plan_key,billing_status=EXCLUDED.billing_status,
    audit_retention_days=EXCLUDED.audit_retention_days;
DELETE FROM organization_entitlements WHERE organization_id='${org_c}';
INSERT INTO audit_events(id,organization_id,action,resource_type,metadata,created_at) VALUES
 ('a2000000-0000-4000-8000-000000000001','${org_a}','old-a','test','{}'::jsonb,now()-interval '8 days'),
 ('a2000000-0000-4000-8000-000000000002','${org_a}','recent-a','test','{}'::jsonb,now()-interval '6 days'),
 ('a2000000-0000-4000-8000-000000000003','${org_b}','old-b','test','{}'::jsonb,now()-interval '8 days'),
 ('a2000000-0000-4000-8000-000000000004','${org_c}','old-no-entitlement','test','{}'::jsonb,now()-interval '8 days');
SQL

removed=$(psql -v ON_ERROR_STOP=1 -d "${test_db}" -Atc "SELECT proxima_purge_expired_audit_events()")
[[ "$removed" == "1" ]] || fail "expected one expired event to be purged, got ${removed}"

exists_a_old=$(psql -v ON_ERROR_STOP=1 -d "${test_db}" -Atc "SELECT EXISTS(SELECT 1 FROM audit_events WHERE id='a2000000-0000-4000-8000-000000000001')")
exists_a_recent=$(psql -v ON_ERROR_STOP=1 -d "${test_db}" -Atc "SELECT EXISTS(SELECT 1 FROM audit_events WHERE id='a2000000-0000-4000-8000-000000000002')")
exists_b_old=$(psql -v ON_ERROR_STOP=1 -d "${test_db}" -Atc "SELECT EXISTS(SELECT 1 FROM audit_events WHERE id='a2000000-0000-4000-8000-000000000003')")
exists_c_old=$(psql -v ON_ERROR_STOP=1 -d "${test_db}" -Atc "SELECT EXISTS(SELECT 1 FROM audit_events WHERE id='a2000000-0000-4000-8000-000000000004')")

[[ "$exists_a_old" == "f" ]] || fail "expired event exceeded the Free 7-day retention window"
[[ "$exists_a_recent" == "t" ]] || fail "recent event inside the Free retention window was deleted"
[[ "$exists_b_old" == "t" ]] || fail "event inside the Starter 30-day retention window was deleted"
[[ "$exists_c_old" == "t" ]] || fail "event without entitlement state should be preserved rather than guessed at"
pass "purge applies each organization's own retention policy and preserves unresolved records"

# The API must hide expired events even before the hourly physical cleanup runs.
grep -Fq 'a.created_at >= now() - make_interval(days => e.audit_retention_days)' crates/proxima-control-plane/src/main.rs || fail "audit API does not apply the retention cutoff"
grep -Fq 'production::purge_expired_audit_events(&retention_db)' crates/proxima-control-plane/src/main.rs || fail "hourly audit retention worker is not wired"
for migration in 0008_paystack_billing.sql 0009_capacity_enforcement.sql 0010_integration_quotas.sql 0011_verification_quotas.sql 0012_audit_retention.sql; do
  grep -Fq "$migration" crates/proxima-control-plane/src/main.rs || fail "startup does not apply migration $migration"
done
pass "API filtering, hourly cleanup, and startup migration wiring are present"

echo "PASS: Phase 3.22-E audit retention checks"
