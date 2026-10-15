# Proxima Monitor, Breaker, and Attest Operations

This document describes the runtime contract for the Monitor, Breaker, and Attest modules. It does not replace deployment-specific TLS, PostgreSQL, or tenant-RLS verification.

## Proxima Monitor

The engine exposes Prometheus text format on a separate listener:

- `PROXIMA_METRICS_ENABLED=true` (default)
- `PROXIMA_METRICS_LISTEN_ADDR=127.0.0.1:9090` (default)

Scrape `GET /metrics`; `GET /health` returns a simple health response. The listener is intentionally loopback-bound by default. If Prometheus runs on another host or container, set a reachable private address and restrict it with network policy/firewall rules. Do not expose this endpoint to the public internet.

Metrics currently include active/accepted/rejected/completed/failed connections, proxied byte totals, PostgreSQL simple Query/Execute messages successfully forwarded upstream (stored in the compatibility field `total_processed_queries`), authenticated tenant sessions, unauthorized violations, breaker trip events/state, and a Prometheus histogram for end-to-end simple Query round-trip latency through `ReadyForQuery`. Extended-protocol Execute messages are counted but are not currently included in that latency histogram. The latency-overhead field in attestations remains unknown unless measured; do not interpret an unknown value as zero. Performance/SLA claims must come from the repeatable direct-versus-proxy benchmark in [performance.md](../performance.md).

## Proxima Breaker

- `PROXIMA_SECURITY_BREAKER=fail-closed` (default; compatibility alias: `PROXIMA_SECURITY_CIRCUIT_BREAKER`)
- `PROXIMA_SECURITY_BREAKER_THRESHOLD=5`
- `PROXIMA_SECURITY_BREAKER_WINDOW_SECS=60`
- `PROXIMA_SECURITY_BREAKER_BLOCK_SECS=60`
- `PROXIMA_MAX_FRONTEND_FRAME_BYTES=67108864` (64 MiB default)
- `PROXIMA_MAX_BACKEND_FRAME_BYTES=67108864` (64 MiB default; independently bounds backend response frames)

The breaker temporarily blocks the source IP after repeated malformed/oversized PostgreSQL frontend frames or unauthorized handshakes. It is scoped to that peer rather than globally disabling unrelated tenants. State is in-memory and bounded; a process restart clears temporary blocks. Put upstream rate limiting and network-level DDoS controls in front of the engine for distributed attacks. Malformed traffic is rejected before the offending frame is forwarded.

When reporting is configured, opening a breaker generates an append-only critical security event at `POST /api/v1/security/events`. If the control plane is unavailable, the engine still blocks locally and logs delivery failure; remote notification is not a prerequisite for enforcement.

## Proxima Attest

Configure the complete reporting contract on each reporting engine node:

- `PROXIMA_CONTROL_PLANE_URL`: control-plane base URL; HTTPS is required except localhost development.
- `PROXIMA_CONTROL_PLANE_API_KEY`: valid organization-scoped Proxima API key.
- `PROXIMA_ORGANIZATION_ID`: canonical organization UUID associated with that API key.
- `PROXIMA_NODE_ID`: stable identifier for this engine node (1–200 characters).
- `PROXIMA_ATTESTATION_SIGNING_KEY_ID`: key identifier shared with the control plane.
- `PROXIMA_ATTESTATION_SIGNING_KEY`: active secret with at least 32 bytes, provisioned out of band and identical on the reporting node and control plane.
- `PROXIMA_ATTESTATION_SIGNING_KEYS_JSON` (control plane, optional): JSON object mapping retained historical key IDs to their signing secrets, so old blocks remain verifiable after rotation. Keep old keys only as long as retention policy requires and protect this setting as a secret.
- `PROXIMA_ATTEST_FORCE_RLS_ACTIVE`: explicit operator assertion that RLS/tenant enforcement has been verified for this deployment.
- `PROXIMA_METRICS_ENABLED` and TLS settings as appropriate for the deployment.

Do not put real secrets in source control, frontend variables, logs, issue reports, or PDF reports. For rotation, deploy the new active key ID/secret to nodes and the control plane, and retain previous key IDs in `PROXIMA_ATTESTATION_SIGNING_KEYS_JSON` until their evidence expires under retention policy.

The engine attempts to submit one signed telemetry epoch per hour to `POST /api/v1/attestations`. Each block includes a SHA-256 hash chained to the previous block and an HMAC-SHA256 signature over that hash. The control plane recomputes the block hash, verifies the signature, checks the expected predecessor under a transaction lock, and stores the record in append-only PostgreSQL tables. The attestation ledger and security-event ledger reject updates/deletes.

The Console's **Attestations** page reads only the current authenticated workspace and can export the returned evidence to a multi-page PDF. It also exports the signed JSON evidence bundle for independent verification with `cargo run -p proxima-engine --bin proxima-attest-verify -- evidence.json` after configuring the appropriate active or retained verification key in the environment. The report explicitly labels invalid signatures and missing/truncated chain history. It cannot manufacture evidence if no node has submitted it. The API returns the latest 500 blocks plus the latest block for every node, so reporters can always find each node's current chain head even in large workspaces. The export remains a recent-evidence report, not a complete archival export for arbitrarily long retention periods.

### Trust boundaries and limitations

- HMAC is a shared-secret signature: both the engine and control plane can sign. It is not a public-key signature and does not provide independent third-party verification without sharing signing authority.
- The RLS field is an operator assertion; the attestation does not itself inspect every PostgreSQL table/policy. Run the independent RLS and real-proxy verification gates.
- TLS status reflects the configured client-TLS enforcement setting; it is not a certificate audit.
- A missing p99 latency-overhead measurement is stored as unknown, never as zero.
- Evidence supports auditability but does not itself certify SOC 2, HIPAA, FedRAMP, or any other compliance framework.

## Release verification

Run from the repository root:

```bash
cargo fmt --all -- --check
cargo check --workspace --all-targets --locked
cargo test --workspace --all-targets --locked
cargo clippy --workspace --all-targets --all-features --locked -- -D warnings
bash tests/postgres/verify_rls.sh
bash tests/performance/benchmark-proxy.sh
```

The benchmark requires preconfigured direct and proxied database URLs and a pre-initialized pgbench database. Do not publish its results until repeated runs on controlled hardware are recorded. The deployment acceptance process must also verify Prometheus scraping, valid and invalid attestation submissions, chain-tamper rejection, breaker trip/expiry behavior, critical-event delivery, workspace isolation, and PDF rendering in a real browser.
