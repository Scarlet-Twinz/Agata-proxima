# Phase 3.21 — Lemon Squeezy billing

## Purpose and boundaries

Lemon Squeezy is the active self-service billing provider for Agata Proxima. The public catalog remains Starter **$149/month**, Growth **$499/month**, and Scale **$1,199/month**. Free does not use checkout; Enterprise remains manually provisioned.

This phase is code and Test Mode readiness only. Do not enable live payments, deploy, change DNS, or merge this work until the required checks and business acceptance are complete.

## Server configuration

Configure these only in the Control Plane's secret/environment manager or local ignored environment file:

- `LEMON_SQUEEZY_API_KEY`: API key for the selected mode.
- `LEMON_SQUEEZY_STORE_ID`: numeric store ID matching the selected mode.
- `LEMON_SQUEEZY_STARTER_VARIANT_ID`, `LEMON_SQUEEZY_GROWTH_VARIANT_ID`, `LEMON_SQUEEZY_SCALE_VARIANT_ID`: distinct numeric variant IDs.
- `LEMON_SQUEEZY_WEBHOOK_SECRET`: webhook signing secret (not the API key).
- `LEMON_SQUEEZY_TEST_MODE=true`: keep true for initial integration tests.

Never commit secrets or paste them into chat. Test Mode and Live Mode use separate products, API keys, store data, and webhook configuration. Do not set Test Mode false until the live catalog and approval are independently confirmed.

## Product/variant contract

Create three monthly subscription variants in the Test Mode store:

| Agata plan | Expected price | Interval |
|---|---:|---|
| Starter | $149 USD | Monthly |
| Growth | $499 USD | Monthly |
| Scale | $1,199 USD | Monthly |

Checkout fails closed unless the selected variant's price, subscription interval, and test/live mode match the catalog and configuration. Never accept a client-supplied amount as authoritative.

## Webhook setup

After a public Control Plane is deployed and its route is independently reachable, configure the Test Mode webhook URL:

`https://api.agataproxima.com/api/v1/webhooks/lemonsqueezy`

Subscribe at minimum to:

- `subscription_created`
- `subscription_updated`
- `subscription_cancelled`
- `subscription_resumed`
- `subscription_expired`
- `subscription_payment_success`
- `subscription_payment_failed`
- `subscription_payment_recovered`
- `subscription_payment_refunded`

Use the same signing secret in `LEMON_SQUEEZY_WEBHOOK_SECRET`. The server validates the HMAC-SHA256 `X-Signature` over the exact raw request body before parsing the event. Store ID and Test/Live mode are checked before event processing. Duplicate delivery is recorded idempotently. Subscription events must map to an organization and one of the configured variants before paid entitlements are changed.

Do not create the webhook against the current production URL until the API is actually deployed; this repository change does not deploy anything.

## Acceptance checklist

- [ ] Test Mode API key and store ID are configured in a local ignored env file.
- [ ] Three unique monthly variants match the exact USD catalog.
- [ ] Valid raw-body signature is accepted; invalid signature is rejected.
- [ ] Wrong store and Test/Live mode mismatch are rejected.
- [ ] Duplicate webhook delivery does not duplicate billing events or repeat state changes.
- [ ] New subscription grants only the matching plan's entitlements.
- [ ] Failed payment, recovery, cancellation, and expiry produce the expected billing lifecycle.
- [ ] Unknown organization or unknown variant cannot grant paid entitlements.
- [ ] Customer portal is returned only for an existing Lemon Squeezy subscription.
- [ ] Resend billing notifications remain best-effort and do not block billing state updates.
- [ ] Rust format, check, test, clippy, frontend CI, and every repository launch gate pass on the final commit.

## Data and migration

Migration `0017_lemonsqueezy_billing.sql` adds Lemon Squeezy identifiers and makes it the default provider for new billing rows. Historical provider records and immutable historical migrations are retained for auditability; active application routes and environment contracts use Lemon Squeezy.

## Rollback / incident notes

Do not manually edit entitlements to mask a webhook failure. Inspect the local billing transaction and the stored signed event, correct the configuration or mapping, then replay/reconcile using the provider's supported tooling. Keep engine/control-plane authority boundaries intact.
