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

The current code establishes the asynchronous TCP foundation. PostgreSQL protocol handling, trusted tenant-context establishment, policy enforcement, and verification are developed on top of this foundation.

## License

MIT
