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


## Implemented foundation

The current engine includes:

- typed environment configuration;
- PostgreSQL startup-packet recognition;
- SSLRequest and CancelRequest recognition;
- frontend message framing with length validation;
- protocol frame size limits;
- protocol unit tests;
- protocol-aware startup/session establishment;
- asynchronous TCP forwarding after startup negotiation.

The engine currently preserves an end-to-end TLS stream after PostgreSQL SSL negotiation. It does not claim to inspect encrypted PostgreSQL traffic. TLS termination and the resulting trust model are a separate security design decision.

## Next enforcement boundary

The next implementation boundary is not arbitrary SQL rewriting. It is the establishment of a trusted tenant context and a PostgreSQL-native enforcement strategy that remains correct across:

- authentication;
- connection reuse;
- transactions;
- prepared statements;
- resets;
- privileged operations.

Only after that boundary is implemented and tested should Proxima advertise tenant isolation enforcement.

## Trusted tenant context

Proxima now contains a cryptographic tenant-context primitive. The engine can verify a compact
versioned token using an HMAC-SHA256 signing key before a tenant identity is admitted into the
security context.

The current token shape is:

```
v1.<tenant_id>.<expires_at_unix_seconds>.<hex_hmac_sha256>
```

The verifier requires a minimum 32-byte signing secret, rejects malformed or expired tokens, limits
tenant identifiers to a conservative character set, and compares signatures without early-exit
byte comparison.

This token is an **identity assertion from the trusted application boundary**, not proof that a
database client is trustworthy by itself. The application that holds the signing secret is therefore
part of the Proxima trust model. A tenant token must never be accepted merely because a client
supplied a tenant ID.

The next integration step is to bind a verified context to the PostgreSQL session in a way that the
database itself enforces. The implementation will prefer PostgreSQL-native authorization/RLS
mechanisms over SQL text rewriting. Connection reuse, prepared statements, transaction boundaries,
role changes, and administrative paths must remain covered by adversarial tests.
