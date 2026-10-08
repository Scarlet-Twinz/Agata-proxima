#!/usr/bin/env bash
set -euo pipefail

assert_sql() {
  local label="$1"
  local sql="$2"
  local expected="$3"
  local actual
  actual="$(psql -v ON_ERROR_STOP=1 -Atqc "$sql")"
  if [[ "$actual" != "$expected" ]]; then
    echo "FAIL: $label (expected=$expected actual=$actual)" >&2
    exit 1
  fi
  echo "PASS: $label"
}

required_tables=(
  integrations
  integration_credentials
  environments
  database_connections
  environment_integration_credentials
  tenant_policy_bindings
  tenant_context_issuances
  migration_runs
  migration_tenant_maps
)

for table in "\${required_tables[@]}"; do
  assert_sql "table \${table}" "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='\${table}')" "t"
done

required_columns=(
  "tenants|organization_id"
  "tenants|disabled_at"
  "audit_events|correlation_id"
  "audit_events|tenant_id"
  "audit_events|integration_id"
  "audit_events|environment_id"
  "audit_events|policy_id"
  "audit_events|decision"
  "audit_events|verification_result"
  "audit_events|failure_reason"
  "audit_events|previous_hash"
  "audit_events|event_hash"
  "database_connections|password_ciphertext"
)

for pair in "\${required_columns[@]}"; do
  table="\${pair%%|*}"
  column="\${pair#*|}"
  assert_sql "column \${table}.\${column}" "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='\${table}' AND column_name='\${column}')" "t"
done

assert_sql "database password uses bytea ciphertext" "SELECT data_type='bytea' FROM information_schema.columns WHERE table_schema='public' AND table_name='database_connections' AND column_name='password_ciphertext'" "t"
assert_sql "database password plaintext column absent" "SELECT NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='database_connections' AND column_name='password')" "t"

echo "Phase 3A schema contract: PASS"
