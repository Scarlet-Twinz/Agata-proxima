#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

test -f crates/proxima-control-plane/migrations/0005_customer_lifecycle.sql
test -f frontend/src/pages/console/CustomerIntegration.tsx
 test -f frontend/src/pages/console/ConsoleDocumentation.tsx
test -f packages/proxima-node-sdk/src/index.ts
test -f packages/proxima-node-sdk/src/index.test.ts
test -f control-plane/openapi.json

grep -q '"/api/v1/organization/switch"' crates/proxima-control-plane/src/main.rs
grep -q '"/api/v1/projects"' crates/proxima-control-plane/src/main.rs
grep -q '"/api/v1/projects/{id}/environments"' crates/proxima-control-plane/src/main.rs
grep -q '"/api/v1/integrations"' crates/proxima-control-plane/src/main.rs
grep -q '0005_customer_lifecycle.sql' crates/proxima-control-plane/src/main.rs
grep -q '"/api/v1/projects"' control-plane/openapi.json
grep -q '"/api/v1/integrations"' control-plane/openapi.json
grep -q 'projects' frontend/src/app/router.tsx
grep -q 'integrations' frontend/src/app/router.tsx
grep -q 'proximaDatabaseUrl' packages/proxima-node-sdk/src/index.ts
grep -q 'proxima_csrf' frontend/src/api/client.ts
grep -q 'INSERT INTO environments(project_id,name,slug,kind)' crates/proxima-control-plane/src/main.rs
grep -q 'project_id: Option<Uuid>' crates/proxima-control-plane/src/main.rs
grep -q 'AGATA_EMAIL_LOGO_URL' crates/proxima-control-plane/src/production.rs
grep -q 'https://agataproxima.com/logo.svg' crates/proxima-control-plane/src/production.rs
grep -q 'documentation' frontend/src/pages/console/ConsoleDocumentation.tsx
test "$(grep -c '/api/v1/webhooks/paystack' control-plane/openapi.json)" -eq 0

python -m json.tool control-plane/openapi.json >/dev/null
bash -n tests/launch/phase3a_customer_lifecycle_gate.sh

echo "Phase 3A repository lifecycle gate: PASS"
