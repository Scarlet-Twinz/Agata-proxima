#!/usr/bin/env bash
set -euo pipefail
umask 077

BASE_URL="${PROXIMA_CONTROL_URL:-http://127.0.0.1:8080}"
: "${PROXIMA_SMOKE_EMAIL:?Set PROXIMA_SMOKE_EMAIL to an existing verified test account}"
: "${PROXIMA_SMOKE_PASSWORD:?Set PROXIMA_SMOKE_PASSWORD for that test account}"

# Signup requires email verification, so this smoke test uses a pre-verified
# test account instead of assuming a signup response creates an active session.
COOKIE_JAR="$(mktemp)"
trap 'rm -f "$COOKIE_JAR"' EXIT

curl -fsS "${BASE_URL}/healthz" >/dev/null

LOGIN_PAYLOAD="$(python -c 'import json,os; print(json.dumps({"email":os.environ["PROXIMA_SMOKE_EMAIL"],"password":os.environ["PROXIMA_SMOKE_PASSWORD"],"remember_me":False}))')"
LOGIN="$(curl -fsS -c "$COOKIE_JAR" -H 'content-type: application/json' --data "$LOGIN_PAYLOAD" "${BASE_URL}/api/v1/auth/login")"
SESSION="$(curl -fsS -b "$COOKIE_JAR" "${BASE_URL}/api/v1/session")"
python -c 'import json,sys; data=json.load(sys.stdin); assert data.get("authenticated") is True, "session is not authenticated"' <<<"$SESSION"

CSRF="$(python -c 'import json,sys; print(json.load(sys.stdin)["csrf_token"])' <<<"$SESSION")"
ORG_ID="$(python -c 'import json,sys; print(json.load(sys.stdin)["organization_id"])' <<<"$SESSION")"
SLUG="smoke-tenant-$(date +%s)-$$"

curl -fsS -b "$COOKIE_JAR" "${BASE_URL}/api/v1/platform/status" >/dev/null

TENANT_PAYLOAD="$(python -c 'import json,sys; print(json.dumps({"organization_id":sys.argv[1],"name":"Smoke tenant","slug":sys.argv[2],"isolation_mode":"enforced-proxy"}))' "$ORG_ID" "$SLUG")"
curl -fsS -b "$COOKIE_JAR" -H "x-csrf-token: ${CSRF}" -H 'content-type: application/json' --data "$TENANT_PAYLOAD" "${BASE_URL}/api/v1/tenants" >/dev/null

echo "Agata Proxima Control Plane smoke test: PASS"
