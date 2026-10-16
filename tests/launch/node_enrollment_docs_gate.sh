#!/usr/bin/env bash
set -euo pipefail
fail() { echo "FAIL: $1" >&2; exit 1; }
pass() { echo "PASS: $1"; }
test -f docs/node-enrollment.md || fail "node enrollment runbook missing"
grep -Fq 'docs/node-enrollment.md' README.md || fail "README does not link node enrollment"
grep -Fq 'node-enrollment.md' docs/usage.md || fail "usage guide does not link node enrollment"
grep -Fq 'node-enrollment.md' docs/developer-guide.md || fail "developer guide does not link node enrollment"
grep -Fq 'PROXIMA_NODE_ENROLLMENT_ENCRYPTION_KEY' docs/node-enrollment.md || fail "enrollment encryption key docs missing"
grep -Fq 'PROXIMA_NODE_ENROLLMENT_URL' docs/node-enrollment.md || fail "engine enrollment URL docs missing"
grep -Fq 'PROXIMA_NODE_ENROLLMENT_TOKEN' docs/node-enrollment.md || fail "one-time token docs missing"
grep -Fq 'PROXIMA_NODE_IDENTITY_PATH' docs/node-enrollment.md || fail "identity persistence docs missing"
grep -Fq '"/api/v1/nodes/enroll"' control-plane/openapi.json || fail "bootstrap endpoint missing from OpenAPI"
grep -Fq '"/api/v1/nodes/{id}/enrollment-token"' control-plane/openapi.json || fail "token rotation endpoint missing from OpenAPI"
grep -Fq '"/docs/node-enrollment"' frontend/src/app/router.tsx || fail "node enrollment public route missing"
grep -Fq 'to: "/docs/node-enrollment"' frontend/src/pages/public/Docs.tsx || fail "documentation home link missing"
grep -Fq 'import { Nodes } from "../pages/console/Nodes";' frontend/src/app/router.tsx || fail "dedicated node management page not wired into active router"
grep -Fq 'PROXIMA_NODE_ENROLLMENT_ENCRYPTION_KEY' crates/proxima-control-plane/src/main.rs || fail "runtime encryption key missing"
grep -Fq 'PROXIMA_NODE_ENROLLMENT_URL' crates/proxima-engine/src/main.rs || fail "engine bootstrap implementation missing"
python -m json.tool control-plane/openapi.json >/dev/null
python scripts/ops/check-doc-links.py
pass "node enrollment docs, active frontend route, runtime contract, OpenAPI and Markdown links"
