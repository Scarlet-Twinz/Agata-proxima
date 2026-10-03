#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${PROXIMA_CONTROL_URL:-http://127.0.0.1:8080}"
EMAIL="${PROXIMA_SMOKE_EMAIL:-smoke-$(date +%s)@example.test}"
PASSWORD="${PROXIMA_SMOKE_PASSWORD:-SmokeTestPassword-2026!}"
ORG="${PROXIMA_SMOKE_ORG:-Proxima Smoke}"

curl -fsS "${BASE_URL}/healthz" >/dev/null

SIGNUP=$(curl -fsS -c /tmp/proxima-smoke.cookies -H 'content-type: application/json'   -d "{"email":"${EMAIL}","password":"${PASSWORD}","name":"Smoke Operator","organization":"${ORG}"}"   "${BASE_URL}/api/v1/auth/signup")

CSRF=$(python -c 'import json,sys; print(json.load(sys.stdin)["csrf_token"])' <<<"${SIGNUP}")
SESSION=$(curl -fsS -b /tmp/proxima-smoke.cookies "${BASE_URL}/api/v1/session")
echo "${SESSION}" | grep -q '"authenticated":true'

curl -fsS -b /tmp/proxima-smoke.cookies   "${BASE_URL}/api/v1/platform/status" >/dev/null

curl -fsS -b /tmp/proxima-smoke.cookies -H "x-csrf-token: ${CSRF}"   -H 'content-type: application/json'   -d "{"organization_id":"$(python -c 'import json,sys; print(json.load(sys.stdin)["organization_id"])' <<<"${SIGNUP}")","name":"smoke-tenant","slug":"smoke-tenant","isolation_mode":"enforced-proxy"}"   "${BASE_URL}/api/v1/tenants" >/dev/null

echo "Proxima control-plane smoke test: PASS"
