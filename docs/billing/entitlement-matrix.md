# Agata Proxima — Launch Entitlement Matrix

The fundamental Proxima Engine security boundary is available on every plan. Pricing controls capacity and management capabilities, not isolation strength.

| Capability | Free | Starter $79 | Growth $249 | Scale $799 | Enterprise |
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

New organizations start on Free. No Paystack subscription is required.

### Paid subscriptions

Paystack is the billing source of truth for paid subscriptions. The Control Plane stores a normalized billing state and derives the organization entitlement record from the verified Paystack plan code.

Only these environment-configured Paystack plan codes are accepted:

- `AGATA_PAYSTACK_STARTER_PLAN_CODE`
- `AGATA_PAYSTACK_GROWTH_PLAN_CODE`
- `AGATA_PAYSTACK_SCALE_PLAN_CODE`

A checkout request containing a plan code that is not one of those three is rejected.

### Subscription lifecycle

- Checkout creates a Paystack subscription.
- Paystack webhook signatures are verified before processing.
- Paystack event IDs are idempotent.
- Subscription create/update events set the plan from the verified Agata plan code.
- Subscription deletion returns the organization to Free.
- Payment failure marks the billing state `past_due`; the organization retains its plan during the payment-recovery period.
- The Control Plane never grants a paid plan merely because a browser says payment succeeded.
- The webhook is authoritative for paid entitlement state.

### Why this design

A customer cannot change:

```
Starter -> Growth -> Scale
```

by editing a frontend request.

The backend maps the Paystack plan code to the corresponding plan, and the database stores the resulting entitlement.

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
