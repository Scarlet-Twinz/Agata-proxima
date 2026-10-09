# Agata Proxima Entitlement Matrix

Launch pricing is **Free $0 / Starter $149 / Growth $499 / Scale $1,199 / Enterprise custom**, billed monthly. This file is aligned with `docs/billing/entitlement-matrix.md` and `docs/billing/phase3-22-entitlement-contract.md`.

The fundamental Proxima Engine security boundary is available on every plan. Commercial limits may reject new resource creation or feature use, but must never weaken existing tenant isolation.

## Canonical launch matrix

| Capability | Free | Starter $149 | Growth $499 | Scale $1,199 | Enterprise |
|---|---:|---:|---:|---:|---:|
| Proxima Engine enforcement and tenant isolation | ✓ | ✓ | ✓ | ✓ | ✓ |
| Session binding and tenant-context validation | ✓ | ✓ | ✓ | ✓ | ✓ |
| PostgreSQL RLS enforcement | ✓ | ✓ | ✓ | ✓ | ✓ |
| Enforcement continues if Control Plane is offline | ✓ | ✓ | ✓ | ✓ | ✓ |
| Nodes | 1 | 2 | 5 | 15 | Contract-defined |
| Tenants | 3 | 25 | 100 | 500 | Contract-defined |
| Environments | 1 | 2 | 5 | 50 | Contract-defined |
| Active webhook integrations | 1 | 5 | 20 | 100 | Contract-defined |
| Verification runs per UTC calendar month | 100 | 1,000 | 10,000 | 100,000 | Contract-defined |
| Team seats (active members + unexpired pending invitations) | 1 | 5 | 15 | 50 | Contract-defined |
| Active API keys | 1 | 5 | 25 | 100 | Contract-defined |
| Authenticated API requests per minute | 60 | 300 | 1,000 | 5,000 | Contract-defined |
| Audit retention | 7 days | 30 days | 180 days | 365 days | Contract-defined |
| Basic verification | ✓ | ✓ | ✓ | ✓ | ✓ |
| Policy management | — | ✓ | ✓ | ✓ | ✓ |
| Fleet/deployment controls | — | ✓ | ✓ | ✓ | ✓ |
| Advanced verification | — | — | ✓ | ✓ | Contract-defined |
| Priority support | — | — | ✓ | ✓ | Contract-defined |
| Support level | Community | Standard | Priority | Priority+ | Contract-defined |
| Microsoft Entra OIDC | — | — | ✓ | ✓ | Contract-defined |
| Private deployment | — | — | — | ✓ | Contract-defined |
| Custom SLA/compliance/deployment terms | — | — | — | — | Contract-defined |

Enterprise values are determined by an authorized agreement and provisioning; a client-supplied `enterprise` plan key must not grant Enterprise entitlements. SAML is a potential later compatibility layer and must not be represented as an already accepted production capability.

## Enforcement rules

- The Engine's core isolation behavior applies to every plan and does not depend on billing availability.
- The server and database are authoritative for plan resolution and protected operations. The frontend is not an entitlement authority.
- Missing or untrusted paid entitlement state fails closed for protected operations.
- Capacity checks must remain safe under concurrent creation attempts.
- A downgrade does not delete customer resources or disable isolation. If current usage exceeds the destination plan, preserve existing data, block capacity-increasing writes above the limit, and allow safe remediation.
- Free is an Agata entitlement and does not require a Lemon Squeezy subscription.

## Metering and enforcement contract

Phase 3.22-A–H repository acceptance is complete and its targeted gates pass in CI. The implementation covers:

1. Node, tenant and environment capacity.
2. Enabled outbound webhook integration quotas. Disabled integrations do not consume a slot; re-enabling requires capacity.
3. Verification quotas across basic and advanced verification, counted atomically per UTC calendar month. Advanced verification remains a separate feature gate.
4. Plan-aware audit filtering and retention. Expired events are hidden according to the active entitlement and cleanup purges expired events hourly. If entitlement state is unresolved, cleanup preserves records rather than guessing.
5. Team seats and pending invitations. Active memberships plus unexpired invitations reserve seats; accepting an invitation transfers the reservation atomically.
6. Organization-scoped active API-key caps and authenticated API request rate limits.
7. Feature gates, Enterprise provisioning restrictions and support-level entitlements.
8. Billing lifecycle transitions, fixed seven-day failed-renewal grace, cancellation at the recorded period end, downgrade preservation, idempotent webhook processing and regression checks.

Passing repository gates proves the code/test acceptance boundary, not live production provider activation. The production environment still needs a Lemon Squeezy payment round trip, database rollout, real SSO acceptance and operational verification.

## Billing source of truth

Lemon Squeezy is the provider for paid subscription lifecycle. Agata's database stores normalized billing state, organization membership, resolved entitlements and audit history. Signed provider events are processed idempotently. A browser redirect or client-supplied plan value never proves payment.

Only the Agata-specific environment-configured plan codes are accepted:

- `LEMON_SQUEEZY_STARTER_VARIANT_ID`
- `LEMON_SQUEEZY_GROWTH_VARIANT_ID`
- `LEMON_SQUEEZY_SCALE_VARIANT_ID`

The backend checks each configured provider plan against the canonical USD amount and monthly interval before checkout. Expected amounts in minor units are Starter `14900`, Growth `49900` and Scale `119900`. Transaction verification and signed webhook processing must also validate the expected amount, currency, organization and plan before paid entitlements are applied.

## Upgrade and downgrade behavior

### Upgrade

1. The customer starts checkout for a supported paid plan.
2. Lemon Squeezy verifies the transaction and sends its signed webhook.
3. Agata validates the provider event, amount, currency and Agata plan code.
4. The billing state and resolved entitlement are updated idempotently.
5. The plan transition is audited.

### Downgrade, failed renewal or cancellation

- Failed renewal enters a fixed seven-day recovery window; repeated failures do not extend it.
- Non-renewing subscriptions remain active through their recorded period end, then transition to canceled.
- At grace expiry, new capacity-increasing writes are blocked while existing data remains available for remediation.
- Downgrades never delete resources automatically or weaken isolation.
- Completed webhook events are terminal; stale in-progress claims can be retried safely.

## Provider catalog

The intended monthly Lemon Squeezy plans are:

- Agata Proxima Starter — $149/month
- Agata Proxima Growth — $499/month
- Agata Proxima Scale — $1,199/month

Do not reuse unrelated products or change provider plans solely because this document exists. Before enabling live checkout, confirm that the actual Lemon Squeezy plan codes and amounts match this catalogue and complete a real checkout → signed webhook → entitlement acceptance test. Annual billing is not part of the current active Lemon Squeezy contract.
