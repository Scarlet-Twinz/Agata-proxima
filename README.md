# Agata Proxima

Agata Proxima is security infrastructure for multi-tenant applications.

Proxima is built around a simple principle:

> Tenant isolation should be an infrastructure boundary that can be enforced, tested, and audited — not a security assumption repeated throughout application code.

## Architecture

```
Application
    |
    | PostgreSQL connection
    v
+---------------------------+
|      Proxima Engine       |
|                           |
| TLS termination (optional)|
| tenant identity/context   |
| PostgreSQL auth boundary  |
| lifecycle limits          |
| runtime telemetry         |
+-------------+-------------+
              |
              | TLS (optional, verified)
              v
         PostgreSQL
```

The first implementation targets PostgreSQL and is written in Rust with Tokio.

## Product direction

- **Proxima Engine** — self-hosted data plane.
- **Proxima Verify** — adversarial tenant-isolation verification.
- **Proxima Cloud** — hosted control plane for fleets, policies, verification history, audit and operations.

## Current engineering boundary

The engine can terminate PostgreSQL client TLS when explicitly configured and can independently require certificate-verified TLS on the PostgreSQL hop. It verifies tenant context before the normal query stream and maps the verified tenant to a PostgreSQL role.

The runtime also exposes private-loopback telemetry for the command center, enforces connection/session limits, and runs as a non-root container.

The dashboard in `dashboard/` is a real static command center and consumes live engine telemetry. It does not fabricate verification results.

## Verification

Primary gates:

```bash
cargo fmt --all -- --check
cargo check --workspace --all-targets
cargo test --workspace --all-targets
cargo clippy --workspace --all-targets --all-features -- -D warnings
bash tests/postgres/verify_rls.sh
bash -n tools/proxima-verify.sh tools/proxima-verify-3tenant.sh
node --check dashboard/app.js
```

For a configured deployment:

```bash
bash tools/proxima-verify.sh
bash tools/proxima-verify-3tenant.sh
```

The three-tenant script is an acceptance harness for a real SaaS integration; CI does not pretend to be external customer evidence.

See `docs/release-readiness.md` and `docs/external-saas.md`.
