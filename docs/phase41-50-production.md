# Agata Proxima — Phases 41–50

This is a historical record of Phases 41–50. Provider-specific billing details from that phase are superseded by the current Flutterwave contract in [`docs/production/flutterwave-billing.md`](production/flutterwave-billing.md). Do not use legacy provider variables from historical phase notes for current deployments.

## Phase gates

| Phase | Gate | Repository status |
|---|---|---|
| 41 | Production identity, verification, password reset, invitations | Implemented |
| 42 | Secret/configuration boundary | Implemented |
| 43 | Transactional email integration | Implemented |
| 44 | Production billing integration | Billing foundation implemented; current provider is Flutterwave |
| 45 | Billing webhook idempotency and entitlement state | Repository lifecycle and idempotency gates implemented |
| 46 | Customer onboarding/integration contract | Implemented |
| 47 | Operational readiness endpoint and CI gates | Implemented |
| 48 | Commercial Command Center surface | Implemented |
| 49 | Disaster/release documentation | Implemented |
| 50 | Final production acceptance gate | CI + configuration gate; external acceptance remains separate |

## Resend

The Control Plane has a direct Resend REST integration for email verification, password reset and organization invitations.

Production configuration uses `RESEND_API_KEY`, `RESEND_FROM_EMAIL` and `AGATA_PUBLIC_BASE_URL`. Missing credentials fail safely rather than becoming a hidden dependency. Live delivery still requires the Agata-owned sending domain to be verified.

## Billing provider status

The provider used during the original phase has been superseded. **Flutterwave is the current billing integration.** Do not configure Paddle variables or `pri_...` price IDs for a current deployment.

Use [Flutterwave Billing](production/flutterwave-billing.md) for the current environment contract, distinct plan IDs, expected USD amounts, transaction verification, webhook hash validation, and live acceptance gates. The canonical monthly prices remain Starter **$149**, Growth **$499**, and Scale **$1,199**; Free requires no provider subscription and Enterprise is contract-managed.

Live billing remains unaccepted until the actual checkout currency and amount, transaction verification, webhook behavior, and entitlement transitions pass in the intended environment.

## Identity

The platform has verified-email lifecycle, password reset lifecycle, organization invitations and role-aware invitation acceptance. Microsoft Entra OIDC has repository implementation and configuration contracts, but it is not marked live until production app registration, credentials, the exact HTTPS callback and an end-to-end sign-in test have passed.

## Security boundary

Billing, identity, audit and the Control Plane remain management-plane concerns. The Proxima Engine remains authoritative for tenant enforcement.

## Final acceptance

Repository CI must pass formatting, workspace check, workspace tests, Clippy with warnings denied, RLS verification, migration verification, OpenAPI validation, operational script syntax, production environment contract checks and the Phase 3.22-A–H entitlement gates.

External production gates remain explicit: Flutterwave account approval, USD checkout and amount validation, transaction verification, and webhook hash validation, real SSO provider acceptance, production secret management, public deployment URL, backup/restore drill, centralized observability, independent security assessment and a real external SaaS attack/acceptance run.