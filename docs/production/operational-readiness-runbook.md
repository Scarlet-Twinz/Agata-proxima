# Production Operational Readiness Runbook

This runbook is the implementation plan for operating Agata Proxima outside a developer laptop. It deliberately separates controls already in the repository from evidence that must come from the real hosting environment.

For the proposed Vercel + container-host + managed PostgreSQL topology, use [`deployment-architecture.md`](deployment-architecture.md) for the concrete service settings and deployment order. That path is prepared in source control but is not yet provisioned.

## 1. Target operating model

Production must not depend on VS Code, the developer's laptop, or a local Docker volume.

Required components:

1. **Public frontend** served over HTTPS.
2. **Rust Control Plane container** on a managed container host with a stable public HTTPS origin.
3. **Managed PostgreSQL** for the Control Plane, with automated backups, encryption/TLS and restricted network access.
4. **Proxima Engine nodes** deployed close to the protected PostgreSQL systems. The Engine remains the data-plane enforcement authority.
5. **Secret store** for database credentials, Lemon Squeezy, Resend and Entra credentials.
6. **Monitoring and alerting** for liveness, readiness, database failures, webhook failures and email delivery.
7. **Recovery path** that can restore a backup to an isolated database and redeploy a previous known-good image.

The frontend and backend may be hosted separately. The exact provider and production database must be selected and verified before deployment; do not pretend a local database or repository URL is a hosted production service. The browser-facing app origin and Control Plane API/OIDC callback must be same-origin (normally via a reverse proxy) so the session cookie is set for the origin that serves the React frontend.

## 2. Local vs hosted database

The local Compose file defines:
- `postgres`: Engine development database on host port 5432.
- `control-postgres`: Control Plane database on host port 55443 by default.

A local database is appropriate for development only. Production must use a separately provisioned database with private network access, TLS, access control, automated backups and tested recovery. Set `PROXIMA_CONTROL_DATABASE_URL` through the deployment's secret/configuration system, not in committed source files.

Before rollout:
- Confirm the database host is not localhost or a developer machine.
- Confirm the service uses the intended production database.
- Review migrations 0001–0015 and the startup migration behavior.
- Take a pre-release backup.
- Apply the release and run smoke checks.
- Never use a reset script or destructive volume deletion as a migration strategy.

## 3. Health and readiness

The Control Plane exposes:

- `GET /healthz` and `GET /api/v1/health`: liveness/database connectivity.
- `GET /api/v1/production/readiness`: configuration readiness checks for database, Lemon Squeezy API/store/variants/webhook secret, Resend, public base URL and OIDC credentials.

Use liveness for frequent health probes. Use readiness as a launch/rollout gate: `needs_configuration` means one or more production integrations are not configured. Do not make the service public to customers just because liveness returns healthy.

Run the repository smoke check:

```bash
AGATA_PUBLIC_BASE_URL=https://<public-control-plane-host> bash scripts/ops/check-control-plane.sh
```

The repository also includes `.github/workflows/production-smoke.yml`:

- After the repository secret `AGATA_PUBLIC_BASE_URL` is configured, GitHub Actions checks `/api/v1/health` every 15 minutes and records failures in Actions.
- Run **Production smoke monitoring** manually from the Actions tab to check both liveness and the full `/api/v1/production/readiness` contract before launch. A manual run can use the `base_url` input or the repository secret.
- The scheduled probe skips cleanly until the public URL secret exists. It requires HTTPS and does not print credentials.

This is a lightweight early-warning layer, not a replacement for managed database alerts, application metrics, incident ownership or an independent uptime monitor.

## 4. Backups and restore

The managed PostgreSQL provider should perform automated backups/PITR where available. Set retention to a documented policy (recommended starting point: daily backups retained for at least 14 days, with point-in-time recovery if the provider supports it). Keep backups protected by access controls and encryption.

For an additional on-demand custom-format backup, set these environment variables using the provider's secret mechanism or a protected operator shell:
- `PGHOST`
- `PGPORT` (usually 5432)
- `PGDATABASE`
- `PGUSER`
- `PGPASSFILE` (path to a protected PostgreSQL password file)

