#!/usr/bin/env bash
set -euo pipefail

: "${PROXIMA_VERIFY_HOST:=127.0.0.1}"
: "${PROXIMA_VERIFY_PORT:=6432}"
: "${PROXIMA_VERIFY_DATABASE:=proxima_dev}"
: "${PROXIMA_VERIFY_USER:=proxima}"
: "${PROXIMA_VERIFY_SIGNING_KEY:=}"
: "${PROXIMA_VERIFY_TENANT_A_PASSWORD:=tenant-a-password}"
: "${PROXIMA_VERIFY_TENANT_B_PASSWORD:=tenant-b-password}"
: "${PROXIMA_VERIFY_TENANT_C_PASSWORD:=tenant-c-password}"

if [[ -z "$PROXIMA_VERIFY_SIGNING_KEY" ]]; then
  echo "Set PROXIMA_VERIFY_SIGNING_KEY and tenant credentials." >&2
  exit 2
fi

make_token() {
  python3 - "$PROXIMA_VERIFY_SIGNING_KEY" "$1" <<'PY'
import hashlib, hmac, sys, time
secret=sys.argv[1].encode()
tenant=sys.argv[2]
expires=int(time.time())+3600
payload=f"v1.{tenant}.{expires}".encode()
print(f"{payload.decode()}.{hmac.new(secret,payload,hashlib.sha256).hexdigest()}")
PY
}

run_as() {
  local tenant="$1"; shift
  local token
  token="$(make_token "$tenant")"
  local password_var="PROXIMA_VERIFY_TENANT_${tenant^^}_PASSWORD"
  local password="${!password_var}"
  PGPASSWORD="$password" PGHOST="$PROXIMA_VERIFY_HOST" PGPORT="$PROXIMA_VERIFY_PORT" PGUSER="$PROXIMA_VERIFY_USER" PGDATABASE="$PROXIMA_VERIFY_DATABASE" PGOPTIONS="-c proxima_tenant_token=$token" psql -v ON_ERROR_STOP=1 -Atqc "$1"
}

assert_zero() {
  local label="$1"; local actual="$2"
  [[ "$actual" == "0" ]] || { echo "FAIL: $label -> $actual" >&2; exit 1; }
  echo "PASS: $label"
}

assert_one() {
  local label="$1"; local actual="$2"
  [[ "$actual" == "1" ]] || { echo "FAIL: $label -> $actual" >&2; exit 1; }
  echo "PASS: $label"
}

assert_one "tenant A sees one own row" "$(run_as tenant_a "SELECT count(*) FROM proxima_test.records WHERE tenant_id='tenant_a';")"
assert_one "tenant B sees one own row" "$(run_as tenant_b "SELECT count(*) FROM proxima_test.records WHERE tenant_id='tenant_b';")"
assert_one "tenant C sees one own row" "$(run_as tenant_c "SELECT count(*) FROM proxima_test.records WHERE tenant_id='tenant_c';")"
assert_zero "A cannot read B" "$(run_as tenant_a "SELECT count(*) FROM proxima_test.records WHERE tenant_id='tenant_b';")"
assert_zero "B cannot read C" "$(run_as tenant_b "SELECT count(*) FROM proxima_test.records WHERE tenant_id='tenant_c';")"
assert_zero "C cannot read A" "$(run_as tenant_c "SELECT count(*) FROM proxima_test.records WHERE tenant_id='tenant_a';")"
assert_zero "A prepared statement cannot read B" "$(run_as tenant_a "PREPARE q(text) AS SELECT count(*) FROM proxima_test.records WHERE tenant_id=\$1; EXECUTE q('tenant_b');")"

echo "External SaaS three-tenant acceptance harness: PASS"
