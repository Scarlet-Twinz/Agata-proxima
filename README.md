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

The repository includes a real PostgreSQL integration test, independent RLS verification, malformed-frame property tests, connection safety limits, and an adversarial `Proxima Verify` harness. End-to-end TLS is fail-closed while enforcement is enabled until a dedicated TLS termination and upstream-trust model is implemented.

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
