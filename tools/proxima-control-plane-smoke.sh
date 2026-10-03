#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${PROXIMA_CONTROL_PLANE_URL:-http://127.0.0.1:9090}"
PASSWORD='a-strong-local-test-passphrase'
COOKIE_JAR="$(mktemp)"
HEALTH_BODY="$(mktemp)"
OVERVIEW_BODY="$(mktemp)"
TENANTS_BODY="$(mktemp)"
ME_BODY="$(mktemp)"

cleanup() {
  rm -f "$COOKIE_JAR" "$HEALTH_BODY" "$OVERVIEW_BODY" "$TENANTS_BODY" "$ME_BODY"
}
trap cleanup EXIT

curl -fsS "$BASE_URL/api/v1/health" -o "$HEALTH_BODY"
HEALTH="$(cat "$HEALTH_BODY")"
[[ "$HEALTH" == *'"status":"healthy"'* ]]

curl -fsS "$BASE_URL/api/v1/overview" -o "$OVERVIEW_BODY"
OVERVIEW="$(cat "$OVERVIEW_BODY")"
[[ "$OVERVIEW" == *'"offline_enforcement":true'* ]]

curl -fsS "$BASE_URL/api/v1/tenants" -o "$TENANTS_BODY"
TENANTS="$(cat "$TENANTS_BODY")"
[[ "$TENANTS" == *'Northstar'* ]]

BODY="{\"email\":\"smoke@example.invalid\",\"password\":\"$PASSWORD\"}"
SIGNUP_STATUS="$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$BASE_URL/api/v1/auth/signup" -H 'Content-Type: application/json' -d "$BODY")"
case "$SIGNUP_STATUS" in
  200|409) ;;
  *) echo "unexpected signup status: $SIGNUP_STATUS"; exit 1 ;;
esac

curl -fsS -c "$COOKIE_JAR" -X POST "$BASE_URL/api/v1/auth/login"   -H 'Content-Type: application/json'   -d "$BODY" >/dev/null

curl -fsS -b "$COOKIE_JAR" "$BASE_URL/api/v1/auth/me" -o "$ME_BODY"
ME="$(cat "$ME_BODY")"
[[ "$ME" == *'smoke@example.invalid'* ]]

curl -fsS -b "$COOKIE_JAR" "$BASE_URL/api/v1/overview" -o "$OVERVIEW_BODY"
AUTH_OVERVIEW="$(cat "$OVERVIEW_BODY")"
[[ "$AUTH_OVERVIEW" == *'"control_plane":"healthy"'* ]]

echo "Proxima control-plane smoke: PASS"
