# Proxima Threat Model

## Security objective

Prevent an authenticated request for tenant A from obtaining or modifying tenant B's protected data through the supported Proxima deployment model.

## Assets

- tenant-scoped database rows;
- tenant identity and authorization context;
- database credentials;
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

## Explicit non-goals

Proxima does not claim to protect a system merely because traffic passes through the proxy.

In particular, an end-to-end encrypted PostgreSQL connection cannot be inspected by a passive proxy. TLS termination and its trust model must be explicitly designed before Proxima claims protocol-level policy enforcement inside that encrypted stream.

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
- TLS mode behavior.

Every security guarantee must have a corresponding executable test or a documented architectural proof.
