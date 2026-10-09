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

The repository now includes the Proxima Engine, a durable Control Plane, a public React frontend, the Phase 3.22-A–H entitlement enforcement workstreams, Lemon Squeezy billing integration, Microsoft Entra OIDC groundwork, operational runbooks and acceptance gates. Repository CI has passed for the canonical entitlement gates. Live provider activation and production operational acceptance remain separate launch gates.

The current engine establishes a verified tenant context, maps it to a PostgreSQL role, brokers the PostgreSQL authentication/startup exchange, and then enters the normal query stream only after PostgreSQL reports a ready session.

The repository includes a real PostgreSQL integration test, independent RLS verification, malformed-frame property tests, connection safety limits, and an adversarial `Proxima Verify` harness. Client-side PostgreSQL TLS is now terminated at Proxima with Rustls when configured, and the upstream database leg can require independent CA + hostname verification. The repository also contains the Proxima operator dashboard, deeper adversarial verification, and a documented Cloud control-plane boundary.

The 25–40 platform layer adds an authenticated, durable control plane with organization membership, tenant inventory, versioned policies, node enrollment, deployment intent, verification evidence, append-only audit events, support requests, OpenAPI documentation, a public product homepage, sign-up/sign-in and a full command center. The control plane is intentionally non-authoritative: an already-running Proxima Engine continues to enforce tenant isolation when the control plane is unavailable.

## Documentation

- [Practical usage guide](docs/usage.md) — local setup, resources, verification, billing, team access and SSO.
- [Developer/API guide](docs/developer-guide.md) — authenticated API routes and integration contracts.
- [Customer integration guide](docs/customer-integration.md) — connecting an existing SaaS application to Proxima.
- [Security verification](docs/verification.md) — RLS, protocol tests and adversarial verification.
- [Phase 3.22 entitlement contract](docs/billing/phase3-22-entitlement-contract.md) — pricing, quotas and A–H acceptance map.
- [Microsoft Entra SSO runbook](docs/identity/microsoft-entra-oidc.md) — OIDC configuration and remaining activation gates.
- [Production deployment runbook](docs/production/phase55-deployment-runbook.md) — production environment requirements.
- [Deployment architecture](docs/production/deployment-architecture.md) — prepared Vercel frontend, container API, managed PostgreSQL and same-origin routing path.
- [Operational readiness runbook](docs/production/operational-readiness-runbook.md) — health, backups, restore drills, monitoring and incident response.
- [Production smoke workflow](.github/workflows/production-smoke.yml) — scheduled liveness checks and a manual full-readiness gate once the public URL is configured.
- [Remaining launch work map](docs/production/remaining-launch-work-map.md) — Lemon Squeezy Test Mode validation, Microsoft Entra SSO, hosting and production acceptance.
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
