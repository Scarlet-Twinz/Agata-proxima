# Agata Proxima Developer Guide

Agata Proxima exposes a versioned control-plane API under `/api/v1`. The Command Center is a client of that API; it is not the authority for tenant isolation.

## Core integration model

```
Customer application
        |
        v
Proxima Engine
        |
        v
PostgreSQL
```

The control plane manages identity, organization membership, policies, nodes, deployments, verification evidence, audit history, billing state, and support requests.

The Engine remains authoritative for the data-plane security boundary. Losing access to the control plane must not turn tenant enforcement off.

## Authentication

Password authentication uses:

- `POST /api/v1/auth/signup`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `GET /api/v1/session`

State-changing requests require the CSRF token returned by the session endpoint in the `x-csrf-token` header.

Microsoft Entra OIDC is exposed through:

- `POST /api/v1/organization/oidc/entra`
- `GET /api/v1/auth/oidc/start`
- `GET /api/v1/auth/oidc/callback`

## Organization and team access

Team membership is organization-scoped.

- `GET /api/v1/organization/team` — current members and roles.
- `GET /api/v1/organization/invitations` — pending and accepted invitations.
- `POST /api/v1/organization/invitations` — create or refresh an invitation.
- `DELETE /api/v1/organization/invitations/:id` — revoke a pending invitation.

Supported invitation roles are `admin`, `operator`, and `viewer`. Invitations expire after seven days and are accepted only by the signed-in user whose email matches the invitation.

## Customer lifecycle

The customer-facing lifecycle is explicit rather than implicit:

1. `GET/POST /api/v1/projects` — create or inspect a customer application boundary.
2. `GET/POST /api/v1/projects/:id/environments` — manage development, staging, and production environments.
3. `GET/POST /api/v1/integrations` — register the Engine, SDK, or Proxy integration mode for a project.
4. `GET/POST /api/v1/tenants` — create and inspect project tenants. Tenant creation accepts an explicit `project_id`; when an organization has multiple projects, the project must be selected explicitly.
5. `GET/POST /api/v1/verifications` — record verification evidence.
6. `GET /api/v1/audit` — inspect organization-scoped evidence and administrative history.

The integration registration endpoint intentionally starts an installation in `pending` state. It does not pretend that an external database has been verified. The production promotion gate requires the actual external SaaS acceptance run described in `docs/customer-integration.md`.

## Platform resources

- `GET/POST /api/v1/organizations`
- `GET/POST /api/v1/tenants`
- `GET/POST /api/v1/policies`
- `GET/POST /api/v1/nodes`
- `GET/POST /api/v1/deployments`
- `GET/POST /api/v1/verifications`
- `GET /api/v1/audit`
- `GET/POST /api/v1/support`

## Billing

Billing and entitlements are server-authoritative:

- `GET /api/v1/billing`
- `GET /api/v1/billing/plans`
- `GET /api/v1/billing/entitlements`
- `POST /api/v1/billing/checkout`
- `POST /api/v1/billing/portal`

Billing provider implementation is a Phase 3B concern. Phase 3A exposes only the server-authoritative entitlement/read model; Paystack checkout, webhook processing, billing logs and provider-specific automation are intentionally implemented in Phase 3B.

## Verification and audit

Verification results are stored as evidence, not as cosmetic status. The control plane records submitted results and administrative events while the Engine continues to enforce the data-plane boundary independently.

## OpenAPI

The repository contract is available at `control-plane/openapi.json` and is exposed locally by the Command Center at `/docs/openapi.json`.

## Production rule

Do not put secrets in the browser bundle or source repository. Configure production credentials through the deployment environment and keep the Engine, control plane, PostgreSQL, and external integrations on their documented security boundaries.
