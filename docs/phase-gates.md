# Phase 18–24 Gates

## 18 — TLS Security Boundary
Required: client TLS termination, upstream TLS trust, no silent downgrade, bounded handshakes, tenant isolation after termination.

## 19 — Connection Lifecycle
Required: no tenant-state leakage across sessions, authentication boundary before relay, cancellation/reconnect safety, prepared statement/session-state coverage.

## 20 — Deep Adversarial Verification
Required: hostile protocol, identity, database and transport inputs with executable tests or architectural proofs.

## 21 — Production Hardening
Required: resource limits, secret handling, non-root container, explicit trust, operational timeouts and deployment constraints.

## 22 — Dashboard
Required: command-center presentation surface with a reserved final brand mark and no fabricated claim that placeholder metrics are live.

## 23 — External SaaS
Required: a real external multi-tenant application run through Proxima with deliberate cross-tenant attacks and normal production-like workload.

## 24 — Cloud
Required: authenticated hosted control plane, persistent organization isolation, deployment, observability and security verification.

The final two gates are intentionally not considered complete merely because contracts or local mockups exist.