Then run:

```bash
bash scripts/ops/backup-control-plane.sh
```

The script creates a private custom-format backup, verifies that `pg_restore --list` can read it, and prints a SHA-256 checksum. It does not upload or delete backups; copy them only to an approved encrypted storage location.

A backup is not accepted until a restore drill succeeds:
1. Provision a separate temporary database that is not the production database.
2. Restore the selected backup into that isolated database.
3. Verify tables, organization records, migrations and representative audit/billing data.
4. Run the Control Plane smoke checks against the restored database.
5. Record the backup timestamp, restore duration, data-loss window (RPO) and recovery duration (RTO).
6. Destroy the temporary restore database only after evidence is recorded and only after confirming it is not production.

Never test recovery by restoring over the live customer database.

## 5. Monitoring and alerting

Minimum launch monitoring:

| Signal | Check | Alert condition |
|---|---|---|
| Liveness | `/api/v1/health` every 60 seconds | Two consecutive failures |
| Readiness | `/api/v1/production/readiness` during deploy and periodically | Any missing required production configuration |
| Database | Liveness plus managed database metrics | Connection failures, storage exhaustion or sustained high saturation |
| API | HTTP 5xx rate and latency | Sustained 5xx spike or breached agreed latency threshold |
| Lemon Squeezy | Signed webhook delivery, rejected signatures, duplicate-event handling, failed payment reconciliation | Repeated delivery failures or successful subscription event not reconciled |
| Resend | Delivery failures and provider events | Verification/reset/invitation emails failing |
| Backups | Provider backup status and age | Latest successful backup exceeds policy |
| Engine nodes | Node health, restart rate and saturation | Node unhealthy or connection/resource limits approached |

Logs must be structured and must not contain secrets, passwords, session cookies, CSRF tokens, authorization codes, ID tokens, or full payment credentials. Set an explicit log-retention policy and restrict access.

## 6. Incident and recovery procedure

### Control Plane unhealthy
1. Check deployment status and recent release.
2. Check database connectivity, connection pool saturation and provider incidents.
3. Inspect structured logs and the health endpoint.
4. Roll back to the last known-good image if a release caused the regression.
5. Verify the Control Plane health and readiness endpoints after recovery.

The Engine must continue enforcing tenant isolation if the Control Plane is unavailable; do not route around the Engine or expose PostgreSQL to restore management availability.

### Payment/entitlement mismatch
1. Do not manually grant a paid plan based on a browser redirect.
2. Inspect the local billing transaction and the signed Lemon Squeezy event.
3. Verify the provider transaction reference, plan code, USD currency and exact expected amount.
4. Retry reconciliation only through the verified provider transaction flow.
5. Record the event and remediation in the audit trail.

### Suspected tenant-isolation incident
1. Preserve logs and verification evidence.
2. Restrict affected access paths without bypassing the Engine.
3. Run the three-tenant external SaaS acceptance harness against a controlled environment.
4. Escalate for independent security review before resuming affected traffic.

## 7. Launch acceptance checklist

Do not declare production ready until all are evidenced:

- [ ] Public HTTPS frontend and Control Plane are deployed.
- [ ] Production database is separate from local Compose and its connection is verified.
- [ ] Migrations 0001–0015 are applied and schema state is checked.
- [ ] Lemon Squeezy variants match $149 / $499 / $1,199 USD per month.
- [ ] Lemon Squeezy test-mode checkout → signed webhook → entitlement update succeeds.
- [ ] Microsoft Entra sign-in works against the real registered application.
- [ ] Resend domain is verified and real email delivery succeeds.
- [ ] Liveness/readiness probes and alerting are configured.
- [ ] Automated backup policy is active and a restore drill has measured RPO/RTO.
- [ ] Rollback is tested.
- [ ] External SaaS three-tenant isolation acceptance succeeds against a deployed service.
- [ ] Load test and independent security assessment are complete.

Repository CI is necessary, not a substitute for these runtime checks.
