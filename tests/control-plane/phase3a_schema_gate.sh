#!/usr/bin/env bash
set -euo pipefail

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

for table in "${required_tables[@]}"; do
  psql -v ON_ERROR_STOP=1 -tAc "SELECT to_regclass('public.${table}')" | grep -qx "public.${table}"
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
  "database_connections|password_ciphertext"
)

for pair in "${required_columns[@]}"; do
  table="${pair%%|*}"
  column="${pair#*|}"
  psql -v ON_ERROR_STOP=1 -tAc "SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='${table}' AND column_name='${column}'" | grep -qx "1"
done

# The customer database password must be encrypted storage, not plaintext storage.
psql -v ON_ERROR_STOP=1 -tAc "SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='database_connections' AND column_name='password_ciphertext'" | grep -qx "bytea"
if psql -v ON_ERROR_STOP=1 -tAc "SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='database_connections' AND column_name='password'" | grep -q 1; then
  echo "plaintext database_connections.password column exists" >&2
  exit 1
fi

echo "Phase 3A schema contract: PASS"
