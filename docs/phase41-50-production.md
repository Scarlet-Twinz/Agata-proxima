# Agata Proxima — Phases 41–50

This release moved the platform from a private-beta foundation into production-oriented identity, commercial, integration and operational contracts. The provider-specific billing notes in this historical record are superseded by the Lemon Squeezy implementation and pricing contract in Phase 3.21.

## Phase gates

| Phase | Gate | Repository status |
|---|---|---|
| 41 | Production identity, verification, password reset, invitations | Implemented |
| 42 | Secret/configuration boundary | Implemented |
| 43 | Transactional email integration | Implemented |
| 44 | Production billing integration | Repository billing foundation implemented; provider later standardized on Lemon Squeezy |
| 45 | Billing webhook idempotency and entitlement state | Repository lifecycle and idempotency gates implemented |
| 46 | Customer onboarding/integration contract | Implemented |
| 47 | Operational readiness endpoint and CI gates | Implemented |
| 48 | Commercial Command Center surface | Implemented |
| 49 | Disaster/release documentation | Implemented |
| 50 | Final production acceptance gate | CI + configuration gate; external acceptance remains separate |

## Resend

The Control Plane has a direct Resend REST integration for email verification, password reset and organization invitations.

Production configuration uses `RESEND_API_KEY`, `RESEND_FROM_EMAIL` and `AGATA_PUBLIC_BASE_URL`. Missing credentials fail safely rather than becoming a hidden dependency. Live delivery still requires the Agata-owned sending domain to be verified.

## Current billing provider: Lemon Squeezy

Lemon Squeezy is the active provider for Agata Proxima. The current provider-specific integration and pricing contract is documented in Phase 3.21.

The Control Plane uses environment-configured Agata-specific Lemon Squeezy variant IDs:

- `LEMON_SQUEEZY_API_KEY`
- `LEMON_SQUEEZY_STORE_ID`
- `LEMON_SQUEEZY_WEBHOOK_SECRET`
- `LEMON_SQUEEZY_TEST_MODE=true` for initial acceptance
- `LEMON_SQUEEZY_STARTER_VARIANT_ID`
- `LEMON_SQUEEZY_GROWTH_VARIANT_ID`
- `LEMON_SQUEEZY_SCALE_VARIANT_ID`

The canonical monthly launch prices are Starter **$149**, Growth **$499**, and Scale **$1,199**. Free requires no provider subscription; Enterprise is contract-managed. The configured store must be USD; each variant must belong to that store, be published, be monthly, match the exact price, and match the configured Test/Live mode before checkout is enabled. Do not reuse unrelated products or accept a browser-supplied plan as proof of payment.

## Identity

The platform has verified-email lifecycle, password reset lifecycle, organization invitations and role-aware invitation acceptance. Microsoft Entra OIDC has repository implementation and configuration contracts, but it is not marked live until production app registration, credentials, the exact HTTPS callback and an end-to-end sign-in test have passed.

## Security boundary

Billing, identity, audit and the Control Plane remain management-plane concerns. The Proxima Engine remains authoritative for tenant enforcement.

## Final acceptance

Repository CI must pass formatting, workspace check, workspace tests, Clippy with warnings denied, RLS verification, migration verification, OpenAPI validation, operational script syntax, production environment contract checks and the Phase 3.22-A–H entitlement gates.

External production gates remain explicit: live Lemon Squeezy plan/code validation and webhook delivery, real SSO provider acceptance, production secret management, public deployment URL, backup/restore drill, centralized observability, independent security assessment and a real external SaaS attack/acceptance run.
