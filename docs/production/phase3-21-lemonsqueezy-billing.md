# Phase 3.21 — Lemon Squeezy billing provider

## Scope

The active Control Plane billing routes use Lemon Squeezy for hosted checkout, subscription management, status, verification, and signed webhooks. The provider is configured through server-side environment variables; never expose its API key or webhook signing secret to the browser.

The monthly self-service catalog is fixed at Starter USD 149, Growth USD 499, and Scale USD 1,199. Checkout must refuse to proceed when the configured provider variant does not match the corresponding monthly price.

## Environment

Set these values in the existing local environment file used by the Control Plane:

- `LEMONSQUEEZY_API_KEY`: API key for the intended Lemon Squeezy mode.
- `LEMONSQUEEZY_STORE_ID`: store ID belonging to that same mode.
- `LEMONSQUEEZY_STARTER_VARIANT_ID`, `LEMONSQUEEZY_GROWTH_VARIANT_ID`, `LEMONSQUEEZY_SCALE_VARIANT_ID`: three distinct monthly subscription variant IDs.
- `LEMONSQUEEZY_WEBHOOK_SECRET`: signing secret from the webhook endpoint configuration.

Keep the existing Resend and Microsoft Entra values in place. Do not overwrite the environment file with `.env.example`; it is a template only. Do not commit local environment files or paste secrets into tickets/chat.

## Routes

- `GET /api/v1/billing` and `GET /api/v1/billing/status`: current organization's billing account.
- `GET /api/v1/billing/plans`: public plan catalog and checkout availability.
- `POST /api/v1/billing/checkout`: creates a hosted checkout for an authenticated organization administrator.
- `POST /api/v1/billing/portal`: fetches the current subscription's customer portal URL.
- `GET /api/v1/billing/verify?reference=...`: reads local transaction status. It does not itself grant entitlements.
- `POST /api/v1/webhooks/lemonsqueezy`: validates the exact request body using HMAC-SHA256 and `X-Signature`, deduplicates provider events, and updates subscription state.

## Data preservation

Migration `0017_lemonsqueezy_billing.sql` is forward-only. It adds Lemon Squeezy identifiers and updates defaults for new provider records; it does not rewrite or delete historic provider transactions, events, or earlier migration files.

## Verification boundaries

The CI contract and automated unit tests do not prove that an actual Lemon Squeezy store, variant, webhook, or checkout is configured correctly. Before any live payment activation, use test mode and verify all three variant IDs, monthly prices, checkout return, signed event delivery, duplicate delivery, cancellation, failed renewal, and entitlement updates. No deployment or live payment enablement is part of this phase's repository work.
