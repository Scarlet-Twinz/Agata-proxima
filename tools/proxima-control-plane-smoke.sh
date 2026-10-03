#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${PROXIMA_CONTROL_PLANE_URL:-http://127.0.0.1:9090}"
PASSWORD='a-strong-local-test-passphrase'

curl -fsS "$BASE_URL/api/v1/health" | grep -q '"status":"healthy"'
curl -fsS "$BASE_URL/api/v1/overview" | grep -q '"offline_enforcement":true'
curl -fsS "$BASE_URL/api/v1/tenants" | grep -q 'Northstar'
curl -fsS -X POST "$BASE_URL/api/v1/auth/signup" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"smoke@example.invalid\",\"password\":\"$PASSWORD\"}" >/dev/null || true

LOGIN_HEADERS="$(mktemp)"
curl -fsS -D "$LOGIN_HEADERS" -o /tmp/proxima-login.json \
  -X POST "$BASE_URL/api/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"smoke@example.invalid","password":"'"$PASSWORD"'"'}'
grep -qi '^set-cookie:.*proxima_session=' "$LOGIN_HEADERS"

COOKIE="$(grep -i '^set-cookie:' "$LOGIN_HEADERS" | sed -E 's/^[^:]+:[[:space:]]*([^;]+).*/\1/I')"
curl -fsS "$BASE_URL/api/v1/overview" -H "Cookie: $COOKIE" | grep -q '"control_plane":"healthy"'

rm -f "$LOGIN_HEADERS" /tmp/proxima-login.json
echo "Proxima control-plane smoke: PASS"
