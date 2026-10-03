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

The engine now treats startup and authentication as an explicit protocol boundary. It verifies the signed tenant context before rewriting the upstream PostgreSQL startup user to a tenant-specific database role, then brokers the PostgreSQL authentication exchange until `ReadyForQuery`. Only after successful authentication does it enter the normal bidirectional query stream.

## Trusted tenant context

The tenant assertion is:

```
v1.<tenant_id>.<expires_at_unix_seconds>.<hex_hmac_sha256>
```

The signing secret is at least 32 bytes. Tenant identifiers are restricted to a conservative character set. The resulting role name must also fit PostgreSQL's 63-byte identifier limit.

For libpq-compatible clients, the token may be carried in the startup `options` parameter as:

```
-c proxima_tenant_token=<signed-token>
```

Proxima removes that private option before forwarding the startup packet. A direct `proxima_tenant_token` startup parameter is also accepted.

The application that holds the signing secret remains part of the trust boundary. A client cannot become a tenant merely by choosing a tenant identifier.

## Authentication boundary

PostgreSQL SASL/SCRAM authentication is multi-step. Proxima forwards the authentication messages without terminating the password exchange, while tracking the server authentication state and refusing to enter the normal query relay until PostgreSQL has returned `AuthenticationOk` and `ReadyForQuery`.

This preserves PostgreSQL's authentication mechanism rather than inventing a second password protocol inside the proxy.

## Database enforcement

Tenant roles are ordinary PostgreSQL roles with `NOBYPASSRLS`. Row-level security remains the database-side enforcement mechanism. Proxima's role routing establishes which database principal performs authorization; PostgreSQL evaluates the row policy.

The deployment must prevent privileged alternate paths. Superusers and `BYPASSRLS` roles can bypass RLS, and table owners normally bypass RLS unless `FORCE ROW LEVEL SECURITY` is enabled.

## Connection safety

The engine has explicit upstream connection timeouts, a configurable concurrent-session limit, graceful shutdown handling, bounded PostgreSQL frame sizes, and fail-closed tenant binding.

## TLS boundary

End-to-end TLS is not silently treated as inspectable. If PostgreSQL accepts an SSL request while tenant enforcement is enabled, the current engine rejects the session because the encrypted PostgreSQL stream is opaque to the enforcement layer.

A future TLS-terminating mode must define certificate validation, upstream TLS trust, channel binding, and key-management behavior before it is advertised as an enforcement mode.

## Verification

Security claims are backed by:

- protocol unit tests;
- property-based malformed-frame tests;
- independent PostgreSQL RLS tests;
- real proxy-to-PostgreSQL integration tests;
- the Proxima Verify adversarial harness.

No feature is considered secure merely because a happy-path connection succeeds.
