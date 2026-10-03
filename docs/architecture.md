# Proxima Architecture

## Core boundary

```
Application
    |
    | client TLS
    v
Proxima Engine
    |
    | upstream TLS
    v
PostgreSQL
```

Proxima treats the application-to-Proxima and Proxima-to-PostgreSQL channels as separate security boundaries. When verified upstream TLS is enabled, plaintext is not accepted at the client edge.

## Tenant context

The tenant assertion is:

```
v1.<tenant_id>.<expires_at_unix_seconds>.<hex_hmac_sha256>
```

The signing secret is at least 32 bytes. Proxima removes the private token before forwarding startup parameters and maps the verified tenant to a PostgreSQL role:

```
proxima_tenant_<tenant_id>
```

The resulting role name must fit PostgreSQL's 63-byte identifier limit.

## Authentication boundary

Proxima brokers PostgreSQL authentication until `AuthenticationOk` and `ReadyForQuery`. It does not invent a second password protocol.

That choice creates a precise TLS limitation: SCRAM-SHA-256-PLUS includes channel binding to the server certificate. A TLS-terminating proxy has a different client-side TLS certificate from the PostgreSQL-side certificate, so PLUS authentication cannot simply be copied between the two channels. Proxima therefore does not claim transparent channel-bound SCRAM yet and does not silently downgrade a client that explicitly requires it.

## Database enforcement

Tenant roles must be `NOSUPERUSER` and `NOBYPASSRLS`. Protected tables should use RLS and, where appropriate, `FORCE ROW LEVEL SECURITY`.

The proxy establishes the database principal; PostgreSQL remains responsible for row authorization.

## TLS

Client mode:

- `disabled`: preserve the existing plaintext development path.
- `required`: require PostgreSQL SSLRequest, return `S`, terminate TLS with a configured certificate/key, then parse PostgreSQL startup inside the encrypted channel.

Upstream mode:

- `disabled`: connect directly to PostgreSQL.
- `verify-full`: negotiate PostgreSQL TLS, validate the configured CA, validate the configured server name, and fail closed on any certificate or handshake error.

No silent TLS downgrade is permitted in verified topology.

## Connection lifecycle

Every client gets a dedicated upstream PostgreSQL connection. Proxima does not pool or reuse a database session across tenants. The tenant role is selected before authentication and remains attached to that one upstream session for its lifetime.

This makes the lifecycle invariant concrete:

> State from tenant A's PostgreSQL session is never reused as tenant B's PostgreSQL session.

Prepared statements and transaction behavior are exercised through the real PostgreSQL integration suite.

## Operational dashboard

The engine exposes a separate local admin listener with:

- `/api/health`
- `/api/status`
- a dashboard at `/`

The admin surface contains operational counters only and never renders signing secrets or tenant tokens.

## Product layers

```
                 AGATA PROXIMA
                       |
          +------------+------------+
          |            |            |
       Engine        Verify      Dashboard
          |
      PostgreSQL
                       |
                     Cloud
```

The cloud layer is deliberately separated from the data plane. The engine can run self-hosted without a hosted control plane.
