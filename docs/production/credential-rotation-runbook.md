# Production credential rotation runbook

This is an execution plan, not proof that rotation has been performed. Run each rotation in the selected provider's secret store, never in Git, frontend build variables, issue comments or chat. Record the operator, time, affected services, verification and rollback decision without recording secret values.

## General controls

1. Identify the exact credential and every service that consumes it.
2. Confirm a recent database backup and a known-good deployment/release before rotating a production credential.
3. Prefer overlapping credentials where the provider and application support them. Do not revoke the old value until the new value has passed its smoke check.
4. Update the deployment secret store, restart/redeploy only the affected service, and verify health, readiness and the relevant authenticated integration.
5. If the new credential fails, restore the previous value only while it remains valid; then diagnose and retry. If the old value has been exposed, do not restore it—issue another new credential.
6. Revoke the old credential after successful verification and check provider activity/logs for unexpected use.
7. Record timestamps and evidence. Never include secret values in the record.

## Credential-specific procedure

### Managed PostgreSQL

- Create or rotate the production database login using the provider's supported overlap strategy (for example, a second restricted login if the provider permits it).
- Update `PROXIMA_CONTROL_DATABASE_URL` in the backend secret store and redeploy/restart the Control Plane.
- Verify `/api/v1/health`, `/api/v1/production/readiness`, a read-only authenticated request, and migration status.
- Revoke the previous database login only after verification. Do not rotate production database credentials by editing committed files or resetting the database.

### Session, tenant-context and signing keys

- Identify whether the credential is `PROXIMA_TENANT_SIGNING_KEY`, `PROXIMA_CONTEXT_SIGNING_KEY`, or a session/token signing secret, and identify all verifiers before changing it.
- Determine whether the implementation supports a dual-key transition. If it does not, schedule a controlled maintenance window and plan for affected sessions/tokens to expire or be reissued.
- Do not assume changing a key is transparent. Verify valid tokens, expired tokens, rejected old tokens, tenant A/B isolation and audit events before declaring rotation complete.

### Paddle Live API key and notification destination secret

- Issue a replacement Live API key with only the permissions required by the billing integration.
- Update `PADDLE_API_KEY` in the backend secret store and verify Live price preflight, checkout readiness and customer-portal access without creating an unintended charge.
- Rotate the notification destination secret in Paddle and update `PADDLE_WEBHOOK_SECRET` as one coordinated change. Verify a legitimate signed event is accepted and invalid/old signatures are rejected.
- Confirm duplicate-event idempotency and that no entitlement is granted from an invalid webhook. Revoke the previous API key/secret only after the coordinated verification succeeds.

### Resend API key

- Create a replacement key with the minimum required sending scope.
- Update `RESEND_API_KEY`, send a controlled verification/support notification, and confirm provider delivery status and arrival at the monitored inbox.
- Revoke the old key after the delivery check succeeds. Do not treat a successful send request as proof that an inbox received the message.

### Microsoft Entra client secret

- Create a new client secret in the Entra app registration and store its **Value** in the backend secret store as `PROXIMA_OIDC_CLIENT_SECRET`; never use the secret's ID.
- Verify the exact redirect URI and perform a real login, callback/state/nonce validation, session creation and organization mapping.
- Revoke the old secret after the end-to-end login passes. Keep the client ID unchanged unless an app-registration migration is intentionally planned.

## Completion record

For each rotation, record:

- Credential category and affected environment (never its value).
- Rotation start/end time and responsible operator.
- Pre-rotation backup/release reference where applicable.
- Health/readiness and integration-specific verification evidence.
- Rollback decision and whether the old credential was revoked.
- Any sessions, tokens or customers that required re-authorization.

A runbook existing in source control is not a completed rotation. Mark the rotation checkpoint passed only after each production credential category has been exercised and the evidence is recorded.
