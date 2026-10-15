#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

grep -q 'PROXIMA_METRICS_LISTEN_ADDR' README.md
grep -q 'PROXIMA_SECURITY_BREAKER=fail-closed' README.md
grep -q 'pub async fn report_breaker_event' crates/proxima-engine/src/attestation_reporter.rs
grep -q 'copy_client_messages' crates/proxima-engine/src/main.rs
grep -q '"/api/v1/attestations"' crates/proxima-control-plane/src/main.rs
grep -q '"/api/v1/security/events"' crates/proxima-control-plane/src/main.rs
grep -q 'prevent_attestation_mutation' crates/proxima-control-plane/migrations/0023_security_attestations.sql
grep -q 'prevent_security_event_mutation' crates/proxima-control-plane/migrations/0024_security_events.sql
grep -q 'path: "attestations"' frontend/src/app/router.tsx
grep -q 'Download PDF' frontend/src/pages/console/Attestations.tsx
bash -n tests/performance/benchmark-proxy.sh
echo "Monitor/Breaker/Attest repository contract checks passed."
