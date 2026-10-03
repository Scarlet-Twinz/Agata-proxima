# Proxima Verification

Proxima treats tenant isolation as a claim that must be demonstrated, not assumed.

## Automated layers

### Protocol tests

Rust unit tests cover startup packets, frontend/backend frames, length validation, SSL requests, cancellation requests, and malformed input. Property tests feed arbitrary byte strings into the parsers to catch panic-prone framing assumptions.

### Database policy tests

`tests/postgres/verify_rls.sh` validates PostgreSQL RLS independently of the proxy. It covers:

- cross-tenant reads;
- prepared statements;
- cross-tenant INSERT;
- cross-tenant UPDATE;
- cross-tenant DELETE;
- transaction rollback.

### Real proxy integration

`crates/proxima-engine/tests/postgres_integration.rs` starts the actual Proxima binary and authenticates through PostgreSQL. It verifies that tenant A and tenant B receive different PostgreSQL roles and that RLS prevents cross-tenant reads and writes through the proxy.

### Proxima Verify harness

`tools/proxima-verify.sh` runs adversarial checks against a deployment. It requires:

- tenant A/B database credentials;
- the Proxima signing secret;
- the protected table and tenant column.

It uses the same signed tenant-context mechanism as the engine and exercises normal queries and prepared statements through the proxy.

Run it with:

```bash
PROXIMA_VERIFY_SIGNING_KEY='...' \
PROXIMA_VERIFY_TENANT_A_PASSWORD='...' \
PROXIMA_VERIFY_TENANT_B_PASSWORD='...' \
bash tools/proxima-verify.sh
```

The harness intentionally does not treat direct PostgreSQL access as equivalent to proxy verification.

## Deployment invariants

The database roles selected by Proxima must not be superusers or roles with `BYPASSRLS`. PostgreSQL table owners normally bypass RLS, so tenant roles should not own protected tables; `FORCE ROW LEVEL SECURITY` is used where ownership semantics require an additional defense.

The upstream PostgreSQL endpoint must not be exposed as an alternate untrusted path around Proxima.

## TLS

When PostgreSQL negotiates end-to-end TLS through the current engine, tenant enforcement is fail-closed because Proxima cannot inspect the encrypted PostgreSQL session. TLS termination and upstream TLS validation remain an explicit deployment boundary rather than an implied capability.

## Release gate

A Proxima release is not considered security-verified until:

1. Rust format/check/test/clippy pass.
2. PostgreSQL RLS verification passes.
3. The real proxy integration test passes.
4. Property tests pass.
5. The adversarial verification harness has been exercised against the intended deployment.
6. The supported deployment model and TLS behavior are documented.
