#!/usr/bin/env bash
set -euo pipefail

: "${EXTERNAL_SAAS_URL:=http://127.0.0.1:8788}"
: "${PROXIMA_VERIFY_SIGNING_KEY:=}"
: "${PROXIMA_VERIFY_TENANT_A_PASSWORD:=tenant-a-password}"
: "${PROXIMA_VERIFY_TENANT_B_PASSWORD:=tenant-b-password}"
: "${PROXIMA_VERIFY_TENANT_C_PASSWORD:=tenant-c-password}"

if [[ -z "$PROXIMA_VERIFY_SIGNING_KEY" ]]; then
  echo "Set PROXIMA_VERIFY_SIGNING_KEY before running the reference-app acceptance." >&2
  exit 2
fi

make_token() {
  python3 - "$PROXIMA_VERIFY_SIGNING_KEY" "$1" "$2" <<'PY'
import hashlib, hmac, sys, time
secret=sys.argv[1].encode()
tenant=sys.argv[2]
ttl=int(sys.argv[3])
expires=int(time.time())+ttl
payload=f"v1.{tenant}.{expires}".encode()
print(f"{payload.decode()}.{hmac.new(secret,payload,hashlib.sha256).hexdigest()}")
PY
}

request() {
  local tenant="$1"
  local token="$2"
  shift 2
  curl -fsS -H "X-Proxima-Tenant-Token: $token" "$@"
}

count_records() {
  python3 -c 'import json,sys; print(len(json.load(sys.stdin)["records"]))'
}

TOKEN_A="$(make_token tenant_a 3600)"
TOKEN_B="$(make_token tenant_b 3600)"
TOKEN_C="$(make_token tenant_c 3600)"
EXPIRED="$(make_token tenant_a -60)"

curl -fsS "$EXTERNAL_SAAS_URL/health" >/dev/null
echo "PASS: external SaaS reference is reachable"

A_OWN="$(request tenant_a "$TOKEN_A" "$EXTERNAL_SAAS_URL/records?tenant_id=tenant_a" | count_records)"
B_OWN="$(request tenant_b "$TOKEN_B" "$EXTERNAL_SAAS_URL/records?tenant_id=tenant_b" | count_records)"
C_OWN="$(request tenant_c "$TOKEN_C" "$EXTERNAL_SAAS_URL/records?tenant_id=tenant_c" | count_records)"

[[ "$A_OWN" == "1" ]] || { echo "FAIL: tenant A own record count=$A_OWN" >&2; exit 1; }
[[ "$B_OWN" == "1" ]] || { echo "FAIL: tenant B own record count=$B_OWN" >&2; exit 1; }
[[ "$C_OWN" == "1" ]] || { echo "FAIL: tenant C own record count=$C_OWN" >&2; exit 1; }

echo "PASS: each tenant sees its own record"

A_SEES_B="$(request tenant_a "$TOKEN_A" "$EXTERNAL_SAAS_URL/records?tenant_id=tenant_b" | count_records)"
B_SEES_C="$(request tenant_b "$TOKEN_B" "$EXTERNAL_SAAS_URL/records?tenant_id=tenant_c" | count_records)"
C_SEES_A="$(request tenant_c "$TOKEN_C" "$EXTERNAL_SAAS_URL/records?tenant_id=tenant_a" | count_records)"

[[ "$A_SEES_B" == "0" ]] || { echo "FAIL: tenant A crossed into B" >&2; exit 1; }
[[ "$B_SEES_C" == "0" ]] || { echo "FAIL: tenant B crossed into C" >&2; exit 1; }
[[ "$C_SEES_A" == "0" ]] || { echo "FAIL: tenant C crossed into A" >&2; exit 1; }

echo "PASS: cross-tenant reads are blocked by Proxima"

if curl -sS -o /dev/null -w "%{http_code}" -H "X-Proxima-Tenant-Token: $EXPIRED" "$EXTERNAL_SAAS_URL/records?tenant_id=tenant_a" | grep -q '^401$'; then
  echo "PASS: expired tenant context rejected"
else
  echo "FAIL: expired tenant context was not rejected with HTTP 401" >&2
  exit 1
fi

echo "External SaaS reference application acceptance: PASS"
