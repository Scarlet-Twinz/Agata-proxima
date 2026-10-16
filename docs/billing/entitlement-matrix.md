# Agata Proxima — Launch Entitlement Matrix

The fundamental Proxima Engine security boundary is available on every plan. Pricing controls capacity and management capabilities, not isolation strength.

| Capability | Free | Starter $149 | Growth $499 | Scale $1,199 | Enterprise |
|---|---:|---:|---:|---:|---:|
| Proxima tenant isolation | ✓ | ✓ | ✓ | ✓ | ✓ |
| Session binding | ✓ | ✓ | ✓ | ✓ | ✓ |
| PostgreSQL RLS enforcement | ✓ | ✓ | ✓ | ✓ | ✓ |
| Engine continues if Control Plane is offline | ✓ | ✓ | ✓ | ✓ | ✓ |
| Nodes | 1 | 2 | 5 | 15 | Custom |
| Tenants | 3 | 25 | 100 | 500 | Custom |
| Environments | 1 | 2 | 5 | 50 | Custom |
| Active webhook integrations | 1 | 5 | 20 | 100 | Custom |
| Verification runs/month | 100 | 1,000 | 10,000 | 100,000 | Contract |
| Team seats (members + pending invitations) | 1 | 5 | 15 | 50 | Contract |
| Active API keys | 1 | 5 | 25 | 100 | Contract |
| Authenticated API requests/minute | 60 | 300 | 1,000 | 5,000 | Contract |
| Support level | Community | Standard | Priority | Priority+ | Contract |
| Basic verification | ✓ | ✓ | ✓ | ✓ | ✓ |
| Advanced verification | — | — | ✓ | ✓ | ✓ |
| Policy management | — | ✓ | ✓ | ✓ | ✓ |
| Fleet controls | — | ✓ | ✓ | ✓ | ✓ |
| Audit retention | 7 days | 30 days | 180 days | 365 days | Custom |
| Priority support | — | — | ✓ | ✓ | ✓ |
| Microsoft Entra OIDC | — | — | ✓ | ✓ | ✓ |
| Private deployment | — | — | — | ✓ | ✓ |
| Custom deployment/security terms | — | — | — | — | ✓ |
| SLA | — | — | — | — | Contract |
| Custom compliance/security requirements | — | — | — | — | Contract |

## Billing behavior

### Free

New organizations start on Free. No Flutterwave subscription is required.

### Paid subscriptions

Flutterwave is the current provider integration for paid checkout. The Control Plane stores normalized billing state and derives organization entitlements only after server-side transaction verification and webhook validation.

Configure distinct numeric plan IDs and the expected USD amounts using the variables documented in [`../production/flutterwave-billing.md`](../production/flutterwave-billing.md):

- `FLUTTERWAVE_STARTER_PLAN_ID`
- `FLUTTERWAVE_GROWTH_PLAN_ID`
- `FLUTTERWAVE_SCALE_PLAN_ID`
- `FLUTTERWAVE_STARTER_AMOUNT_USD=149`
- `FLUTTERWAVE_GROWTH_AMOUNT_USD=499`
- `FLUTTERWAVE_SCALE_AMOUNT_USD=1199`

Checkout must reject unsupported plan keys and must not grant paid entitlements from a browser redirect or client-supplied plan value.

### Subscription lifecycle

- Checkout creates a provider checkout using the configured Flutterwave plan.
- Flutterwave's configured `verif-hash` webhook header is validated before processing.
- Duplicate provider notifications are handled idempotently.
- Subscription create/update events set the plan from the locally correlated checkout reference and configured variant ID.
- Subscription deletion returns the organization to Free.
- Payment failure marks the billing state `past_due`; the organization retains its plan during the payment-recovery period.
- The Control Plane never grants a paid plan merely because a browser says payment succeeded.
- The verified server-side transaction and accepted webhook flow are authoritative for paid entitlement state.

### Why this design

A customer cannot change:

```
Starter -> Growth -> Scale
```

by editing a frontend request.

The backend maps the validated Flutterwave transaction and configured plan to the corresponding entitlement, and the database stores the normalized billing state.

The Engine's tenant-isolation enforcement remains independent of this billing state.

## Current implementation

Implemented backend enforcement currently covers:

- tenant capacity;
- node capacity;
- fleet controls;
- advanced verification;
- inactive subscription protection;
- entitlement inspection through `GET /api/v1/billing/entitlements`.

Integration quotas count enabled outbound webhook integrations. Disabled webhooks do not consume capacity, but re-enabling them is rejected when the plan is already at its limit. Verification quota is counted across basic and advanced runs, resets at the UTC calendar-month boundary, and is enforced atomically by the database. Advanced verification remains a separate feature gate. Audit history is filtered by the current plan's retention window, and expired records are purged hourly; unresolved entitlement state preserves records until it is repaired. Active memberships plus unexpired pending invitations consume team seats. Invitation acceptance transfers a reserved seat to membership atomically. API keys are organization-scoped operator credentials, active-key counts are capped, and authenticated requests are rate-limited by organization. API-key management remains session-only. Enterprise access requires trusted contracted provisioning and is not self-service checkout. Failed renewal has a fixed seven-day grace window, non-renewal expires at the recorded period end, and downgrade never deletes existing resources. Capacity-increasing writes are blocked after the entitlement limit is exceeded, while safe remediation remains possible. Webhook processing retries stale claims and treats completed events as terminal. Additional UI gating should consume this endpoint rather than inventing its own plan logic.
