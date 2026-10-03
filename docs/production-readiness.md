# Production Readiness — Agata Proxima

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
- [x] Billing entitlement model and Stripe integration contract
- [ ] Production email delivery — waiting for Agata-owned sending domain
- [ ] Customer-facing status page

Items marked unchecked are deliberate production gates, not hidden TODOs.

## Phase 51–57 acceptance state

The repository now contains the entitlement enforcement layer, plan catalog, billing UI, production email/deployment runbooks, adversarial gate, and independent external SaaS acceptance fixture.

The following are intentionally deployment-gated rather than claimed as complete: real Microsoft Entra login, real Stripe checkout/webhook delivery, verified Resend delivery, public HTTPS deployment, measured backup/restore, and runtime external SaaS acceptance.
