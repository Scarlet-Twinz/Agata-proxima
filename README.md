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

The repository includes a real PostgreSQL integration test, independent RLS verification, malformed-frame property tests, connection safety limits, and an adversarial `Proxima Verify` harness. Client-side PostgreSQL TLS is now terminated at Proxima with Rustls when configured, and the upstream database leg can require independent CA + hostname verification. The repository also contains the Proxima operator dashboard, deeper adversarial verification, and a documented Cloud control-plane boundary.

The 25–40 platform layer adds an authenticated, durable control plane with organization membership, tenant inventory, versioned policies, node enrollment, deployment intent, verification evidence, append-only audit events, support requests, OpenAPI documentation, a public product homepage, sign-up/sign-in and a full command center. The control plane is intentionally non-authoritative: an already-running Proxima Engine continues to enforce tenant isolation when the control plane is unavailable.

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
