# Agata Proxima

Agata Proxima is security infrastructure for multi-tenant applications.

Proxima is being built around a simple principle:

> Tenant isolation should be an infrastructure boundary that can be enforced, tested, and audited — not a security assumption repeated throughout application code.

## Architecture

```
Application
    |
    v
+----------------------+
|    Proxima Engine    |
|                      |
| connection lifecycle |
| identity/context     |
| policy enforcement   |
| verification        |
| audit                |
+----------+-----------+
           |
           v
      PostgreSQL
```

The first implementation targets PostgreSQL and is written in Rust with Tokio.

## Product direction

- **Proxima Engine** — the self-hosted data-plane component.
- **Proxima Verify** — isolation verification and adversarial security testing.
- **Proxima Cloud** — the hosted control plane for policies, deployments, audit, monitoring, and fleet management.

Security guarantees will be documented against an explicit threat model. Proxima will not claim protection that it cannot demonstrate with tests.

## Status

The repository now includes the Proxima Engine, a durable Control Plane, a public React frontend, the Phase 3.22-A–H entitlement enforcement workstreams, Paddle Billing integration, Microsoft Entra OIDC groundwork, operational runbooks and acceptance gates. Repository CI has passed for the canonical entitlement gates. Live provider activation and production operational acceptance remain separate launch gates.

The current engine establishes a verified tenant context, maps it to a PostgreSQL role, brokers the PostgreSQL authentication/startup exchange, and then enters the normal query stream only after PostgreSQL reports a ready session.

The repository includes a real PostgreSQL integration test, independent RLS verification, malformed-frame property tests, connection safety limits, and an adversarial `Proxima Verify` harness. Client-side PostgreSQL TLS is now terminated at Proxima with Rustls when configured, and the upstream database leg can require independent CA + hostname verification. The repository also contains the Proxima operator dashboard, deeper adversarial verification, and a documented Cloud control-plane boundary.

The 25–40 platform layer adds an authenticated, durable control plane with organization membership, tenant inventory, versioned policies, node enrollment, deployment intent, verification evidence, append-only audit events, support requests, OpenAPI documentation, a public product homepage, sign-up/sign-in and a full command center. The control plane is intentionally non-authoritative: an already-running Proxima Engine continues to enforce tenant isolation when the control plane is unavailable.

## Documentation

- [Practical usage guide](docs/usage.md) — local setup, resources, verification, billing, team access and SSO.
- [Developer/API guide](docs/developer-guide.md) — authenticated API routes and integration contracts.
- [Customer integration guide](docs/customer-integration.md) — connecting an existing SaaS application to Proxima.
- [Security verification](docs/verification.md) — RLS, protocol tests and adversarial verification.
- [Failure engineering](docs/failure-engineering.md) — expected behavior when the Control Plane, PostgreSQL, policies, nodes or TLS fail.
- [Performance engineering](docs/performance.md) — reproducible benchmark dimensions; no unmeasured SLA claims.
- [Monitor/Breaker/Attest operations](docs/production/proxima-monitor-breaker-attest.md) — metrics endpoint, fail-closed protection, signed evidence, PDF exports and release checks.
- [Phase 3.22 entitlement contract](docs/billing/phase3-22-entitlement-contract.md) — pricing, quotas and A–H acceptance map.
- [Microsoft Entra SSO runbook](docs/identity/microsoft-entra-oidc.md) — OIDC configuration and remaining activation gates.
- [Paddle Live billing runbook](docs/production/paddle-billing.md) — Live credentials, price IDs, signed webhooks and activation gates.
- [Production deployment runbook](docs/production/phase55-deployment-runbook.md) — production environment requirements.
- [Deployment architecture](docs/production/deployment-architecture.md) — prepared Vercel frontend, container API, managed PostgreSQL and same-origin routing path.
- [Operational readiness runbook](docs/production/operational-readiness-runbook.md) — health, backups, restore drills, monitoring and incident response.
- [Production smoke workflow](.github/workflows/production-smoke.yml) — scheduled liveness checks and a manual full-readiness gate once the public URL is configured.
- [Remaining launch work map](docs/production/remaining-launch-work-map.md) — Paddle Live acceptance, Microsoft Entra SSO, hosting and production acceptance.
- [Phase 3B checkpoints 3.24–3.40](docs/production/phase3b-3-24-40-acceptance.md) — one status matrix separating repository evidence from live launch blockers.
- [Repository map and branch policy](docs/production/repository-consolidation.md) — canonical `main` workflow, reviewed PRs, preserved legacy branches, and safe cleanup rules.
- [OpenAPI contract](control-plane/openapi.json) — machine-readable Control Plane API.

