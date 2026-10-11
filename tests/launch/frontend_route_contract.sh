#!/usr/bin/env bash
set -euo pipefail

router="frontend/src/app/router.tsx"
public_routes=(
  '"/docs"'
  '"/docs/usage"'
  '"/support"'
  '"/support/request"'
  '"/developers"'
)
settings_routes=(
  '"settings/members"'
  '"settings/authentication"'
  '"settings/security"'
  '"settings/api"'
  '"settings/environments"'
  '"settings/notifications"'
  '"settings/danger"'
  '"settings/identity"'
)

for route in "${public_routes[@]}"; do
  grep -Fq "$route" "$router" || { echo "FAIL: missing public route $route"; exit 1; }
done
for route in "${settings_routes[@]}"; do
  grep -Fq "$route" "$router" || { echo "FAIL: missing settings route $route"; exit 1; }
done

# The public router is the active application entry point; the legacy root App.tsx is not used.
grep -Fq 'from "./app/App"' frontend/src/main.tsx
echo "PASS: public documentation/support and workspace settings routes are registered in the active router"
