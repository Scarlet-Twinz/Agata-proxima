#!/usr/bin/env bash
set -euo pipefail

: "${PGHOST:=localhost}"
: "${PGPORT:=5432}"
: "${PGUSER:=proxima}"
: "${PGDATABASE:=proxima_dev}"
: "${PGPASSWORD:=proxima-dev-only}"

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

a_rows="$(psql -Atqc "SET ROLE proxima_tenant_a; SELECT string_agg(secret, ',' ORDER BY secret) FROM proxima_test.records;")"
assert_eq "A-secret" "$a_rows" "tenant A cannot read tenant B"

b_rows="$(psql -Atqc "SET ROLE proxima_tenant_b; SELECT string_agg(secret, ',' ORDER BY secret) FROM proxima_test.records;")"
assert_eq "B-secret" "$b_rows" "tenant B cannot read tenant A"

cross_update="$(psql -Atqc "SET ROLE proxima_tenant_a; UPDATE proxima_test.records SET secret='blocked' WHERE tenant_id='tenant_b'; SELECT count(*) FROM proxima_test.records WHERE secret='blocked';")"
assert_eq "0" "$cross_update" "tenant A cannot update tenant B"

cross_delete="$(psql -Atqc "SET ROLE proxima_tenant_b; DELETE FROM proxima_test.records WHERE tenant_id='tenant_a'; SELECT count(*) FROM proxima_test.records WHERE tenant_id='tenant_a';")"
assert_eq "1" "$cross_delete" "tenant B cannot delete tenant A"

echo "PostgreSQL RLS isolation verification: PASS"