## License

MIT


## Verification

The primary verification gates are:

```text
cargo fmt --all -- --check
cargo check --workspace --all-targets
cargo test --workspace --all-targets
cargo clippy --workspace --all-targets --all-features -- -D warnings
bash tests/postgres/verify_rls.sh
```

For a configured deployment, run:

```bash
bash tools/proxima-verify.sh
```

See [docs/verification.md](docs/verification.md) for the security verification model and deployment invariants.


## Operator dashboard

When `PROXIMA_DASHBOARD_ENABLED=true`, open `http://127.0.0.1:9080/`.

The dashboard is intentionally a local operator surface. It reports configuration/runtime telemetry and does not invent database health.

## TLS

For PostgreSQL clients using standard SSLRequest negotiation:

- set `PROXIMA_TLS_CERT_FILE` and `PROXIMA_TLS_KEY_FILE`;
- clients can use `sslmode=require`;
- set `PROXIMA_TLS_REQUIRE_CLIENT=true` to reject plaintext;
- set `PROXIMA_UPSTREAM_TLS_MODE=verify-full` with a trusted CA and server name for encrypted database transport.

See `docs/phase18-24-release.md` for the exact security boundary and remaining external acceptance gates.

## Run the platform locally

The Engine remains the default workspace target:

```bash
cargo run
```

The management platform runs separately so the control plane never becomes a dependency of Engine enforcement:

```bash
docker compose up -d control-postgres
cargo run -p proxima-control-plane
```

Then open:

- Engine operator dashboard: `http://127.0.0.1:9080` by default (`PROXIMA_DASHBOARD_LISTEN_ADDR` can change it).
- Proxima Command Center: `http://127.0.0.1:8080` by default (`PROXIMA_CONTROL_BIND` can change it).

On Windows, use `scripts/proxima-platform.ps1` after Docker Desktop and the Rust MSVC toolchain are available.


## Proxima Monitor, Breaker, and Attest

The engine exposes Prometheus text metrics on a separate listener. By default it binds to `127.0.0.1:9090`; set `PROXIMA_METRICS_LISTEN_ADDR` only when the deployment network policy protects that listener. Metrics include active/rejected/completed connections, forwarded client/upstream bytes, PostgreSQL Query/Execute messages, verified tenant sessions, authorization/protocol violations, and peer-breaker trips.

The engine rejects malformed protocol frame lengths and applies separate configurable limits before forwarding (`PROXIMA_MAX_FRONTEND_FRAME_BYTES` and `PROXIMA_MAX_BACKEND_FRAME_BYTES`, each default 64 MiB and configurable from 4 bytes to 1 GiB). Large COPY payloads or large result frames may need a deliberate higher limit. The security breaker defaults to `PROXIMA_SECURITY_BREAKER=fail-closed`. Repeated malformed or unauthorized handshakes are isolated by peer IP using `PROXIMA_SECURITY_BREAKER_THRESHOLD`, `PROXIMA_SECURITY_BREAKER_WINDOW_SECS`, and `PROXIMA_SECURITY_BREAKER_BLOCK_SECS`. This is per-peer protection; it does not intentionally shut down unrelated tenants. Put a trusted proxy/load balancer in the design carefully: source-IP sharing can make peer-scoped isolation affect multiple clients behind one address.

Hourly signed attestation reporting is opt-in and requires the complete configuration: `PROXIMA_CONTROL_PLANE_URL`, `PROXIMA_CONTROL_PLANE_API_KEY`, `PROXIMA_ORGANIZATION_ID`, `PROXIMA_NODE_ID`, `PROXIMA_ATTESTATION_SIGNING_KEY_ID`, `PROXIMA_ATTESTATION_SIGNING_KEY`, and explicit `PROXIMA_ATTEST_FORCE_RLS_ACTIVE`. Use HTTPS except for local development, a dedicated high-entropy secret of at least 32 bytes, and the same signing key/key ID in the trusted control-plane verifier. Never commit production secrets. Configure RLS state only from deployment verification evidence; the engine cannot infer database FORCE RLS state from a proxy connection alone. P99 overhead is recorded as unknown until a defensible measurement is available.

The workspace console's **Attestations** page displays organization-scoped records and exports the displayed evidence as a PDF. The report labels invalid signatures and unknown latency rather than inventing values. Hash chaining and HMAC provide tamper evidence within the configured trust boundary; they do not by themselves establish SOC 2, HIPAA, FedRAMP, or other compliance certification.
