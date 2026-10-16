# Production Readiness — Agata Proxima

This checklist separates repository implementation from external production acceptance. A checked repository item does not imply that a live provider, deployed endpoint or operational drill has been verified.

## Security
- [x] Engine-first tenant enforcement
- [x] Client TLS and upstream TLS separation
- [x] Authenticated control plane
- [x] CSRF protection for state-changing control-plane calls
- [x] Organization-scoped resources
- [x] Role-based write authorization
- [x] Audit events
- [x] Verification evidence
- [ ] External identity provider / SSO — runtime activation still requires a real public callback and Entra tenant acceptance
- [ ] Managed secret rotation
- [ ] Independent security assessment

## Reliability
- [x] Health endpoint
- [x] Explicit desired/observed deployment model
- [x] Non-root control-plane container
- [x] Read-only container filesystem in Compose
- [ ] Multi-region control-plane deployment
- [ ] Backup/restore drill with measured RPO/RTO
- [ ] Automated node rollback

## Operations
- [x] Structured tracing
- [x] API contract
- [x] Smoke test
- [x] Failure matrix
- [x] Red-team matrix
- [ ] Centralized production metrics
- [ ] Alerting
- [ ] On-call runbook

## Product
- [x] Public homepage
- [x] Sign-up/sign-in
- [x] Command Center
- [x] Tenants / Policies / Fleet / Deployments
- [x] Verification / Audit / Security / Infrastructure
- [x] Developer / Support surfaces
- [x] Flutterwave billing entitlement model, plan catalogue and repository integration contract
- [ ] Flutterwave live activation — complete provider approval, configure production credentials and distinct plan IDs, then verify USD checkout, transaction amount, webhook hash, and entitlement lifecycle
- [ ] Production email lifecycle acceptance — verify each configured Resend template and sender in the deployed environment, and confirm support notifications reach a monitored inbox
- [ ] Customer-facing status page
- [x] Practical `/docs/usage` guide covering setup, first workspace, nodes, tenants, environments, verification, integrations, seats/invitations, billing, API use and troubleshooting

Items marked unchecked are deliberate production gates, not hidden TODOs.

## Billing catalogue

The canonical monthly prices are:

| Plan | Monthly |
|---|---:|
| Free | $0 |
| Starter | $149 |
| Growth | $499 |
| Scale | $1,199 |
| Enterprise | Custom |

Free requires no provider subscription. Paid checkout must use the configured Flutterwave Starter, Growth, and Scale plan IDs. Verify that checkout returns USD and the exact canonical monthly amount, and validate transaction references, `verif-hash`, duplicate delivery, and entitlement transitions before enabling paid checkout.

## Phase 3.22-A–H acceptance state

All eight repository-side Phase 3.22 entitlement gates are implemented and passed in CI:

- [x] A — Canonical pricing and entitlement catalogue
- [x] B — Node, tenant and environment capacity with concurrency safety
- [x] C — Active webhook integration quota
- [x] D — Monthly verification quota
- [x] E — Plan-aware audit retention and cleanup
- [x] F — Team seats, invitations and atomic seat reservation
- [x] G — API keys/rate limits, feature gates, enterprise provisioning and support tiers
- [x] H — Billing lifecycle, grace/downgrade behavior, webhook idempotency and regression gates

Passing these repository gates does not mean that Flutterwave live payment acceptance or the external production gates below have been completed.

## External production acceptance still required

- Real Microsoft Entra login and callback against a registered production application.
- Flutterwave account approval, USD checkout, transaction verification, webhook hash validation, plan/amount checks, duplicate delivery, renewal failure/recovery, and cancellation acceptance.
- Verified Resend delivery using the Agata-owned domain.
- Public HTTPS deployment and production secret management/rotation.
- Backup/restore exercise with measured RPO/RTO.
- Centralized metrics, alerting, on-call runbook and tested rollback.
- Load/performance testing against the intended production environment.
- Runtime external SaaS tenant-isolation acceptance against a deployed customer-like application.
- Independent security assessment and customer-facing status page.
