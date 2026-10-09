# Phase 55 — Production Deployment Runbook

## Canonical topology

Internet
  |
HTTPS
  v
Agata Proxima Control Plane
  |
  +--> Control PostgreSQL
  +--> Lemon Squeezy
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

### Lemon Squeezy billing

- `LEMONSQUEEZY_API_KEY`
- `LEMONSQUEEZY_STARTER_VARIANT_ID`
- `LEMONSQUEEZY_GROWTH_VARIANT_ID`
- `LEMONSQUEEZY_SCALE_VARIANT_ID`

Set `AGATA_PUBLIC_BASE_URL` to the browser-facing app origin. In production, route `/api/v1/*`, the OIDC callback and health/readiness endpoints from that origin to the Rust Control Plane (for example, through a same-origin reverse proxy). The OIDC callback sets a host-only session cookie and redirects to `/app`; a separate frontend/backend origin without an explicit cookie/proxy design will break sign-in.

Before enabling checkout, verify that the configured Lemon Squeezy plans are Agata Proxima plans with the canonical monthly prices:

- Starter — $149/month
- Growth — $499/month
- Scale — $1,199/month

Free has no Lemon Squeezy subscription. Enterprise is contract-managed. Configure the production Lemon Squeezy webhook endpoint to the route implemented by the Control Plane, and verify the provider signature and event processing with a real payment round trip. Do not assume a successful CI run proves live provider configuration.

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
- Lemon Squeezy plan codes and amounts match the canonical catalogue.
- The Lemon Squeezy webhook endpoint is reachable and signature verification passes.
- Resend sending domain is verified and a real delivery test succeeds.
- Entra redirect URI exactly matches the production callback before SSO is enabled.
- Backups exist and a restore has been exercised with measured RPO/RTO.
- Centralized metrics, alerting and rollback procedures are tested.
- External SaaS tenant-isolation acceptance is run against the deployed service.

## Launch rule

Do not point customers at the deployment until the production acceptance checklist is green. Repository CI is necessary but is not a substitute for live payment, identity, email, backup/restore and external SaaS acceptance.
