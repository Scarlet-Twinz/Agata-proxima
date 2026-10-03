#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${PROXIMA_CONTROL_PLANE_URL:-http://127.0.0.1:9090}"
PASSWORD='a-strong-local-test-passphrase'
COOKIE_JAR="$(mktemp)"

cleanup() {
  rm -f "$COOKIE_JAR"
}
trap cleanup EXIT

curl -fsS "$BASE_URL/api/v1/health" | grep -q '"status":"healthy"'
curl -fsS "$BASE_URL/api/v1/overview" | grep -q '"offline_enforcement":true'
curl -fsS "$BASE_URL/api/v1/tenants" | grep -q 'Northstar'

BODY="{\"email\":\"smoke@example.invalid\",\"password\":\"$PASSWORD\"}"
curl -fsS -X POST "$BASE_URL/api/v1/auth/signup"   -H 'Content-Type: application/json'   -d "$BODY" >/dev/null || true

curl -fsS -c "$COOKIE_JAR" -X POST "$BASE_URL/api/v1/auth/login"   -H 'Content-Type: application/json'   -d "$BODY" >/dev/null

curl -fsS -b "$COOKIE_JAR" "$BASE_URL/api/v1/auth/me" | grep -q 'smoke@example.invalid'
curl -fsS -b "$COOKIE_JAR" "$BASE_URL/api/v1/overview" | grep -q '"control_plane":"healthy"'

echo "Proxima control-plane smoke: PASS"
