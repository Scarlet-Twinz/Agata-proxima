# Agata Proxima — Phases 41–50

This release moved the platform from a private-beta foundation into production-oriented identity, commercial, integration and operational contracts. This is a historical phase record. Its provider-specific billing section is superseded by the current Paddle Live integration documented in `docs/production/paddle-billing.md`.

## Phase gates

| Phase | Gate | Repository status |
|---|---|---|
| 41 | Production identity, verification, password reset, invitations | Implemented |
| 42 | Secret/configuration boundary | Implemented |
| 43 | Transactional email integration | Implemented |
| 44 | Production billing integration | Billing foundation implemented; current provider is Paddle Live |
| 45 | Billing webhook idempotency and entitlement state | Repository lifecycle and idempotency gates implemented |
| 46 | Customer onboarding/integration contract | Implemented |
| 47 | Operational readiness endpoint and CI gates | Implemented |
| 48 | Commercial Command Center surface | Implemented |
| 49 | Disaster/release documentation | Implemented |
| 50 | Final production acceptance gate | CI + configuration gate; external acceptance remains separate |

## Resend

The Control Plane has a direct Resend REST integration for email verification, password reset and organization invitations.

Production configuration uses `RESEND_API_KEY`, `RESEND_FROM_EMAIL` and `AGATA_PUBLIC_BASE_URL`. Missing credentials fail safely rather than becoming a hidden dependency. Live delivery still requires the Agata-owned sending domain to be verified.

## Current billing provider: Paddle Live

Paddle is the only active billing provider. The Control Plane targets Paddle's Live API; Sandbox routing is intentionally unsupported. The current provider contract is documented in [Paddle Billing](production/paddle-billing.md).

Configure these variables in the production secret store:

- `PADDLE_API_KEY`
- `PADDLE_CLIENT_TOKEN`
- `PADDLE_WEBHOOK_SECRET`
- `PADDLE_ENVIRONMENT=production`
- `PADDLE_STARTER_PRICE_ID`
- `PADDLE_GROWTH_PRICE_ID`
- `PADDLE_SCALE_PRICE_ID`

The canonical monthly prices are Starter **$149**, Growth **$499**, and Scale **$1,199**. Free requires no provider subscription; Enterprise is contract-managed. Each configured `pri_...` price must be active, recurring monthly, USD, match the exact plan amount, and be unique. Checkout remains unavailable until approved Live credentials, prices, and the notification destination are configured. A repository configuration example is not evidence that live payment acceptance has passed.

## Identity

The platform has verified-email lifecycle, password reset lifecycle, organization invitations and role-aware invitation acceptance. Microsoft Entra OIDC has repository implementation and configuration contracts, but it is not marked live until production app registration, credentials, the exact HTTPS callback and an end-to-end sign-in test have passed.

## Security boundary

Billing, identity, audit and the Control Plane remain management-plane concerns. The Proxima Engine remains authoritative for tenant enforcement.

## Final acceptance

Repository CI must pass formatting, workspace check, workspace tests, Clippy with warnings denied, RLS verification, migration verification, OpenAPI validation, operational script syntax, production environment contract checks and the Phase 3.22-A–H entitlement gates.

External production gates remain explicit: Paddle Live account/domain approval, price validation and signed webhook delivery, real SSO provider acceptance, production secret management, public deployment URL, backup/restore drill, centralized observability, independent security assessment and a real external SaaS attack/acceptance run.
