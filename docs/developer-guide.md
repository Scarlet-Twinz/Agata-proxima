# Agata Proxima Developer Guide

Agata Proxima exposes a versioned Control Plane API under `/api/v1`. The Command Center is a client of that API; it is not the authority for tenant isolation.

## Core integration model

```text
Customer application → Proxima Engine → PostgreSQL
                ↘ Control Plane for management and evidence
```

The Control Plane manages identity, organization membership, tenants, policies, nodes, deployments, verification evidence, audit history, billing state and support requests. The Engine remains authoritative for the data-plane security boundary. Losing access to the Control Plane must not turn tenant enforcement off.

## Authentication and CSRF

Password authentication uses:

- `POST /api/v1/auth/signup`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `GET /api/v1/session`

State-changing requests require the current CSRF token in the `x-csrf-token` header. Session cookies are HTTP-only; never copy them into source control or logs.

## Organization and team access

- `GET /api/v1/organization/team` — current members and roles.
- `GET /api/v1/organization/invitations` — pending and accepted invitations.
- `POST /api/v1/organization/invitations` — create or refresh an invitation.
- `DELETE /api/v1/organization/invitations/{id}` — revoke a pending invitation.

Invitation requests use `organization_id`, `email`, and an optional role. Invitations expire after seven days and are accepted only by the signed-in user whose email matches the invitation. Team-seat enforcement counts active memberships plus unexpired pending invitations.

## Platform resources

- `GET/POST /api/v1/organizations`
- `GET/POST /api/v1/tenants`
- `GET/POST /api/v1/policies`
- `GET/POST /api/v1/nodes`
- `GET/POST /api/v1/deployments`
- `GET/POST /api/v1/verifications`
- `GET /api/v1/audit`
- `GET/POST /api/v1/support`

The request shapes and end-to-end workflow are documented in [usage.md](usage.md). Node bootstrap has a dedicated [Secure Node Enrollment guide](node-enrollment.md), including one-time token lifecycle, process environment variables, identity persistence and recovery. The machine-readable API contract is at `control-plane/openapi.json` and is exposed locally at `/docs/openapi.json`.

## Developer resources

- `GET/POST /api/v1/developer/api-keys`
- `DELETE /api/v1/developer/api-keys/{id}`
- `GET/POST /api/v1/developer/webhooks`
- `GET/DELETE /api/v1/developer/webhooks/{id}`
- `GET /api/v1/developer/webhooks/{id}/deliveries`

API keys are organization-scoped. Store newly issued credentials securely and revoke keys that are no longer needed. Webhook receivers should use HTTPS, verify the signing contract, tolerate retries and avoid treating a delivery as an exactly-once transport.

## Billing — Flutterwave

Flutterwave is the configured billing provider in the current Control Plane implementation. Server-authoritative endpoints are:

- `GET /api/v1/billing`
- `GET /api/v1/billing/plans`
- `GET /api/v1/billing/entitlements`
- `POST /api/v1/billing/checkout`
- `POST /api/v1/billing/portal` — currently returns a support message rather than a self-service portal.
- `GET /api/v1/billing/verify?reference=...&transaction_id=...`
- `POST /api/v1/webhooks/flutterwave`

The catalogue is Free $0, Starter $149/month, Growth $499/month, Scale $1,199/month and Enterprise custom. Configure `FLUTTERWAVE_SECRET_KEY`, `FLUTTERWAVE_WEBHOOK_SECRET_HASH`, `FLUTTERWAVE_ENVIRONMENT=production`, `FLUTTERWAVE_STARTER_PLAN_ID`, `FLUTTERWAVE_GROWTH_PLAN_ID`, `FLUTTERWAVE_SCALE_PLAN_ID`, and the three `FLUTTERWAVE_*_AMOUNT_USD` values in the Control Plane secret store.

The server verifies the provider transaction, local reference, amount and USD currency before applying entitlements. Webhook requests are checked against `verif-hash` and duplicate event handling is idempotent. Do not treat a browser return as proof of payment. See [the Flutterwave billing runbook](production/flutterwave-billing.md) for the full configuration contract and checklist.

## Microsoft Entra SSO

OIDC routes are:

- `POST /api/v1/organization/oidc/entra` — organization owner/admin configures the expected Entra tenant.
- `GET /api/v1/auth/oidc/start?organization_id=<uuid>` — starts the authorization flow.
- `GET /api/v1/auth/oidc/callback` — handles the registered redirect.

Create the multitenant Web app in Microsoft Entra ID, register the exact HTTPS callback, configure `PROXIMA_OIDC_CLIENT_ID`, `PROXIMA_OIDC_CLIENT_SECRET` and `AGATA_PUBLIC_BASE_URL`, then test real tenant mapping and session creation. The login button remains disabled until that end-to-end acceptance is complete. See [the Entra SSO runbook](identity/microsoft-entra-oidc.md).

## Verification and operations

Verification results are evidence, not cosmetic status. Use `docs/verification.md` for the RLS and adversarial verification model, and `docs/production/operational-readiness-runbook.md` for health checks, backups, restore drills, monitoring and incident response.

## Production rule

Do not put secrets in the browser bundle or source repository. Use a deployment secret store, a managed production database, HTTPS, verified provider webhooks and tested backup/restore. Never infer production readiness from the existence of code or a passing local test alone.
