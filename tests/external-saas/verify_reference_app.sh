#!/usr/bin/env bash
set -euo pipefail

: "${EXTERNAL_SAAS_URL:=http://127.0.0.1:8788}"
: "${PROXIMA_VERIFY_SIGNING_KEY:=}"

if [[ -z "$PROXIMA_VERIFY_SIGNING_KEY" ]]; then
  echo "Set PROXIMA_VERIFY_SIGNING_KEY before running the reference-app acceptance." >&2
  exit 2
fi

make_token() {
  python3 - "$PROXIMA_VERIFY_SIGNING_KEY" "$1" "$2" <<'PY'
import hashlib, hmac, sys, time
secret = sys.argv[1].encode()
tenant = sys.argv[2]
ttl = int(sys.argv[3])
expires = int(time.time()) + ttl
payload = f"v1.{tenant}.{expires}".encode()
signature = hmac.new(secret, payload, hashlib.sha256).hexdigest()
print(f"{payload.decode()}.{signature}")
PY
}

request() {
  local token="$1"
  shift
  curl -fsS -H "X-Proxima-Tenant-Token: $token" "$@"
}

count_records() {
  python3 -c 'import json,sys; print(len(json.load(sys.stdin)["records"]))'
}

post_record() {
  local token="$1"
  local tenant="$2"
  local payload
  payload="$(printf '{"tenant_id":"%s","payload":{"source":"external-saas-acceptance"}}' "$tenant")"
  curl -fsS     -H "Content-Type: application/json"     -H "X-Proxima-Tenant-Token: $token"     --data "$payload"     "$EXTERNAL_SAAS_URL/records" >/dev/null
}

TOKEN_A="$(make_token tenant_a 3600)"
TOKEN_B="$(make_token tenant_b 3600)"
TOKEN_C="$(make_token tenant_c 3600)"
EXPIRED="$(make_token tenant_a -60)"

curl -fsS "$EXTERNAL_SAAS_URL/health" >/dev/null
echo "PASS: external SaaS reference is reachable"

post_record "$TOKEN_A" tenant_a
post_record "$TOKEN_B" tenant_b
post_record "$TOKEN_C" tenant_c

A_OWN="$(request "$TOKEN_A" "$EXTERNAL_SAAS_URL/records?tenant_id=tenant_a" | count_records)"
B_OWN="$(request "$TOKEN_B" "$EXTERNAL_SAAS_URL/records?tenant_id=tenant_b" | count_records)"
C_OWN="$(request "$TOKEN_C" "$EXTERNAL_SAAS_URL/records?tenant_id=tenant_c" | count_records)"

[[ "$A_OWN" -ge 1 ]] || { echo "FAIL: tenant A cannot read its own record" >&2; exit 1; }
[[ "$B_OWN" -ge 1 ]] || { echo "FAIL: tenant B cannot read its own record" >&2; exit 1; }
[[ "$C_OWN" -ge 1 ]] || { echo "FAIL: tenant C cannot read its own record" >&2; exit 1; }

echo "PASS: each tenant sees its own record"

A_SEES_B="$(request "$TOKEN_A" "$EXTERNAL_SAAS_URL/records?tenant_id=tenant_b" | count_records)"
B_SEES_C="$(request "$TOKEN_B" "$EXTERNAL_SAAS_URL/records?tenant_id=tenant_c" | count_records)"
C_SEES_A="$(request "$TOKEN_C" "$EXTERNAL_SAAS_URL/records?tenant_id=tenant_a" | count_records)"

[[ "$A_SEES_B" == "0" ]] || { echo "FAIL: tenant A crossed into B" >&2; exit 1; }
[[ "$B_SEES_C" == "0" ]] || { echo "FAIL: tenant B crossed into C" >&2; exit 1; }
[[ "$C_SEES_A" == "0" ]] || { echo "FAIL: tenant C crossed into A" >&2; exit 1; }

echo "PASS: cross-tenant reads are blocked by Proxima"

EXPIRED_STATUS="$(curl -sS -o /dev/null -w "%{http_code}"   -H "X-Proxima-Tenant-Token: $EXPIRED"   "$EXTERNAL_SAAS_URL/records?tenant_id=tenant_a")"

[[ "$EXPIRED_STATUS" == "403" ]] || {
  echo "FAIL: expired tenant context returned HTTP $EXPIRED_STATUS (expected 403)" >&2
  exit 1
}

echo "PASS: expired tenant context rejected"
echo "External SaaS reference application acceptance: PASS"
