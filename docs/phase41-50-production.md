# Agata Proxima — Phases 41–50

This release moves the platform from a strong private-beta foundation into production-oriented identity, commercial, integration and operational contracts.

## Phase gates

| Phase | Gate | State |
|---|---|---|
| 41 | Production identity, verification, password reset, invitations | Implemented |
| 42 | Secret/configuration boundary | Implemented |
| 43 | Transactional email integration | Implemented |
| 44 | Production billing integration | Implemented |
| 45 | Billing webhook idempotency and entitlement state | Implemented |
| 46 | Customer onboarding/integration contract | Implemented |
| 47 | Operational readiness endpoint and CI gates | Implemented |
| 48 | Commercial Command Center surface | Implemented |
| 49 | Disaster/release documentation | Implemented |
| 50 | Final production acceptance gate | CI + configuration gate |

## Resend
The Control Plane now has a direct Resend REST integration for email verification, password reset and organization invitations.

Production configuration uses RESEND_API_KEY, RESEND_FROM_EMAIL and AGATA_PUBLIC_BASE_URL. Missing credentials fail safely rather than becoming a hidden dependency.

## Stripe
The Control Plane now supports Stripe-hosted subscription Checkout, Customer Portal, organization-linked Stripe customers, signed webhook verification, webhook idempotency and billing state synchronization.

The repository deliberately does not invent a commercial price. AGATA_STRIPE_PRICE_ID must point to an Agata-specific Stripe Price.

Existing products in the connected Stripe account are not reused automatically.

## Identity
The platform now has verified-email lifecycle, password reset lifecycle, organization invitations and role-aware invitation acceptance.

OIDC/SSO has a configuration/readiness contract. A real identity provider still has to be selected and its issuer/client credentials supplied before SSO can truthfully be marked live.

## Security boundary
Billing, identity, audit and the Control Plane remain management-plane concerns. The Proxima Engine remains authoritative for tenant enforcement.

## Final acceptance
Repository CI must pass format, workspace check, workspace tests, Clippy with warnings denied, RLS verification, both control-plane migrations, operational script syntax and production environment contract checks.

External production gates remain explicit: real SSO provider, production secret manager, public webhook URLs, real Agata Stripe Price, real deployment URL, backup/restore drill, centralized observability, independent security assessment and a real external SaaS attack/acceptance run.