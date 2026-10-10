# Paddle Billing Integration

Status: **implemented in the repository; not yet activated or deployed**. Paddle approval, the live checkout domain, credentials, price IDs, and end-to-end payment acceptance are separate gates.

## Environment contract

Configure these variables on the Control Plane:

- `PADDLE_API_KEY` — server API key with the transaction, price-read, and customer-portal permissions required by the integration.
- `PADDLE_CLIENT_TOKEN` — Paddle client-side token used by Paddle.js to open the transaction. It is a public client token, not the server API key.
- `PADDLE_WEBHOOK_SECRET` — secret generated for the Paddle notification destination. Do not reuse the API key.
- `PADDLE_STARTER_PRICE_ID`, `PADDLE_GROWTH_PRICE_ID`, `PADDLE_SCALE_PRICE_ID` — unique active recurring monthly price IDs. These must be `pri_...` IDs, not product IDs.
- `PADDLE_ENVIRONMENT=sandbox` for initial integration testing. Set `production` only after live account and checkout-domain approval.

The repository defaults to Sandbox if `PADDLE_ENVIRONMENT` is unset. Do not put real credentials in Git, issue comments, or chat messages.

## Catalog contract

Create one Paddle product for each paid plan and an active monthly USD recurring price:

| Plan | Expected monthly price | Required configuration |
|---|---:|---|
| Starter | $149/month | `PADDLE_STARTER_PRICE_ID` |
| Growth | $499/month | `PADDLE_GROWTH_PRICE_ID` |
| Scale | $1,199/month | `PADDLE_SCALE_PRICE_ID` |

The server fetches each selected price from the configured Paddle environment and fails closed unless the price is active, monthly, USD, and matches the corresponding configured amount. The three price IDs must be present and unique before self-service checkout is enabled. Free does not use checkout; Enterprise remains manually provisioned.

## Checkout and entitlement boundary

1. An authenticated organization owner/admin requests checkout for a named plan.
2. The Control Plane validates the configured price with Paddle and creates a transaction with organization, plan, and local checkout reference in `custom_data`.
3. The browser opens Paddle Checkout using the returned transaction ID and client-side token.
4. Paid entitlements are changed only after the signed Paddle webhook is validated and the event maps to a locally created checkout or an already linked Paddle subscription.
5. Duplicate events are recorded idempotently. A browser return or client-side callback alone never grants paid access.

The customer portal is created per request through Paddle's customer portal session API. Authenticated portal URLs are temporary and must not be cached as permanent links.

## Webhook destination

After the Control Plane has been deployed and the API route is reachable, create a Paddle notification destination with:

`https://api.agataproxima.com/api/v1/webhooks/paddle`

Subscribe to the relevant transaction and subscription lifecycle events, including transaction completed, transaction payment failed, transaction refunded, subscription created, subscription updated, and subscription canceled.

The handler verifies the raw request body using the `Paddle-Signature` header (`ts` and `h1`) and the destination's secret before parsing or processing the event. It rejects timestamps more than five seconds from the current server time to reduce replay risk. Keep the raw-body signature check, timestamp validation, organization/price matching, and event idempotency intact.

## Acceptance checklist

- [ ] Sandbox API key, client token, notification secret, and three unique price IDs are configured.
- [ ] Each price is active, monthly, USD, and matches the expected catalog amount.
- [ ] Checkout opens for an authorized organization owner/admin.
- [ ] No plan entitlement changes before a valid Paddle event is processed.
- [ ] Invalid, stale, duplicate, unmatched, and mismatched-price webhook events do not grant entitlements.
- [ ] Successful payment updates the organization plan and billing status.
- [ ] Payment failure starts the configured grace period; cancellation and expiry reconcile entitlements correctly.
- [ ] Customer portal links are generated securely and only for a known Paddle customer.
- [ ] Production checkout domain and Paddle account are approved before switching to `PADDLE_ENVIRONMENT=production`.
- [ ] Production readiness is rechecked after all environment variables are configured.

## Official Paddle references

- [Create a transaction](https://developer.paddle.com/api-reference/transactions/create-transaction/)
- [Verify webhook signatures](https://developer.paddle.com/webhooks/about/signature-verification/)
- [Create a customer portal session](https://developer.paddle.com/api-reference/customer-portals/create-customer-portal-session/)

No provider approval, domain change, deployment, or live charge is performed by these repository changes.
