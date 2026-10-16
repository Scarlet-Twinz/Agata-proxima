# Production Acceptance Matrix

**Status: not launch-accepted.** This matrix separates repository implementation from evidence that must be collected in the real production environment. A green CI run, a deployment marked ready, or a configuration document does not prove that a live service is safe to launch.

## Acceptance gates

| Area | Repository preparation | Required production evidence |
|---|---|---|
| Hosting and public routing | Container/frontend build configuration and routing guidance exist. | Owner-approved hosting provider and commercial plan; verified domain ownership, DNS, TLS, API routing, cookies, CSRF, and OIDC callback behavior. Do not deploy to Vercel for production unless the owner explicitly approves it. |
| Database and migrations | Versioned migrations and migration-verification checks are maintained in the repository. | Apply migrations in order to the selected managed PostgreSQL database; verify restricted access, TLS, backups/PITR, and a successful isolated restore drill with recorded RPO/RTO. |
| Engine and tenant isolation | Rust tests, PostgreSQL verification, and adversarial test materials are maintained. | Run the tests against the deployed Engine and customer-like database configuration; prove cross-tenant reads/writes are rejected and the Engine remains authoritative if the Control Plane is unavailable. |
| Billing | Flutterwave integration and server-side verification logic are present. | Confirm provider approval, plan IDs, USD currency and exact amounts, transaction verification, webhook hash validation, idempotent duplicate delivery, failure handling, and correct entitlement transitions. Keep paid checkout disabled until this passes. See the [Flutterwave billing runbook](flutterwave-billing.md). |
| Microsoft Entra identity | OIDC configuration and organization mapping are documented. | Register the exact callback URI, configure credentials in the secret store, bind the correct tenant to the organization, and pass real sign-in, state/nonce, session, audit, and failure-path tests. |
| Transactional email | Resend configuration and operational guidance are documented. | Verify the sending domain and production sender; test verification, password reset, invitation, and support notification delivery to monitored inboxes. See the [transactional email runbook](phase3-23-resend-transactional-email.md). |
| Monitoring and incidents | Health/readiness endpoints, metrics, and operational scripts are in the repository. | Verify probes and alerts reach the deployed service, alert delivery works, logs are redacted, incident ownership is clear, and rollback/recovery procedures are exercised. |
| Release integrity | CI workflows, dependency/security checks, and release guidance are maintained. | Confirm required checks pass on the exact release commit, review access and approval controls for `main`, and retain the release/rollback evidence. |
| External security review | Threat model and adversarial verification guidance are available. | Complete the scoped multi-tenant acceptance campaign and independent security assessment; record findings and remediation. Do not imply compliance certification from an evidence PDF or CI result. |

## Release decision

A release is accepted only when every applicable gate above has recorded evidence for the exact deployed version and environment. Any blocked or unverified item remains **not passed**.

Repository CI is necessary, but it cannot prove provider approval, live payment behavior, public DNS/TLS, customer email delivery, database recovery, or security properties of a deployment that has not been tested.
