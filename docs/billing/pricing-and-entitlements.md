# Pricing and Entitlement Model

This document defines the current monthly price schedule and the intended plan-capacity model. It is not evidence that a payment provider has approved the account or that live checkout has passed acceptance.

## Monthly pricing

| Plan | Price | Intended use |
|---|---:|---|
| Free | $0/month | Evaluation, development, and small proofs of concept |
| Starter | $149/month | Initial production SaaS deployments |
| Growth | $499/month | Teams operating multiple production tenants |
| Scale | $1,199/month | Larger fleets and security/operations teams |
| Enterprise | Custom | Contracted enterprise deployments |

Prices are denominated in USD. Annual billing is not part of the current verified checkout contract unless separately configured and tested.

## Plan capacity

| Entitlement | Free | Starter | Growth | Scale | Enterprise |
|---|---:|---:|---:|---:|---|
| Nodes | 1 | 2 | 5 | 15 | Contract-defined |
| Tenants | 3 | 25 | 100 | 500 | Contract-defined |
| Environments | 1 | 2 | 5 | 50 | Contract-defined |
| Active webhook integrations | 1 | 5 | 20 | 100 | Contract-defined |
| Verification runs per UTC calendar month | 100 | 1,000 | 10,000 | 100,000 | Contract-defined |
| Team seats | 1 | 5 | 15 | 50 | Contract-defined |
| Active API keys | 1 | 5 | 25 | 100 | Contract-defined |
| Authenticated API requests per minute | 60 | 300 | 1,000 | 5,000 | Contract-defined |
| Audit retention | 7 days | 30 days | 180 days | 365 days | Contract-defined |
| Support | Community | Standard | Priority | Priority+ | Contract-defined |

The backend entitlement contract is authoritative for protected operations. A price label or client-supplied plan name must never grant capacity or enterprise features by itself.

## Security and feature principles

- Every plan uses the same fundamental Engine enforcement and tenant-isolation model. Core security enforcement is not weakened for lower-priced plans.
- Higher tiers differentiate operational scale, management capabilities, quotas, retention, identity features, and support—not the integrity of the tenant boundary.
- Paid entitlements require a server-verified billing state.
- Failed, unknown, mismatched, or unverified payment events must not grant paid entitlements.
- Downgrades preserve customer data and tenant isolation. Capacity-increasing writes may be blocked when an organization exceeds its new limits, while safe remediation remains possible.
- Enterprise-only capabilities require explicit, authorized provisioning.

## Current billing provider and activation gate

**Flutterwave is the current provider integration.** See the [Flutterwave billing runbook](../production/flutterwave-billing.md) for required environment values, plan IDs, webhook verification, and acceptance checks.

Before enabling paid checkout, verify all of the following in the intended live environment:

1. The account is approved for the intended payment flow.
2. Starter, Growth, and Scale plan identifiers are distinct and correspond to the expected prices.
3. The hosted checkout returns USD and the exact configured amount.
4. Transaction verification and webhook signature/hash validation succeed.
5. Duplicate webhook delivery is idempotent.
6. Failed, unknown-reference, wrong-currency, and wrong-amount transactions do not grant entitlements.
7. The resulting entitlement changes are recorded and auditable.

Historical Paddle, Paystack, and Lemon Squeezy migration records may remain in the repository to preserve database migration history. They are not current provider setup instructions.

## Production status

Repository code and CI are necessary but insufficient for production acceptance. Keep live billing marked pending until the real provider round trip, failure paths, and entitlement transitions have been verified and recorded.
