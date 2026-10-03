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

Early infrastructure development.

The current engine establishes a verified tenant context, maps it to a PostgreSQL role, brokers the PostgreSQL authentication/startup exchange, and then enters the normal query stream only after PostgreSQL reports a ready session.

The repository includes a real PostgreSQL integration test, independent RLS verification, malformed-frame property tests, connection safety limits, and an adversarial `Proxima Verify` harness. Client-side PostgreSQL TLS is now terminated at Proxima with Rustls when configured, and the upstream database leg can require independent CA + hostname verification. The repository also contains the first Proxima operator dashboard, deeper adversarial verification, and a documented Cloud control-plane boundary.

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


## Proxima platform surface

The repository now contains the product-facing platform surface:

- /home — public product homepage
- /login — authenticated session entry
- /signup — account creation
- /app — Proxima Cloud console
- /docs — architecture and deployment model
- /pricing — packaging surface
- /support — customer/security support surface

The console talks to the control-plane API at 127.0.0.1:9090. Run the two development processes separately:

    cargo run -p proxima-control-plane
    cargo run -p proxima-engine

Then open http://127.0.0.1:9080/home for the public platform and http://127.0.0.1:9080/app for the console.

For a complete container topology:

    docker compose up --build

The control plane persists development state to its configured state file. Production deployments should use the PostgreSQL schema under control-plane/migrations/001_control_plane.sql, external identity, durable session storage, TLS and managed secrets.

## Platform security invariant

Proxima Cloud is a management plane, not the authorization engine for every database query. The Proxima Engine remains the local enforcement point. Losing the control plane must not silently disable an already-running tenant boundary.

See docs/phase25-40-platform.md, docs/failure-engineering.md, docs/performance.md, and docs/production-deployment.md.
