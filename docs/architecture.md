# Proxima Architecture

## Core boundary

Proxima sits between an application and PostgreSQL.

```
Application
    |
    | PostgreSQL connection
    v
Proxima Engine
    | \
    |  \\ controlled database connection
    |   \
    v    v
PostgreSQL
```

When TLS is enabled, the two transport legs are independent:

```
Application --TLS--> Proxima --TLS--> PostgreSQL
```

The engine treats startup and authentication as an explicit protocol boundary. It verifies signed tenant context before rewriting the upstream PostgreSQL startup user to a tenant-specific database role, then brokers PostgreSQL authentication until `ReadyForQuery`. Only after successful authentication does it enter the normal query relay.

## Trusted tenant context

The tenant assertion is:

```
v1.<tenant_id>.<expires_at_unix_seconds>.<hex_hmac_sha256>
```

The signing secret is at least 32 bytes. Tenant identifiers are restricted to a conservative character set and the resulting role name must fit PostgreSQL's identifier limit.

For libpq-compatible clients, the token may be carried in the startup `options` parameter as `-c proxima_tenant_token=<signed-token>`. Proxima removes the private option before forwarding startup.

## Authentication boundary

PostgreSQL SASL/SCRAM authentication is multi-step. Proxima forwards authentication messages while tracking the server state and refuses normal query relay until PostgreSQL has returned `AuthenticationOk` and `ReadyForQuery`.

## Database enforcement

Tenant roles are ordinary PostgreSQL roles with `NOBYPASSRLS`. PostgreSQL RLS remains the database-side enforcement mechanism. The deployment must prevent privileged alternate paths because superusers and `BYPASSRLS` roles can bypass RLS.

## Connection lifecycle

Each accepted client connection owns one PostgreSQL session. Proxima does not pool or retarget physical database sessions between tenants.

The lifecycle is:

```
TCP -> startup -> tenant verification -> PostgreSQL auth
    -> ReadyForQuery -> query stream -> close
```

Missing, duplicate, expired or tampered tenant context fails closed. Connection admission, upstream connects and TLS handshakes are bounded. Cancellation is forwarded as a PostgreSQL protocol operation.

## TLS boundary

Client TLS is terminated at Proxima when a PostgreSQL SSLRequest is received and a certificate/key are configured. `PROXIMA_TLS_REQUIRE_CLIENT=true` rejects plaintext connections.

The PostgreSQL hop can independently use `PROXIMA_UPSTREAM_TLS_MODE=verify-full`, which requires an operator-provided CA and server name. Rustls validates the certificate chain and hostname. There is no certificate-verification bypass.

This makes encrypted PostgreSQL traffic enforceable at the Proxima boundary without pretending that opaque end-to-end TLS can be inspected.

## Operator surface

The local command center is served by the engine and exposes configuration/runtime status plus a health endpoint. It is not a hosted Cloud service and does not replace the data-plane security boundary.

## Verification

Security claims are backed by protocol tests, property-based malformed-frame tests, independent RLS tests, real proxy-to-PostgreSQL integration tests, TLS tests, and the Proxima Verify adversarial harness.

No feature is considered secure merely because a happy-path connection succeeds.
