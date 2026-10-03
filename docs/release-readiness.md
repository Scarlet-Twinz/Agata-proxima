# Release Readiness

## Current release boundary

The current branch contains the verified Proxima Engine boundary plus the first operator surface.

Implemented:

- signed tenant-context verification;
- tenant-specific PostgreSQL role routing;
- PostgreSQL authentication brokering;
- bounded protocol framing and property-based malformed-input testing;
- concurrent connection limits and upstream connect timeout;
- PostgreSQL client TLS termination;
- explicit client-TLS-required mode;
- upstream PostgreSQL TLS with CA trust and hostname verification;
- bounded TLS handshakes;
- graceful shutdown;
- independent RLS verification;
- real proxy-to-PostgreSQL integration tests;
- adversarial verification for tenant isolation;
- non-root container deployment with read-only Compose filesystem and no-new-privileges;
- health endpoint;
- local Proxima command-center dashboard and AP identity mark;
- three-tenant SaaS acceptance harness.

## Required deployment conditions

1. The tenant signing secret is controlled by the trusted application boundary.
2. Tenant database roles are NOSUPERUSER and NOBYPASSRLS.
3. Protected tables are owned by a role that cannot bypass intended RLS, or FORCE ROW LEVEL SECURITY is used deliberately.
4. PostgreSQL is not directly exposed as an alternate path for untrusted application traffic.
5. Client TLS is required in deployments where the application-to-Proxima path must be encrypted.
6. Upstream `verify-full` mode uses an operator-controlled CA and expected server name.
7. Production secrets are supplied through a secret-management system rather than committed configuration.
8. The dashboard/health listener is kept private or placed behind an authenticated network boundary.

## External acceptance still required

The repository can prove the Engine boundary and provide the acceptance harness, but it cannot honestly manufacture evidence from a real external SaaS application.

Before marketing Proxima as proven in a customer workload, run the three-tenant harness against a real SaaS application with pooling, concurrency, transactions, prepared statements, TLS, restarts and deliberate A→B/B→C/C→A attacks.

## Cloud boundary

Proxima Cloud remains a separate hosted control-plane product. The local dashboard is not represented as Cloud. Cloud completion requires an authenticated durable service, organization/team model, fleet identity, policy distribution, audit storage and deployment lifecycle.

The public release must describe those remaining boundaries rather than implying broader guarantees.
