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
- [ ] External identity provider / SSO
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
- [ ] Billing
- [ ] Production email delivery
- [ ] Customer-facing status page

Items marked unchecked are deliberate production gates, not hidden TODOs.
