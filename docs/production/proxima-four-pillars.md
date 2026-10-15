# Proxima Monitor, Breaker, Attest, and Verify

This runbook describes the four-pillar implementation added to the existing Proxima Engine. It does not replace the Engine's PostgreSQL wire-protocol, tenant-token, TLS, or RLS enforcement paths.

## Monitor

The engine serves Prometheus text exposition at \`/metrics\` and a health probe at \`/healthz\` on a separate listener. The default bind is \`127.0.0.1:9090\`, intentionally loopback-only. Set \`PROXIMA_METRICS_LISTEN_ADDR\` only when the deployment has a firewall or private network boundary around that listener. Do not expose this endpoint publicly.

Counters include accepted/rejected connections, active sessions, failed handshakes, query/Execute messages observed, authenticated tenant sessions, bytes in each direction, cumulative session duration, blocked security violations, and breaker trips. A request-to-completion histogram exposes latency buckets so Prometheus can calculate p50/p95/p99 using `histogram_quantile`, for example `histogram_quantile(0.99, sum by (le) (rate(proxima_engine_query_roundtrip_latency_seconds_bucket[5m])))`. Query observation inspects only PostgreSQL frame headers and forwards original bytes unchanged. It counts simple-query and Execute messages, not SQL statements hidden inside a prepared statement's Parse message.

## Breaker

\`PROXIMA_SECURITY_BREAKER=fail-closed\` is the default. Repeated malformed-protocol or tenant-authentication failures are counted per source IP. The defaults are 5 failures in 60 seconds and a 300-second cooldown. Override with \`PROXIMA_BREAKER_FAILURE_THRESHOLD\`, \`PROXIMA_BREAKER_WINDOW_SECONDS\`, and \`PROXIMA_BREAKER_COOLDOWN_SECONDS\`. The compatibility variable \`PROXIMA_SECURITY_CIRCUIT_BREAKER\` is accepted when the canonical variable is absent. Set \`PROXIMA_SECURITY_BREAKER=off\` only for controlled diagnosis.

The breaker drops new connections from the offending peer; it does not trip a global circuit for every tenant. NAT/shared egress can group multiple clients behind one source IP, so tune thresholds to the deployment. When configured, a breaker trip is sent to the authenticated control-plane security-event endpoint and appended to the organization's audit log. Set \`PROXIMA_SECURITY_EVENT_INGEST_URL\` to an HTTPS URL ending in \`/api/v1/security/events\`, and set \`PROXIMA_SECURITY_EVENT_INGEST_TOKEN\` to a dedicated API key with operator/write permissions. A loopback HTTP URL is accepted for local development only.

## Attest

The engine writes append-only JSON Lines records to \`PROXIMA_ATTESTATION_LEDGER_PATH\` (default \`data/proxima-attestations.jsonl\`). Every record includes a SHA-256 hash chain and HMAC-SHA256 signature. The HMAC signing key must be 32 bytes or longer and must be kept in a secret manager, never in source control. HMAC is symmetric: protect the key on both the engine and control-plane hosts because either side can validate and produce signatures.

Required settings for hourly evidence emission:

- \`PROXIMA_ATTESTATION_SIGNING_KEY\`: high-entropy shared signing secret, 32+ bytes.
- \`PROXIMA_ORGANIZATION_ID\`: the active control-plane organization UUID.
- \`PROXIMA_NODE_ID\`: stable, sanitized node identifier.
- \`PROXIMA_ATTESTATION_P99_OVERHEAD_MS\`: an actual p99 overhead measurement from the reproducible benchmark, not a guessed target.
- \`PROXIMA_ATTESTATION_FORCE_RLS_ACTIVE=true\`: set only after the deployment's PostgreSQL RLS verification has passed.
- \`PROXIMA_ATTESTATION_INGEST_URL\`: HTTPS control-plane endpoint ending in \`/api/v1/attestations\`.
- \`PROXIMA_ATTESTATION_INGEST_TOKEN\`: a dedicated API key with operator/write permissions.

The engine begins emitting after its first full hour of runtime; records describe the most recent hour's observed counter deltas. If the signing key or measured p99 value is absent, signed hourly evidence remains disabled rather than fabricating proof. The TLS flag is true only when client TLS is required and a certificate/key pair is configured. These records are evidence, not a claim of SOC 2, HIPAA, or FedRAMP certification.

Run `cargo run -p proxima-engine --bin proxima-attest-verify` to independently verify the local JSONL chain and signatures. The control plane validates that the canonical payload matches the structured telemetry/security fields, validates the payload hash and HMAC signature, and checks the expected predecessor before inserting a record. The Attest workspace is organization-scoped and can export a PDF representation of an ingested record. Preserve the signed ledger JSONL as the machine-verifiable source; a PDF is a human-readable report, not a replacement for signature verification.

## Verify and adversarial checks

Run the repository CI gates, PostgreSQL RLS verification, and the protocol property tests. In staging, verify at minimum:

1. \`GET http://127.0.0.1:9090/metrics\` returns Prometheus text and the listener is not reachable from public interfaces.
2. Normal PostgreSQL queries still return identical results through Proxima and the query counter increments.
3. Invalid tenant tokens and malformed/oversized protocol frames are rejected; repeated violations trip only the offending peer's cooldown.
4. A breaker trip appears in the control-plane audit stream when event ingestion is configured.
5. Altering a signed ledger line, its canonical payload, its predecessor hash, or its signature causes chain verification to fail.
6. The control plane rejects a mismatched payload, invalid HMAC, wrong predecessor, and cross-organization evidence.
7. The Attest page lists only records belonging to the active organization and its PDF opens as a valid PDF.

## Reproducible benchmark

Use \`scripts/bench/proxima-benchmark.sh\` with a dedicated non-production benchmark database and a test tenant role/token. Run direct PostgreSQL and Proxima with the same \`pgbench\` workload, client count, job count, and duration. Preserve raw outputs and report hardware, PostgreSQL/Rust versions, TLS modes, and actual p50/p95/p99 transaction latency. Do not publish a performance claim or SLA until the result is repeatable.
