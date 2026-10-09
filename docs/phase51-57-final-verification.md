# Phase 51–57 Final Verification Gate

This document records the repository-side completion boundary for Phases 51–57. Repository implementation and CI success do not imply that external production services have been configured or accepted.

## Completed in repository

- Phase 51: Microsoft Entra OIDC implementation groundwork, tenant-bound organization mapping, state/nonce handling, identity linking, optional JIT provisioning, SSO audit events and an external SaaS acceptance fixture. A real Entra sign-in remains an external acceptance gate.
- Phase 52: Free/Starter/Growth/Scale/Enterprise entitlement matrix with server-side capacity and feature enforcement.
- Phase 53: billing plan catalogue, entitlement endpoint, Lemon Squeezy checkout/webhook contract and customer billing surface.
- Phase 54: production Resend integration contract for verification, reset, invitation and billing email flows.
- Phase 55: production deployment configuration, secret contract, health/readiness surfaces and deployment runbooks.
- Phase 56: adversarial verification matrix, security boundary checks and production gate documentation.
- Phase 57: independent external SaaS reference application and three-tenant acceptance scripts.

## Canonical monthly pricing

| Plan | Monthly |
|---|---:|
| Free | $0 |
| Starter | $149 |
| Growth | $499 |
| Scale | $1,199 |
| Enterprise | Custom |

The Free plan does not require a Lemon Squeezy subscription. Paid checkout uses the Agata-specific environment-configured Lemon Squeezy plan codes. Before live activation, verify the configured provider plan amounts and codes against this table. Do not create, modify or enable provider plans solely from documentation.

## What repository CI can prove

The Rust launch workflow verifies formatting, workspace compilation, tests, Clippy, PostgreSQL RLS, migration verification, OpenAPI validity, environment contract, operational scripts, external SaaS fixture syntax and the Phase 3.22-A–H acceptance gates.

## What cannot honestly be marked complete without production infrastructure

These require real external systems and are deployment gates rather than repository-only claims:

1. Public HTTPS Control Plane deployment.
2. Real Microsoft Entra application registration and end-to-end callback.
3. Real Lemon Squeezy plan/code configuration, webhook delivery and checkout/payment round trip.
4. Agata-owned Resend domain with DNS verification and real delivery.
5. Production secret rotation.
6. Production backup/restore drill with measured RPO/RTO.
7. Centralized production metrics and alerting.
8. Automated node rollback.
9. Independent security assessment.
10. Runtime external SaaS acceptance against a deployed external application.

No item above is represented as passed merely because its code or documentation exists.
