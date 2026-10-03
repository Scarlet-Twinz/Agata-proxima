#!/usr/bin/env bash
set -euo pipefail

: "\${PGHOST:=localhost}"
: "\${PGPORT:=5432}"
: "\${PGUSER:=proxima}"
: "\${PGDATABASE:=proxima_dev}"
: "\${PGPASSWORD:=proxima-dev-only}"

psql -v ON_ERROR_STOP=1 -f tests/postgres/001_rls_fixture.sql

assert_eq() {
  local expected="$1"
  local actual="$2"
  local label="$3"
  if [[ "$expected" != "$actual" ]]; then
    echo "FAIL: $label (expected '$expected', got '$actual')" >&2
    exit 1
  fi
  echo "PASS: $label"
}

run_as_a() {
  PGUSER=proxima_tenant_a PGPASSWORD=proxima-tenant-dev-only psql -Atqc "$1"
}

run_as_b() {
  PGUSER=proxima_tenant_b PGPASSWORD=proxima-tenant-dev-only psql -Atqc "$1"
}

a_rows="$(run_as_a "SELECT string_agg(secret, ',' ORDER BY secret) FROM proxima_test.records;")"
assert_eq "A-secret" "$a_rows" "tenant A cannot read tenant B"

b_rows="$(run_as_b "SELECT string_agg(secret, ',' ORDER BY secret) FROM proxima_test.records;")"
assert_eq "B-secret" "$b_rows" "tenant B cannot read tenant A"

prepared_rows="$(run_as_a "PREPARE tenant_lookup(text) AS SELECT string_agg(secret, ',' ORDER BY secret) FROM proxima_test.records WHERE tenant_id=\$1; EXECUTE tenant_lookup('tenant_b');")"
assert_eq "" "$prepared_rows" "prepared statement cannot bypass tenant policy"

set +e
insert_error="$(run_as_a "INSERT INTO proxima_test.records (tenant_id, secret) VALUES ('tenant_b', 'forbidden');" 2>&1)"
insert_status=$?
set -e
if [[ "$insert_status" -eq 0 ]]; then
  echo "FAIL: tenant A cannot insert into tenant B" >&2
  exit 1
fi
if [[ "$insert_error" != *"row-level security"* ]]; then
  echo "FAIL: cross-tenant insert was rejected for an unexpected reason: $insert_error" >&2
  exit 1
fi
echo "PASS: tenant A cannot insert into tenant B"

cross_update="$(run_as_a "UPDATE proxima_test.records SET secret='blocked' WHERE tenant_id='tenant_b'; SELECT count(*) FROM proxima_test.records WHERE secret='blocked';")"
assert_eq "0" "$cross_update" "tenant A cannot update tenant B"

cross_delete="$(run_as_b "DELETE FROM proxima_test.records WHERE tenant_id='tenant_a'; SELECT count(*) FROM proxima_test.records WHERE tenant_id='tenant_a';")"
assert_eq "0" "$cross_delete" "tenant B cannot delete tenant A"

transaction_state="$(run_as_a "BEGIN; INSERT INTO proxima_test.records (tenant_id, secret) VALUES ('tenant_a', 'temporary'); ROLLBACK; SELECT count(*) FROM proxima_test.records WHERE secret='temporary';")"
assert_eq "0" "$transaction_state" "tenant transaction rollback leaves no tenant state behind"

set +e
role_error="$(run_as_a "SET ROLE proxima_tenant_b;" 2>&1)"
role_status=$?
set -e
if [[ "$role_status" -eq 0 ]]; then
  echo "FAIL: tenant A can switch into tenant B" >&2
  exit 1
fi
if [[ "$role_error" != *"permission denied to set role"* ]]; then
  echo "FAIL: tenant A role-switch attempt failed for an unexpected reason: $role_error" >&2
  exit 1
fi
echo "PASS: tenant A cannot switch into tenant B"

echo "PostgreSQL RLS isolation verification: PASS"
