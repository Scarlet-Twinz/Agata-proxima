#!/usr/bin/env bash
set -euo pipefail

base_url="${AGATA_PUBLIC_BASE_URL:-http://127.0.0.1:8080}"
base_url="${base_url%/}"

command -v curl >/dev/null 2>&1 || {
  echo "FAIL: curl is required" >&2
  exit 2
}

echo "Checking Control Plane liveness: $base_url/api/v1/health"
health="$(curl --fail --silent --show-error --max-time 10 "$base_url/api/v1/health")"
printf '%s\n' "$health"

echo "Checking production configuration readiness: $base_url/api/v1/production/readiness"
readiness="$(curl --fail --silent --show-error --max-time 10 "$base_url/api/v1/production/readiness")"
printf '%s\n' "$readiness"

if ! printf '%s' "$readiness" | grep -Eq '"status"[[:space:]]*:[[:space:]]*"ready"'; then
  echo "NOT READY: one or more production configuration checks are incomplete." >&2
  exit 1
fi

echo "PASS: Control Plane liveness and production readiness checks are ready."
