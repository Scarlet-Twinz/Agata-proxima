# Agata Proxima

Agata Proxima is security infrastructure for multi-tenant applications.

The core idea is simple:

> Tenant isolation should be an infrastructure boundary that can be enforced, tested, and audited — not a security assumption repeated throughout application code.

## Architecture

```
Application
     |
     | TLS (optional, required for verified upstream TLS)
     v
+-------------------------+
|     Proxima Engine      |
|                         |
| tenant identity         |
| PostgreSQL auth boundary|
| connection lifecycle    |
| TLS termination         |
| verification            |
| operational telemetry   |
+------------+------------+
             |
             | TLS (verify-full) or plaintext
             v
        PostgreSQL
```

The first implementation targets PostgreSQL and is written in Rust with Tokio.

## Product surface

- **Proxima Engine** — self-hosted data plane.
- **Proxima Verify** — adversarial tenant-isolation verification.
- **Proxima Dashboard** — local operational view at the admin address.
- **Proxima Cloud** — future hosted control plane for policy, fleet, audit and verification history.

## What is implemented

- signed tenant-context verification;
- tenant-specific PostgreSQL role routing;
- PostgreSQL authentication brokering;
- bounded PostgreSQL protocol framing;
- one upstream PostgreSQL session per client connection;
- connection limits and upstream connect timeouts;
- client-side PostgreSQL TLS termination with rustls;
- upstream PostgreSQL TLS with CA and hostname verification;
- TLS handshake timeouts;
- explicit rejection of unsafe mixed plaintext/TLS topology;
- structured runtime counters exposed to the dashboard;
- independent RLS verification;
- real proxy-to-PostgreSQL integration tests;
- malformed-frame property tests;
- adversarial verification scripts;
- non-root, read-only Docker runtime defaults.

## TLS security boundary

When `PROXIMA_TLS_MODE=required`, clients must begin with PostgreSQL's SSLRequest. Proxima returns `S`, terminates TLS, and only then parses the PostgreSQL startup packet. The upstream TLS mode `verify-full` independently verifies PostgreSQL's certificate and hostname.

There is an important authentication limitation: Proxima currently brokers PostgreSQL SCRAM messages rather than owning the password exchange. SCRAM-SHA-256-PLUS binds authentication to the TLS certificate seen by the client. Because Proxima terminates client TLS and creates a separate upstream TLS session, it cannot transparently forward channel-bound SCRAM. Therefore the current TLS-terminating deployment must use `channel_binding=disable`/equivalent client configuration until Proxima owns the authentication exchange. It does not silently downgrade a client that explicitly requires channel binding.

PostgreSQL RLS remains the database-side authorization mechanism. Superusers, BYPASSRLS roles, privileged table owners, and direct database bypass paths remain outside Proxima's tenant-isolation guarantee.

## Dashboard

Run Proxima and open:

```
http://127.0.0.1:9080/
```

The dashboard is intentionally operational rather than decorative. It reports engine health, tenant enforcement, client TLS, upstream TLS, active connections, rejected connections, TLS session count and uptime. No tenant tokens or secrets are rendered.

## Verification gates

```text
cargo fmt --all -- --check
cargo check --workspace --all-targets
cargo test --workspace --all-targets
cargo clippy --workspace --all-targets --all-features -- -D warnings
bash tests/postgres/verify_rls.sh
```

For a configured deployment:

```bash
bash tools/proxima-verify.sh
```

For the adversarial scenario matrix:

```bash
bash tools/proxima-verify-scenarios.sh
```

See:

- [docs/architecture.md](docs/architecture.md)
- [docs/threat-model.md](docs/threat-model.md)
- [docs/verification.md](docs/verification.md)
- [docs/release-readiness.md](docs/release-readiness.md)
- [docs/phase18-24.md](docs/phase18-24.md)

## License

MIT
