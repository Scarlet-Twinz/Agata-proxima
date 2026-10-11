# Phase 3B checkpoints 3.24–3.40 — acceptance status

**Canonical domain:** `agataproxima.com`  
**Canonical integration branch:** `main`  
**Active billing provider:** Paddle Live API only  
**Status rule:** repository implementation and a live production acceptance are separate. A checkpoint is not fully passed until its listed external evidence exists.

This page is the single checkpoint summary for 3.24–3.40. The detailed runbooks linked below remain the execution instructions; do not infer that a task is complete merely because a script or runbook exists.

| Checkpoint | Repository evidence / work | Status beyond the repository |
|---|---|---|
| **3.24 — Domain architecture** | Canonical public origin and API origin are consistently documented as `https://agataproxima.com` and `https://api.agataproxima.com`; internal Markdown links in the core README, usage, developer, identity and production guides were checked against the repository tree. | **BLOCKED:** verify actual DNS records and both public hostnames after hosting targets exist. |
| **3.25 — Public HTTPS** | Vercel routing targets the canonical API hostname; secure-cookie configuration and HTTPS deployment instructions exist. | **BLOCKED:** public TLS certificates, redirects, browser cookies, CORS/proxy behavior and Entra callback must be tested against the deployed origins. |
| **3.26 — Production secrets** | Environment templates, readiness checks and secret-handling instructions exist; real values are not committed. Paddle is configured for Live API only. | **BLOCKED:** populate and verify the deployment secret store for database, session/signing, Paddle Live, Resend and Entra. Never copy secrets into Git. |
| **3.27 — Credential rotation** | [Credential rotation runbook](credential-rotation-runbook.md) defines safe rotate/verify/revoke and rollback steps; secret separation is documented. | **INCOMPLETE:** a verified rotate/activate/rollback drill for each production credential has not been evidenced. Do not mark passed until rotation and recovery are exercised. |
| **3.28 — Backups and disaster recovery** | `scripts/ops/backup-control-plane.sh` creates and validates a PostgreSQL custom-format backup; the operations runbook describes isolated restore and RPO/RTO recording. | **BLOCKED:** provider-managed backups/PITR and a successful isolated restore drill must be configured and evidenced. A readable backup file alone is not a restore pass. |
| **3.29 — Database migrations** | Forward migrations and migration verification gates are in the repository; historical migrations are retained for auditability. | **BLOCKED:** current CI must pass and the complete migration chain must be verified against the selected production database before launch. No destructive schema reset is permitted. |
| **3.30 — Observability** | Liveness, database health, production readiness and a scheduled smoke workflow are implemented. | **BLOCKED:** configure the public URL secret, confirm scheduled probes reach the real deployment, and connect actionable alert delivery. |
| **3.31 — Error tracking and safe logs** | Structured tracing, request IDs in error paths and internal delivery diagnostics are present. | **PARTIAL:** verify production logs contain no secrets or personal data beyond what is necessary; no external error-tracking service acceptance is evidenced. |
| **3.32 — Rate limiting** | Organization quota enforcement and database-backed public-support/API request windows exist in the Control Plane. | **BLOCKED:** exercise abuse, concurrency and multi-instance behavior against the deployed service; confirm rate limits cannot be bypassed by changing tenant identifiers. |
| **3.33 — Paddle webhook architecture** | Paddle Live API endpoint, price/organization matching, timestamped signature validation, event idempotency and subscription reconciliation are implemented and guarded by repository checks. Sandbox routing has been removed from the active integration. | **BLOCKED:** requires Paddle business approval, approval of `agataproxima.com`, Live credentials and three unique active Live monthly USD `pri_...` price IDs at $149/$499/$1,199, plus verified Live webhook delivery. Do not claim a successful live charge until accepted. |
| **3.34 — Failure and resilience** | Billing lifecycle regression gates and operational failure/recovery runbooks exist. | **BLOCKED:** exercise database/provider/email/webhook failure, restart and recovery scenarios in the deployed environment and record results. |
| **3.35 — Security review / red team** | Threat-model, adversarial verification and external-SaaS acceptance materials exist. | **BLOCKED:** complete the scoped adversarial campaign and independent security review; record findings and remediation. Documentation is not evidence of a completed red-team test. |
| **3.36 — Supply-chain security** | Rust and frontend build/test/lint workflows exist. | **INCOMPLETE:** dependency vulnerability auditing, secret scanning and an SBOM/container scan are not yet evidenced as passing required CI gates. |
| **3.37 — CI/CD controls** | Frontend/Rust quality workflows and a manual production readiness smoke workflow exist. The repository rulesets endpoint returned an empty list; the branch-protection endpoint was not accessible for verification. | **PARTIAL / OWNER ACTION:** inspect and enable `main` branch protection with required passing checks, review/deploy permissions and production approval gates. No deployment should bypass required checks. |
| **3.38 — Staging** | Staging requirements are described in the deployment plan. | **BLOCKED:** no isolated staging frontend, API, database and staging-only credentials are evidenced as provisioned. |
| **3.39 — Deployment strategy** | `docs/production/deployment-architecture.md` defines frontend/API/managed PostgreSQL topology and order of operations. | **BLOCKED:** provider resources, DNS, database, secret store and host configuration are not evidenced as provisioned. |
| **3.40 — Safe deployment and rollback** | Health/readiness, migration, backup and post-deploy runbooks/scripts exist. | **BLOCKED:** deploy the API before the frontend, run the production smoke/readiness checks, prove rollback on the selected host and record the release evidence. |

## Required evidence before closing 3.24–3.40

- [ ] Final consolidated PR is merged to `main` with current frontend and Rust CI checks passing.
- [ ] No obsolete open PR is left presented as the active implementation; historical branches are retained until diff/ancestry review confirms they are safe to close or delete.
- [ ] Live DNS/HTTPS, production secret store and managed database are verified.
- [ ] Paddle Live account/domain approval, price IDs, signed webhook lifecycle and approved charge/refund acceptance are recorded.
- [ ] Entra sign-in, Resend delivery, backup/restore, monitoring/alerts and multi-tenant external-SaaS/security acceptance are evidenced.
- [ ] Supply-chain checks and CI/CD protections are in place.
- [ ] Deployment and rollback evidence is recorded.

Until the external items are verified, checkpoints with blocked or incomplete evidence remain **not passed**. This prevents a new contributor or customer from mistaking repository preparation for a live, production-accepted service.


## Separate legacy implementation blocker

The earlier [Phase 3A integration branch, PR #58](https://github.com/Scarlet-Twinz/Agata-proxima/pull/58), contains unique customer-integration/environment-credential behavior but cannot be merged wholesale: its migrations 0008–0011 conflict with the current migration history. It is intentionally kept as a draft with a port plan. Preserve its branch, port any required behavior using new forward-only migration numbers after 0020, reconcile the handlers and Engine context, and rerun all security/migration tests before closing it. This blocker is separate from 3.24–3.40 and must not be silently treated as complete.

The other legacy PRs marked **BLOCKED** are also retained as branches for selective review. Their status means “not safe to merge as-is,” not “their unique behavior has been completed.”
