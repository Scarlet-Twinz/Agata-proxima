# Release Readiness

## Current engineering boundary

The current branch contains the Phase 18-22 implementation:

- signed tenant-context verification;
- tenant-specific PostgreSQL role routing;
- PostgreSQL authentication brokering;
- bounded protocol framing and malformed-frame property tests;
- one dedicated upstream session per client connection;
- client-side TLS termination with certificate/key loading;
- upstream PostgreSQL TLS with CA and hostname verification;
- explicit TLS handshake timeouts;
- fail-closed mixed TLS/plaintext topology validation;
- runtime connection counters;
- local operational dashboard;
- non-root, read-only Docker defaults;
- independent PostgreSQL RLS verification;
- real proxy-to-PostgreSQL integration tests;
- adversarial verification scripts.

## Required deployment conditions

1. The tenant signing secret is controlled by the trusted application boundary.
2. Tenant database roles are `NOSUPERUSER` and `NOBYPASSRLS`.
3. Protected tables use RLS and, where necessary, `FORCE ROW LEVEL SECURITY`.
4. PostgreSQL is not exposed as an alternate untrusted application path.
5. Verified upstream TLS uses a controlled CA and a correct server name.
6. Production certificate keys and tenant signing secrets come from secret management.
7. TLS-terminating deployments do not use SCRAM channel binding through Proxima until Proxima owns the authentication exchange; clients that require channel binding must be rejected rather than downgraded.

## Phase 18 status

**DONE in the repository boundary.**

TLS termination, upstream TLS verification, handshake timeouts, certificate failure handling and mixed-mode guards are implemented and covered by configuration/unit gates. A full production certificate deployment still requires operator-provided certificates.

## Phase 19 status

**DONE in the repository boundary.**

The engine uses one dedicated upstream connection per client and never reuses a PostgreSQL session across tenants. Authentication must complete before normal query relay. Existing prepared-statement, transaction and connection-reuse isolation tests remain part of the verification path.

## Phase 20 status

**DONE in the repository boundary.**

The adversarial matrix covers forged/missing/expired/duplicate context, CRUD isolation, prepared statements, transaction rollback, connection reuse, TLS downgrade/certificate failure and malformed frames. The configured deployment harness supports an explicit TLS verification mode.

## Phase 21 status

**DONE in the repository boundary.**

Connection bounds, upstream timeouts, TLS handshake bounds, structured operational counters, non-root execution and read-only container defaults are implemented.

## Phase 22 status

**DONE in the repository boundary.**

The first Proxima dashboard is implemented and served by the engine's local admin listener. It is deliberately operational: health, enforcement, TLS state, PostgreSQL connectivity, connection counts, rejection counts and uptime.

## Phase 23 status

**NOT DONE — external proof is still required.**

The repository contains the verification harness and integration contract, but a real independent SaaS application has not yet been connected and attacked in an external deployment. That step requires an actual application/deployment environment outside this repository.

## Phase 24 status

**NOT DONE — hosted cloud deployment is not yet a real service.**

The product architecture reserves Proxima Cloud as the control plane, but no hosted control plane, authentication, organization model, billing, fleet API or deployed cloud service is being falsely represented as complete.

## Completion rule

A phase is only marked DONE when its repository implementation is tested and documented. External deployment and hosted-service phases remain explicitly open until they are actually exercised.
