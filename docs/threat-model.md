# Proxima Threat Model

## Security objective

Prevent an authenticated request for tenant A from obtaining or modifying tenant B's protected data through the supported Proxima deployment model.

## Assets

- tenant-scoped database rows;
- tenant identity and authorization context;
- database credentials;
- TLS private keys and certificate trust roots;
- policy configuration;
- security/audit events;
- connection/session state.

## Primary threats

### Cross-tenant read

A request associated with tenant A attempts to read tenant B's rows.

### Cross-tenant mutation

A request associated with tenant A attempts to update or delete tenant B's rows.

### Context confusion

Tenant context from one connection or request is accidentally reused for another tenant.

### Context forgery

An untrusted client attempts to claim a different tenant identity.

### Session leakage

Connection pooling, prepared statements, transactions, or reset failures cause state to cross tenant boundaries.

### Privileged bypass

An administrative or privileged database path accidentally bypasses the intended tenant policy.

### Protocol confusion

Malformed or unexpected PostgreSQL messages cause the engine to interpret connection state incorrectly.

### TLS downgrade

A client or upstream database is induced to fall back from the configured TLS boundary to plaintext.

**Mitigation:** verified topology requires explicit TLS modes; Proxima rejects unsafe mixed configurations and fails closed on upstream TLS rejection or certificate validation failure.

### TLS trust failure

A malicious or misconfigured certificate, CA, hostname, or interrupted handshake attempts to enter the enforcement boundary.

**Mitigation:** rustls certificate verification, configured trust roots, hostname verification, and bounded handshakes are required for the verified upstream mode.

### Channel-bound authentication mismatch

SCRAM-SHA-256-PLUS binds authentication to TLS channel data. A TLS-terminating proxy has separate client and upstream channels, so blindly forwarding a channel-bound exchange is unsafe.

**Mitigation:** Proxima does not claim transparent SCRAM-PLUS support and does not silently downgrade clients that explicitly require channel binding. Full authentication ownership is a separate future boundary.

## Explicit non-goals

Proxima does not claim to protect a system merely because traffic passes through the proxy.

It does not protect against:

- a PostgreSQL superuser or BYPASSRLS role;
- direct access to PostgreSQL with privileged credentials;
- a compromised tenant-signing secret;
- an intentionally unsupported deployment topology;
- transparent SCRAM channel binding across separately terminated TLS sessions.

## Verification requirements

Security tests must cover:

- reads;
- INSERT/UPDATE/DELETE;
- transactions and rollback;
- prepared statements;
- connection reuse;
- missing context;
- invalid context;
- context changes;
- administrative paths;
- malformed protocol frames;
- client TLS negotiation;
- plaintext-to-TLS rejection;
- upstream TLS verification;
- certificate and hostname failures;
- TLS handshake interruption;
- channel-binding behavior.

Every security guarantee must have a corresponding executable test or a documented architectural proof.
