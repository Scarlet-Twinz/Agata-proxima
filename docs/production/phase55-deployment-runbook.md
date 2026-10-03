# Phase 55 — Production Deployment Runbook

## Canonical topology

Internet
  |
HTTPS
  v
Agata Proxima Control Plane
  |
  +--> Control PostgreSQL
  +--> Stripe
  +--> Resend
  +--> Microsoft Entra ID
  +--> Proxima Engine nodes
          |
          v
      Customer PostgreSQL

The Control Plane is management infrastructure. A running Engine remains the data-plane enforcement authority if the Control Plane is unavailable.

## Required production environment
Use a deployment secret store, not a committed .env file.

Required groups:
- PROXIMA_CONTROL_DATABASE_URL
- PROXIMA_COOKIE_SECURE=true
- AGATA_PUBLIC_BASE_URL=https://...
- STRIPE_SECRET_KEY
- AGATA_STRIPE_STARTER_PRICE_ID
- AGATA_STRIPE_GROWTH_PRICE_ID
- AGATA_STRIPE_SCALE_PRICE_ID
- STRIPE_WEBHOOK_SECRET
- RESEND_API_KEY
- RESEND_FROM_EMAIL
- PROXIMA_OIDC_ISSUER
- PROXIMA_OIDC_CLIENT_ID
- PROXIMA_OIDC_CLIENT_SECRET

## Preflight
- HTTPS terminates correctly.
- Secure cookies are enabled.
- Control Plane health endpoint is reachable.
- Database migrations complete.
- Stripe webhook endpoint is reachable.
- Resend domain is verified.
- Entra redirect URI exactly matches the public callback.
- Backups exist and a restore has been exercised.

## Launch rule
Do not point customers at the deployment until the production acceptance checklist is green.
