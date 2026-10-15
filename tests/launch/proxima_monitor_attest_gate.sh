#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

grep -q 'PROXIMA_METRICS_LISTEN_ADDR' README.md
grep -q 'PROXIMA_SECURITY_BREAKER=fail-closed' README.md
grep -q 'pub async fn report_breaker_event' crates/proxima-engine/src/attestation_reporter.rs
grep -q 'copy_client_messages' crates/proxima-engine/src/main.rs
grep -q 'observe_simple_query_latency' crates/proxima-engine/src/monitor.rs
grep -q 'copy_backend_messages' crates/proxima-engine/src/main.rs
grep -q '"/api/v1/attestations"' crates/proxima-control-plane/src/main.rs
grep -q '"/api/v1/security/events"' crates/proxima-control-plane/src/main.rs
grep -q 'prevent_attestation_mutation' crates/proxima-control-plane/migrations/0023_security_attestations.sql
grep -q 'prevent_security_event_mutation' crates/proxima-control-plane/migrations/0024_security_events.sql
grep -q 'path: "attestations"' frontend/src/app/router.tsx
grep -q 'Download PDF' frontend/src/pages/console/Attestations.tsx
bash -n tests/performance/benchmark-proxy.sh
tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT
printf '1,1,1000,0,1700000000\n1,2,2000,0,1700000001\n1,3,3000,0,1700000002\n' >"$tmpdir/direct.123"
python3 scripts/ops/summarize-pgbench.py "$tmpdir" direct 10 | grep -q 'p50_ms=2.000'
echo "Monitor/Breaker/Attest repository contract checks passed."
