# Proxima Architecture

## Core boundary

Proxima sits between an application and PostgreSQL.

```
Application
    |
    | PostgreSQL connection
    v
Proxima Engine
    |
    | controlled database connection
    v
PostgreSQL
```

The first transport layer is intentionally small: accept TCP connections, establish an upstream PostgreSQL connection, and relay bytes asynchronously.

That relay is **not yet a security boundary**.

## Security architecture to build next

The engine will evolve through explicit layers:

1. PostgreSQL frontend/backend protocol framing.
2. Startup and authentication state handling.
3. Connection/session lifecycle tracking.
4. Trusted tenant-context establishment.
5. Policy evaluation.
6. PostgreSQL-native enforcement where appropriate.
7. Isolation verification.
8. Security/audit events.

### Non-negotiable principle

Proxima must never treat an untrusted tenant identifier supplied by a client as authoritative.

The identity model must define:

- who authenticates the tenant context;
- what cryptographic or database guarantees bind that context;
- how context survives transactions and connection reuse;
- what happens when context is missing, invalid, or changed;
- how privileged operations are handled.

## Verification

Security claims will be backed by executable adversarial tests.

A future verification suite will exercise cases including:

- tenant A reading tenant B data;
- tenant A updating tenant B data;
- tenant A deleting tenant B data;
- missing tenant context;
- invalid tenant context;
- connection reuse across tenants;
- prepared statements;
- transaction boundaries;
- rollback behavior;
- administrative connections.

No feature is considered secure merely because a happy-path test passes.
