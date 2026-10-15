#!/usr/bin/env bash
set -euo pipefail

test -f crates/proxima-engine/src/metrics.rs
test -f crates/proxima-engine/src/security_breaker.rs
test -f crates/proxima-engine/src/attestation.rs
test -f crates/proxima-engine/src/bin/proxima-attest-verify.rs
test -f crates/proxima-control-plane/migrations/0023_proxima_attestations.sql
grep -q 'PROXIMA_METRICS_LISTEN_ADDR' crates/proxima-engine/src/main.rs
grep -q 'PROXIMA_SECURITY_BREAKER' crates/proxima-engine/src/security_breaker.rs
grep -q 'PROXIMA_ATTESTATION_P99_OVERHEAD_MS' crates/proxima-engine/src/main.rs
grep -q 'get(attestations).post(create_attestation)' crates/proxima-control-plane/src/main.rs
grep -q 'post(ingest_security_event)' crates/proxima-control-plane/src/main.rs
grep -q 'canonical_expected != input.canonical_payload' crates/proxima-control-plane/src/main.rs
grep -q 'path: "attestations"' frontend/src/app/router.tsx
grep -q 'href: "/app/attestations"' frontend/src/layouts/console/ConsoleLayout.tsx
grep -q 'application/pdf' frontend/src/pages/console/Attestations.tsx
python -m json.tool control-plane/openapi.json >/dev/null
echo "PASS: Proxima Monitor, Breaker, Attest, and PDF workspace contracts are present"
