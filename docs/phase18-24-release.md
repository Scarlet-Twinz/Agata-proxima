# Phase 18–24 Release Record

> Security work is accepted only when the executable gate is green.

Final verification follows the same gate on the current branch head.

## Phase 18 — TLS Security Boundary

Implemented:

- PostgreSQL SSLRequest detection at the Proxima edge.
- Client TLS termination with Rustls.
- TLS handshake timeout.
- Explicit client-TLS-required mode.
- Separate upstream PostgreSQL TLS connection.
- Upstream CA trust and hostname verification in `verify-full` mode.
- No silent plaintext downgrade when TLS is explicitly required.
- Tenant enforcement continues after TLS termination because the session layer is transport agnostic.

Supported production boundary:

```
Application -- PostgreSQL TLS --> Proxima -- PostgreSQL TLS --> PostgreSQL
```

The two TLS legs have independent trust decisions.

## Phase 19 — Connection Lifecycle Hardening

The engine uses one PostgreSQL session per accepted client connection. Tenant identity is bound once during startup and is not accepted as mutable query-time security context.

The boundary is deliberately:

```
TCP connection
  -> startup
  -> tenant verification
  -> PostgreSQL authentication
  -> ReadyForQuery
  -> query stream
  -> connection close
```

Tenant A state is never intentionally recycled into tenant B because Proxima does not pool or retarget database sessions between tenants.

Cancellation is forwarded as a PostgreSQL protocol operation. Authentication failures terminate the session before query relay. The adversarial verification suite exercises prepared statements, writes, deletes, missing context, and expired context.

## Phase 20 — Deep Adversarial Verification

Verification covers:

- malformed PostgreSQL startup/frame inputs;
- property-based parser fuzzing;
- missing tenant context;
- expired tenant context;
- duplicate tenant context;
- signed-token tampering;
- cross-tenant SELECT;
- cross-tenant INSERT/UPDATE/DELETE;
- prepared statements;
- transaction/rollback behavior;
- role routing;
- PostgreSQL RLS independently and through the proxy.

The release gate is still executable: implementation is not treated as a security claim until the relevant test passes.

## Phase 21 — Production Hardening

Implemented:

- bounded concurrent sessions;
- upstream connect timeout;
- TLS handshake timeouts;
- explicit TLS configuration;
- non-root container;
- read-only Compose container filesystem;
- no-new-privileges;
- health endpoint;
- structured runtime logging;
- explicit development versus production TLS configuration.

## Phase 22 — Proxima Dashboard

Implemented as the first operator surface.

The dashboard includes:

- Overview;
- Tenants;
- Connections;
- Policies;
- Security;
- Verification;
- Audit;
- Infrastructure;
- Settings navigation;
- engine/enforcement/TLS status;
- runtime configuration telemetry;
- health endpoint;
- AP brand mark.

The dashboard is intentionally a runtime surface, not a fake cloud control plane.

## Phase 23 — External SaaS Integration

Implemented in-repository as an external-SaaS-shaped three-tenant verification harness.

A real customer/external deployment is not represented as complete until a real application is placed behind Proxima and the A→B/B→C/C→A attacks are executed against that deployment.

That final proof requires an environment outside this repository.

## Phase 24 — Proxima Cloud

The control-plane contract is documented under `cloud/`.

A hosted multi-tenant control plane is not claimed as complete yet. The current dashboard is the local operator surface; Proxima Cloud requires its own authenticated API, durable state, organization/team model, fleet identity, audit storage, and deployment lifecycle.

That distinction is intentional: a local dashboard is not marketed as a hosted cloud product.
