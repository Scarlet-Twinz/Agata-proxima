# Phase 18-24 Completion Record

This document records what is real, what is verified, and what still requires an external environment.

## Phase 18 — TLS security boundary

Implemented:

- PostgreSQL SSLRequest detection at the client edge.
- Rustls client TLS termination.
- certificate/key loading.
- minimum modern rustls protocol defaults.
- bounded client and upstream handshakes.
- upstream PostgreSQL TLS with CA and hostname verification.
- explicit refusal of unsafe verified-upstream/plaintext-client topology.
- certificate and handshake failures fail closed.

Important limitation:

- Proxima still brokers PostgreSQL authentication instead of owning it.
- SCRAM-SHA-256-PLUS channel binding cannot be transparently copied across two different TLS certificates.
- No silent downgrade is performed.

## Phase 19 — connection lifecycle hardening

Implemented:

- one upstream PostgreSQL session per client connection;
- no cross-tenant database-session reuse;
- authentication completion before query relay;
- connection concurrency bound;
- upstream connection timeout;
- prepared statement and transaction isolation coverage retained.

## Phase 20 — deep adversarial verification

Implemented:

- malformed startup/frame property testing;
- tenant token forgery/expiry/missing/duplicate rejection;
- CRUD cross-tenant checks;
- prepared statement checks;
- transaction rollback checks;
- explicit TLS verification mode;
- adversarial scenario matrix.

## Phase 21 — production hardening

Implemented:

- non-root container;
- read-only container filesystem;
- dropped Linux capabilities;
- no-new-privileges;
- bounded connections;
- bounded connection/TLS handshakes;
- operational counters;
- no secrets rendered by the dashboard.

## Phase 22 — dashboard

Implemented:

- local admin listener;
- health endpoint;
- status API;
- responsive first-screen dashboard;
- AP mark reserved as an inline vector asset;
- no dependency on a third-party dashboard platform.

The dashboard is intentionally a foundation for the future cloud control plane rather than pretending to be the cloud product already.

## Phase 23 — external SaaS integration

The repository is ready for a real SaaS integration test. The external application must:

1. connect through Proxima;
2. exercise multiple tenants;
3. use transactions and prepared statements;
4. use a real connection pool;
5. deliberately attempt A→B, B→A and invalid-context operations;
6. run through TLS;
7. restart/reconnect;
8. run the Proxima Verify harness.

This is not marked DONE until an actual external deployment produces evidence.

## Phase 24 — Proxima Cloud

The intended control-plane boundary is documented, but the hosted service is not claimed as implemented. The next artifact is a real API/service deployment, not another mock dashboard.
