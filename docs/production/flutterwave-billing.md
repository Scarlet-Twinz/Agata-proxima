# Flutterwave Billing Integration

Status: **implemented in the repository; not yet live-accepted**. Account approval, live credentials, plan configuration, currency behavior, and a real end-to-end payment/webhook round trip remain separate acceptance gates.

## Runtime configuration contract

Configure these variables in the deployment secret store for the Control Plane:

- `FLUTTERWAVE_SECRET_KEY` — server-side Flutterwave API secret.
- `FLUTTERWAVE_WEBHOOK_SECRET_HASH` — expected value of the Flutterwave `verif-hash` header.
- `FLUTTERWAVE_ENVIRONMENT=production` — enables live checkout; the backend fails closed when this is not production.
- `FLUTTERWAVE_STARTER_PLAN_ID`, `FLUTTERWAVE_GROWTH_PLAN_ID`, `FLUTTERWAVE_SCALE_PLAN_ID` — distinct numeric provider plan IDs.
- `FLUTTERWAVE_STARTER_AMOUNT_USD`, `FLUTTERWAVE_GROWTH_AMOUNT_USD`, `FLUTTERWAVE_SCALE_AMOUNT_USD` — configured plan amounts used by the server-side verification contract.

Do not commit these values, store them in tracked environment examples, or paste them into chat. Use the deployment secret store.

## Checkout and verification boundary

1. An authenticated organization owner/admin requests checkout for a named plan.
2. The Control Plane checks that the provider is enabled, plan IDs are present and unique, and configured amounts are available.
3. The server creates a hosted checkout and returns the secure `checkout_url`; the UI redirects to that URL.
4. The browser return is not proof of payment. The server verifies the transaction against Flutterwave and the locally stored reference before updating billing state and entitlements.
5. The webhook requires the configured `verif-hash`, resolves the local transaction reference, verifies the provider transaction, and uses the billing-event record to handle duplicate delivery idempotently.

The webhook route is:

`https://<approved-api-domain>/api/v1/webhooks/flutterwave`

The billing portal endpoint currently returns `501 Not Implemented` with a support message; do not describe a self-service customer portal as available until it is implemented and tested.

## Currency acceptance blocker

The backend expects the provider transaction currency to be `USD` and verifies the exact configured amount. Confirm that the actual Flutterwave live checkout returns USD and the expected amount before paid checkout is enabled. If the account or hosted checkout returns NGN instead, stop and reconcile the provider configuration; do not assume displayed price, charge currency, and settlement currency are interchangeable.

## Acceptance checklist

- [ ] Live Flutterwave account and business details are approved.
- [ ] The secret key and webhook hash are stored in the deployment secret store.
- [ ] All three plan IDs are distinct and all three configured amounts are verified.
- [ ] The real hosted checkout response has the expected currency and exact amount.
- [ ] A successful payment is verified server-side before entitlements change.
- [ ] Invalid webhook hashes are rejected.
- [ ] Duplicate webhook delivery is handled idempotently.
- [ ] Failed, unknown-reference, and mismatched-amount transactions do not grant entitlements.
- [ ] The dashboard and backend UI describe the same provider and currency behavior.
- [ ] Billing portal limitations are communicated accurately.
- [ ] Production readiness is rechecked after all runtime values are configured.

No account approval, provider configuration, deployment, or live charge is performed by these repository changes.