# Release Readiness

## Current engineering boundary

The current engine supports:

- signed tenant-context verification;
- tenant-specific PostgreSQL role routing;
- PostgreSQL authentication brokering;
- bounded protocol framing;
- concurrent connection limits;
- upstream connection timeouts;
- bounded TLS handshakes;
- explicit client TLS termination;
- explicit upstream TLS certificate verification;
- session maximum-duration protection;
- runtime health/readiness/metrics endpoints;
- independent PostgreSQL RLS verification;
- real proxy-to-PostgreSQL integration tests;
- property-based malformed-frame tests;
- adversarial two-tenant and three-tenant verification harnesses;
- a responsive command-center dashboard;
- non-root container execution and deployment hardening.

## Required deployment conditions

1. The tenant signing secret is controlled by the trusted application boundary.
2. Tenant database roles are NOSUPERUSER and NOBYPASSRLS.
3. Protected tables are owned by a role that cannot bypass the intended RLS policy, or FORCE ROW LEVEL SECURITY is used deliberately.
4. PostgreSQL is not directly exposed as an alternate path for untrusted application traffic.
5. TLS-required mode has a valid server certificate and private key.
6. Upstream TLS-required mode has an operator-controlled CA and expected server name.
7. Production secrets are supplied through a secret-management system rather than committed configuration.
8. Telemetry is kept private or protected by an authenticated control plane.

## What remains external evidence

A real external SaaS deployment is intentionally not claimed as proven by repository CI. The final acceptance gate requires a real application with at least three tenants, connection pooling, concurrency, transactions, prepared statements, TLS and deliberate cross-tenant attacks.

Proxima Cloud is also not claimed as a hosted production service by this repository. Its control-plane contract is documented in `docs/cloud.md`.

## Completion rule

A security feature is considered complete only after:

IMPLEMENTED -> TESTED -> ATTACKED -> CI GREEN -> DOCUMENTED -> DONE

Anything requiring external credentials, a real SaaS deployment, or manual certificate provisioning remains a user/deployment acceptance step.
