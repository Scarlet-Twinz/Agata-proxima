#!/usr/bin/env bash
set -euo pipefail
: "${AGATA_API_BASE_URL:?Set AGATA_API_BASE_URL to your control-plane origin}"
: "${AGATA_API_KEY:?Load AGATA_API_KEY from a secret manager}"
case "$AGATA_API_KEY" in aga_*) ;; *) echo 'AGATA_API_KEY must begin with aga_' >&2; exit 2;; esac
base="${AGATA_API_BASE_URL%/}"
curl --fail --silent --show-error -H "Authorization: Bearer $AGATA_API_KEY" -H 'Accept: application/json' "$base/api/v1/health"
printf '\nPlan catalogue:\n'
curl --fail --silent --show-error -H "Authorization: Bearer $AGATA_API_KEY" -H 'Accept: application/json' "$base/api/v1/billing/plans"
printf '\nOrganization tenants:\n'
curl --fail --silent --show-error -H "Authorization: Bearer $AGATA_API_KEY" -H 'Accept: application/json' "$base/api/v1/tenants"
printf '\n'
