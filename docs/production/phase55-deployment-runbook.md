# Phase 55 — Production Deployment Runbook

## Canonical topology

Internet
  |
HTTPS
  v
Agata Proxima Control Plane
  |
  +--> Control PostgreSQL
  +--> Paystack
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

### Paystack billing

- `PAYSTACK_SECRET_KEY`
- `AGATA_PAYSTACK_STARTER_PLAN_CODE`
- `AGATA_PAYSTACK_GROWTH_PLAN_CODE`
- `AGATA_PAYSTACK_SCALE_PLAN_CODE`

Before enabling checkout, verify that the configured Paystack plans are Agata Proxima plans with the canonical monthly prices:

- Starter — $149/month
- Growth — $499/month
- Scale — $1,199/month

Free has no Paystack subscription. Enterprise is contract-managed. Configure the production Paystack webhook endpoint to the route implemented by the Control Plane, and verify the provider signature and event processing with a real payment round trip. Do not assume a successful CI run proves live provider configuration.

### Resend email

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

Use an Agata-owned sending domain and verify its DNS records before relying on production delivery.

### Microsoft Entra OIDC

- `PROXIMA_OIDC_ISSUER`
- `PROXIMA_OIDC_CLIENT_ID`
- `PROXIMA_OIDC_CLIENT_SECRET`

Do not mark SSO live until the multitenant Entra application, exact production HTTPS callback, organization mapping and a real end-to-end sign-in have been verified.

## Preflight

- HTTPS terminates correctly and secure cookies are enabled.
- Control Plane health/readiness endpoints are reachable.
- Database migrations are applied in order and schema state is verified without destructive resets.
- Paystack plan codes and amounts match the canonical catalogue.
- The Paystack webhook endpoint is reachable and signature verification passes.
- Resend sending domain is verified and a real delivery test succeeds.
- Entra redirect URI exactly matches the production callback before SSO is enabled.
- Backups exist and a restore has been exercised with measured RPO/RTO.
- Centralized metrics, alerting and rollback procedures are tested.
- External SaaS tenant-isolation acceptance is run against the deployed service.

## Launch rule

Do not point customers at the deployment until the production acceptance checklist is green. Repository CI is necessary but is not a substitute for live payment, identity, email, backup/restore and external SaaS acceptance.
