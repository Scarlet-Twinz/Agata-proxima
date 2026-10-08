# Phase 3.22 — Canonical Entitlement Contract

Status: implementation in progress. This document defines the acceptance contract; it does not claim every workstream is implemented.

## Pricing source of truth

The launch pricing approved in the existing billing proposal is:

| Plan | Monthly price | Checkout |
|---|---:|---|
| Free | $0 | No payment provider subscription |
| Starter | $79 | Paystack recurring plan |
| Growth | $249 | Paystack recurring plan |
| Scale | $799 | Paystack recurring plan |
| Enterprise | Custom | Authorized, contract-managed provisioning |

Pricing is separate from entitlement limits. A plan code received from a browser is never sufficient evidence to grant a plan.

## Existing capacity contract

| Entitlement | Free | Starter | Growth | Scale | Enterprise |
|---|---:|---:|---:|---:|---|
| Nodes | 1 | 2 | 5 | 15 | Contract-defined |
| Tenants | 3 | 25 | 100 | 500 | Contract-defined |
| Environments | 1 | 2 | 5 | 50 | Contract-defined |
| Active webhook integrations | 1 | 5 | 20 | 100 | Contract-defined |
| Verification runs per UTC calendar month | 100 | 1,000 | 10,000 | 100,000 | Contract-defined |
| Team seats (members + unexpired pending invitations) | 1 | 5 | 15 | 50 | Contract-defined |
| Active API keys | 1 | 5 | 25 | 100 | Contract-defined |
| Authenticated API requests per minute | 60 | 300 | 1,000 | 5,000 | Contract-defined |
| Support level | Community | Standard | Priority | Priority+ | Contract-defined |
| Audit retention | 7 days | 30 days | 180 days | 365 days | Contract-defined |

## Feature contract

- Core Proxima Engine enforcement, tenant-context validation, session binding, PostgreSQL RLS and control-plane-independent enforcement apply to every plan.
- Policy management begins at Starter.
- Advanced verification begins at Growth.
- Fleet/deployment controls are available from Starter, with capability depth differentiated by plan where the implementation supports it.
- Priority support begins at Growth.
- Microsoft Entra OIDC begins at Growth.
- Private deployment begins at Scale.
- Enterprise-only features require explicit, authorized provisioning; a client-supplied `enterprise` plan key cannot grant them.

## Entitlement dimensions to enforce

1. Node, tenant and environment capacity.
2. Active outbound webhook integration count. Disabled webhooks do not consume a slot; re-enabling one requires available capacity.
3. Monthly verification quota, tracked in an atomic usage counter per UTC calendar month. The quota applies to basic and advanced verification runs; feature availability for advanced verification is still separately gated.
4. Audit retention policy.
5. Team seats and outstanding invitations. Active memberships plus unexpired pending invitations reserve seats; accepting an invitation transfers its reservation to membership atomically.
6. API request rate limits and plan usage quotas (separate controls).
7. Feature entitlements, including identity and private deployment.
8. Support level and any contract-specific SLA.

The existing node/tenant/environment and selected feature checks are a foundation, not proof that all eight dimensions are enforced. Each dimension must have a server-side enforcement point and tests before Phase 3.22 is complete.

## Lifecycle rules

- Free is an application entitlement; it does not require a Paystack subscription.
- Paid entitlements require a verified, authoritative billing state.
- Missing entitlement state fails closed for protected operations.
- A downgrade never deletes customer resources or weakens tenant isolation.
- When usage exceeds a downgraded limit, preserve existing data, mark over-entitlement, block further excess creation, and give the organization a remediation path.
- Failed-payment and cancellation behaviour must follow an explicitly defined recovery/grace policy. Do not treat all billing states as interchangeable.
- Entitlement transitions must be idempotent and auditable.
- Audit APIs hide events outside the current plan's retention window immediately; a database cleanup runs hourly to physically purge expired events. If entitlement state is missing, cleanup preserves records rather than guessing a retention policy.
- Capacity checks must be safe under concurrent creation attempts.

## Sequential acceptance

3.22-A must pass before 3.22-B starts. Each subsequent workstream must pass its targeted tests and the relevant full CI suite before the next workstream begins.

- A — Canonical catalogue and contract consistency
- B — Capacity limits and concurrency safety
- C — Integration limits
- D — Verification quotas
- E — Audit retention
- F — Team seats and invitations
- G — API quotas, feature gates, enterprise provisioning and support entitlements
- H — Lifecycle, downgrade, adversarial and regression acceptance
