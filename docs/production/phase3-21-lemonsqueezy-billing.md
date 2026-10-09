# Phase 3.21 — Lemon Squeezy Billing

## Active provider contract

Lemon Squeezy is the active self-service billing integration. Historical migration files remain immutable; the forward migration `0017_lemonsqueezy_billing.sql` adds provider identifiers while preserving prior transaction/event records.

- Checkout: `POST /api/v1/billing/checkout`
- Plan catalogue: `GET /api/v1/billing/plans`
- Billing status: `GET /api/v1/billing`
- Entitlements: `GET /api/v1/billing/entitlements`
- Customer portal: `POST /api/v1/billing/portal`
- Local checkout status: `GET /api/v1/billing/verify?reference=...`
- Webhook: `POST /api/v1/webhooks/lemonsqueezy`

## Environment

Set these values only in the Control Plane's server-side environment:

- `LEMONSQUEEZY_API_KEY`
- `LEMONSQUEEZY_STORE_ID`
- `LEMONSQUEEZY_STARTER_VARIANT_ID`
- `LEMONSQUEEZY_GROWTH_VARIANT_ID`
- `LEMONSQUEEZY_SCALE_VARIANT_ID`
- `LEMONSQUEEZY_WEBHOOK_SECRET`

Keep the existing Resend and Microsoft Entra variables. Do not overwrite the user's existing `.env`; add only missing variables after pulling and reviewing the diff. Never commit or paste API keys or webhook secrets into chat.

## Product mapping

| Agata plan | Price | Interval | Configuration |
|---|---:|---|---|
| Starter | USD $149 | Monthly | `LEMONSQUEEZY_STARTER_VARIANT_ID` |
| Growth | USD $499 | Monthly | `LEMONSQUEEZY_GROWTH_VARIANT_ID` |
| Scale | USD $1,199 | Monthly | `LEMONSQUEEZY_SCALE_VARIANT_ID` |

The three variant IDs must be present and distinct before checkout is enabled. Free and Enterprise do not use self-service checkout.

## Webhook safety

The handler validates the exact raw request body against the hex-encoded HMAC-SHA256 in `X-Signature`. It tracks event deliveries and ignores duplicate processed deliveries. Browser return URLs do not grant entitlements. Subscription events are expected to carry `meta.custom_data.organization_id` from checkout; events that cannot be tied to an organization are ignored rather than granting access.

## Acceptance checklist

1. Configure Test Mode credentials and three monthly USD test variants.
2. Create a Test Mode webhook for subscription create/update/cancel/resume/expire and payment success/failure events.
3. Verify checkout URL creation and exact organization/plan metadata.
4. Send valid, invalid, malformed, duplicate and unknown-organization webhook fixtures.
5. Verify active, past-due/grace, cancelled and expired entitlement transitions.
6. Verify customer portal URL handling and that browser redirects alone never grant access.
7. Run the Rust suite, clippy, migration checks, OpenAPI validation and repository launch gates.
8. Only after these checks pass, pull the branch and run local Test Mode acceptance.

## Current boundary

This work is not deployed and has no live credentials. A green CI suite validates repository behavior, not the actual Lemon Squeezy account, store configuration, or real provider delivery. Those require Test Mode acceptance after the owner creates the store products and webhook.
