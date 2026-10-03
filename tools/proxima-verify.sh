#!/usr/bin/env bash
set -euo pipefail

: "${PROXIMA_VERIFY_HOST:=127.0.0.1}"
: "${PROXIMA_VERIFY_PORT:=6432}"
: "${PROXIMA_VERIFY_DATABASE:=proxima_dev}"
: "${PROXIMA_VERIFY_USER:=proxima}"
: "${PROXIMA_VERIFY_TABLE:=proxima_test.records}"
: "${PROXIMA_VERIFY_TENANT_COLUMN:=tenant_id}"
: "${PROXIMA_VERIFY_TENANT_A:=tenant_a}"
: "${PROXIMA_VERIFY_TENANT_B:=tenant_b}"
: "${PROXIMA_VERIFY_TENANT_A_PASSWORD:=}"
: "${PROXIMA_VERIFY_TENANT_B_PASSWORD:=}"
: "${PROXIMA_VERIFY_SIGNING_KEY:=}"
: "${PROXIMA_VERIFY_TLS:=0}"

if [[ -z "$PROXIMA_VERIFY_TENANT_A_PASSWORD" || -z "$PROXIMA_VERIFY_TENANT_B_PASSWORD" || -z "$PROXIMA_VERIFY_SIGNING_KEY" ]]; then
  echo "Set tenant passwords and PROXIMA_VERIFY_SIGNING_KEY before running Proxima Verify." >&2
  exit 2
fi

if [[ ! "$PROXIMA_VERIFY_TABLE" =~ ^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)?$ ]]; then
  echo "Invalid PROXIMA_VERIFY_TABLE identifier." >&2
  exit 2
fi
if [[ ! "$PROXIMA_VERIFY_TENANT_COLUMN" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
  echo "Invalid PROXIMA_VERIFY_TENANT_COLUMN identifier." >&2
  exit 2
fi

make_token() {
  local tenant="$1"
  python3 - "$PROXIMA_VERIFY_SIGNING_KEY" "$tenant" <<'PY'
import hashlib
import hmac
import sys
import time

secret = sys.argv[1].encode()
tenant = sys.argv[2]
expires = int(time.time()) + 3600
payload = f"v1.{tenant}.{expires}".encode()
signature = hmac.new(secret, payload, hashlib.sha256).hexdigest()
print(f"{payload.decode()}.{signature}")
PY
}

psql_proxima() {
  local tenant="$1"
  local password="$2"
  local token
  token="$(make_token "$tenant")"
  PGHOST="$PROXIMA_VERIFY_HOST"   PGPORT="$PROXIMA_VERIFY_PORT"   PGUSER="$PROXIMA_VERIFY_USER"   PGDATABASE="$PROXIMA_VERIFY_DATABASE"   PGPASSWORD="$password"   PGOPTIONS="-c proxima_tenant_token=$token" PGCHANNELBINDING="${PGCHANNELBINDING:-disable}" PGSSLMODE="${PROXIMA_VERIFY_TLS:+require}" psql -v ON_ERROR_STOP=1 -Atqc "$3"
}

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

a_visible="$(psql_proxima "$PROXIMA_VERIFY_TENANT_A" "$PROXIMA_VERIFY_TENANT_A_PASSWORD" "SELECT count(*) FROM $PROXIMA_VERIFY_TABLE WHERE $PROXIMA_VERIFY_TENANT_COLUMN = '$PROXIMA_VERIFY_TENANT_A';")"
assert_eq "1" "$a_visible" "tenant A sees its own rows"

a_cross="$(psql_proxima "$PROXIMA_VERIFY_TENANT_A" "$PROXIMA_VERIFY_TENANT_A_PASSWORD" "SELECT count(*) FROM $PROXIMA_VERIFY_TABLE WHERE $PROXIMA_VERIFY_TENANT_COLUMN = '$PROXIMA_VERIFY_TENANT_B';")"
assert_eq "0" "$a_cross" "tenant A cannot read tenant B"

b_cross="$(psql_proxima "$PROXIMA_VERIFY_TENANT_B" "$PROXIMA_VERIFY_TENANT_B_PASSWORD" "SELECT count(*) FROM $PROXIMA_VERIFY_TABLE WHERE $PROXIMA_VERIFY_TENANT_COLUMN = '$PROXIMA_VERIFY_TENANT_A';")"
assert_eq "0" "$b_cross" "tenant B cannot read tenant A"

a_prepared="$(psql_proxima "$PROXIMA_VERIFY_TENANT_A" "$PROXIMA_VERIFY_TENANT_A_PASSWORD" "PREPARE proxima_verify(text) AS SELECT count(*) FROM $PROXIMA_VERIFY_TABLE WHERE $PROXIMA_VERIFY_TENANT_COLUMN = \$1; EXECUTE proxima_verify('$PROXIMA_VERIFY_TENANT_B');")"
assert_eq "0" "$a_prepared" "prepared statements cannot cross tenant boundary"

a_update="$(psql_proxima "$PROXIMA_VERIFY_TENANT_A" "$PROXIMA_VERIFY_TENANT_A_PASSWORD" "UPDATE $PROXIMA_VERIFY_TABLE SET $PROXIMA_VERIFY_TENANT_COLUMN = '$PROXIMA_VERIFY_TENANT_B' WHERE $PROXIMA_VERIFY_TENANT_COLUMN = '$PROXIMA_VERIFY_TENANT_B';")"
assert_eq "UPDATE 0" "$a_update" "tenant A cannot update tenant B rows"

b_delete="$(psql_proxima "$PROXIMA_VERIFY_TENANT_B" "$PROXIMA_VERIFY_TENANT_B_PASSWORD" "DELETE FROM $PROXIMA_VERIFY_TABLE WHERE $PROXIMA_VERIFY_TENANT_COLUMN = '$PROXIMA_VERIFY_TENANT_A';")"
assert_eq "DELETE 0" "$b_delete" "tenant B cannot delete tenant A rows"

if [[ "$PROXIMA_VERIFY_TLS" == "1" ]]; then
  echo "PASS: client TLS verification path requested"
  if [[ "${PGSSLMODE:-}" != "require" ]]; then
    echo "FAIL: TLS verification requested but PGSSLMODE was not set" >&2
    exit 1
  fi
fi

echo "Proxima Verify: PASS"
