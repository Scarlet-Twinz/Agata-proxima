#!/usr/bin/env bash
set -euo pipefail

: "${PROXIMA_VERIFY_HOST:=127.0.0.1}"
: "${PROXIMA_VERIFY_PORT:=6432}"
: "${PROXIMA_VERIFY_DATABASE:=proxima_dev}"
: "${PROXIMA_VERIFY_USER:=proxima}"
: "${PROXIMA_VERIFY_TABLE:=proxima_test.records}"
: "${PROXIMA_VERIFY_TENANT_COLUMN:=tenant_id}"
: "${PROXIMA_VERIFY_SIGNING_KEY:=}"
: "${PROXIMA_VERIFY_TENANT_A_PASSWORD:=}"
: "${PROXIMA_VERIFY_TENANT_B_PASSWORD:=}"
: "${PROXIMA_VERIFY_TENANT_C_PASSWORD:=}"

for v in PROXIMA_VERIFY_SIGNING_KEY PROXIMA_VERIFY_TENANT_A_PASSWORD PROXIMA_VERIFY_TENANT_B_PASSWORD PROXIMA_VERIFY_TENANT_C_PASSWORD; do
  [[ -n "${!v}" ]] || { echo "Missing $v" >&2; exit 2; }
done

make_token() {
  python3 - "$PROXIMA_VERIFY_SIGNING_KEY" "$1" <<'PY'
import hashlib,hmac,sys,time
secret=sys.argv[1].encode(); tenant=sys.argv[2]; exp=int(time.time())+900
payload=f"v1.{tenant}.{exp}".encode()
print(f"{payload.decode()}.{hmac.new(secret,payload,hashlib.sha256).hexdigest()}")
PY
}

query() {
  local tenant="$1" password="$2" sql="$3" token
  token="$(make_token "$tenant")"
  PGHOST="$PROXIMA_VERIFY_HOST" PGPORT="$PROXIMA_VERIFY_PORT" PGUSER="$PROXIMA_VERIFY_USER" PGDATABASE="$PROXIMA_VERIFY_DATABASE" PGPASSWORD="$password" PGOPTIONS="-c proxima_tenant_token=$token" psql -v ON_ERROR_STOP=1 -Atqc "$sql"
}

assert_zero() {
  [[ "$1" == "0" ]] || { echo "FAIL: $2 (got $1)" >&2; exit 1; }
  echo "PASS: $2"
}

for pair in "tenant_a:$PROXIMA_VERIFY_TENANT_A_PASSWORD:tenant_b" "tenant_b:$PROXIMA_VERIFY_TENANT_B_PASSWORD:tenant_c" "tenant_c:$PROXIMA_VERIFY_TENANT_C_PASSWORD:tenant_a"; do
  IFS=: read -r tenant password target <<<"$pair"
  assert_zero "$(query "$tenant" "$password" "SELECT count(*) FROM $PROXIMA_VERIFY_TABLE WHERE $PROXIMA_VERIFY_TENANT_COLUMN = '$target';")" "$tenant cannot read $target"
done

echo "Proxima three-tenant acceptance matrix: PASS"
