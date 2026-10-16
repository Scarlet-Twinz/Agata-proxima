# Phase 55 — Production Deployment Runbook

## Canonical topology

Internet
  |
HTTPS
  v
Agata Proxima Control Plane
  |
  +--> Control PostgreSQL
  +--> Flutterwave Billing
  +--> Resend
  +--> Microsoft Entra ID (SSO, after external acceptance)
  +--> Proxima Engine nodes
          |
          v
      Customer PostgreSQL

The Control Plane is management infrastructure. A running Engine remains the data-plane enforcement authority if the Control Plane is unavailable.

## Required production environment

Use a deployment secret store, not a committed `.env` file. Do not paste secret values into chat or commit them to Git.

### Control Plane

- `PROXIMA_CONTROL_DATABASE_URL`
- `PROXIMA_COOKIE_SECURE=true`
- `AGATA_PUBLIC_BASE_URL=https://<your-public-control-plane-host>`
- `PROXIMA_NODE_ENROLLMENT_ENCRYPTION_KEY` — 32 random bytes encoded as 64 hexadecimal characters; required to encrypt node signing credentials at rest.

### Flutterwave Billing

- `FLUTTERWAVE_SECRET_KEY`
- `FLUTTERWAVE_WEBHOOK_SECRET_HASH` — expected value of Flutterwave's `verif-hash` webhook header.
- `FLUTTERWAVE_ENVIRONMENT=production`
- `FLUTTERWAVE_STARTER_PLAN_ID`
- `FLUTTERWAVE_GROWTH_PLAN_ID`
- `FLUTTERWAVE_SCALE_PLAN_ID`
- `FLUTTERWAVE_STARTER_AMOUNT_USD=149`
- `FLUTTERWAVE_GROWTH_AMOUNT_USD=499`
- `FLUTTERWAVE_SCALE_AMOUNT_USD=1199`

Configure three distinct numeric plan IDs. The server-side catalogue is Free $0, Starter $149/month, Growth $499/month, Scale $1,199/month and Enterprise custom. The Control Plane validates the configured amounts and checks the provider transaction currency and amount before applying entitlements. Confirm that the actual hosted checkout returns USD and the expected amount; do not assume display currency and charge currency are interchangeable. Configure the webhook at `https://<api-host>/api/v1/webhooks/flutterwave` and validate `verif-hash`, transaction-reference checks and duplicate-event handling in the target environment. The billing portal endpoint currently returns a support message instead of a self-service portal.

### Resend email

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

Use an Agata-owned sending domain and verify its DNS records before relying on production delivery.

### Microsoft Entra OIDC

- `PROXIMA_OIDC_CLIENT_ID`
- `PROXIMA_OIDC_CLIENT_SECRET`

Do not mark SSO live until the multitenant Entra application, exact production HTTPS callback, organization mapping and a real end-to-end sign-in have been verified.

## Preflight

- HTTPS terminates correctly and secure cookies are enabled.
- Control Plane health/readiness endpoints are reachable.
- Database migrations are applied in order and schema state is verified without destructive resets.
- Flutterwave plan IDs are distinct and configured amounts match the canonical catalogue.
- Flutterwave checkout returns USD with the expected amount, and webhook hash/transaction verification succeeds.
- Resend sending domain is verified and a real delivery test succeeds.
- Entra redirect URI exactly matches the production callback before SSO is enabled.
- Backups exist and a restore has been exercised with measured RPO/RTO.
- Centralized metrics, alerting and rollback procedures are tested.
- External SaaS tenant-isolation acceptance is run against the deployed service.

## Launch rule

Do not point customers at the deployment until the production acceptance checklist is green. Repository CI is necessary but is not a substitute for live payment, identity, email, backup/restore and external SaaS acceptance.
