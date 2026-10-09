# Phase 3.22 — Canonical Entitlement Contract

Status: repository implementation complete for workstreams A–H. All eight Phase 3.22 acceptance gates, the full Rust quality suite, PostgreSQL RLS verification, migration verification, OpenAPI generation, and the Phase 58–59 launch gate passed on the Phase 3.22-H pull request. This confirms repository-side acceptance, not live production billing acceptance: deployment still requires valid Paystack credentials and plan codes, the production webhook URL, and a successful real-environment payment round trip.

## Pricing source of truth

The restored launch pricing is recorded as follows. Before live activation, verify that each configured Paystack plan code resolves to a plan whose amount matches this schedule:

| Plan | Monthly price | Checkout |
|---|---:|---|
| Free | $0 | No payment provider subscription |
| Starter | $149 | Paystack recurring plan |
| Growth | $499 | Paystack recurring plan |
| Scale | $1,199 | Paystack recurring plan |
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

The initial node/tenant/environment and selected feature checks were only a foundation. The completed Phase 3.22-A–H repository work now supplies a server-side enforcement point and tests for each of the eight dimensions, with targeted acceptance gates; the passing repository gates do not substitute for live production-provider acceptance.

## Lifecycle rules

- Free is an application entitlement; it does not require a Paystack subscription.
- Paid entitlements require a verified, authoritative billing state.
- Missing entitlement state fails closed for protected operations.
- A downgrade never deletes customer resources or weakens tenant isolation.
- When usage exceeds a downgraded limit, preserve existing data, mark over-entitlement, block further excess creation, and give the organization a remediation path.
- Failed-payment and cancellation behaviour must follow an explicitly defined recovery/grace policy. Do not treat all billing states as interchangeable.
- Entitlement transitions must be idempotent and auditable.
- Audit APIs hide events outside the current plan's retention window immediately; a database cleanup runs hourly to physically purge expired events. If entitlement state is missing, cleanup preserves records rather than guessing a retention policy.
- Failed renewal enters a fixed seven-day grace window; repeated failures do not extend it. At expiry, creation of new resources is blocked while existing data remains available for remediation. Non-renewing subscriptions remain active through the recorded period end, then transition to canceled.
- Downgrades never delete or revoke existing resources automatically. They block capacity-increasing writes and preserve safe disable, revoke, move, and remediation operations. Webhook events are idempotent; recent in-progress events are not double-processed, while stale claims can be retried.
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


## Phase 3.22-A–H completion map

| Workstream | Scope | Repository status | What remains for live production |
|---|---|---|---|
| 3.22-A | Canonical plan catalogue, prices and entitlement contract | **Complete** — catalogue consistency gate | Confirm the actual Paystack Starter/Growth/Scale plans match the restored $149/$499/$1,199 monthly prices before enabling live checkout. |
| 3.22-B | Node, tenant and environment limits; concurrent-write safety | **Complete** — database capacity and concurrency gate | Apply/verify migrations in the production database and run acceptance checks against the deployed service. |
| 3.22-C | Active webhook integration quotas | **Complete** — enabled/disabled and capacity gate | Verify quota behavior through the deployed API and production database. |
| 3.22-D | UTC-calendar-month verification quotas | **Complete** — atomic usage and quota gate | Verify monthly usage accounting with a real deployed verification flow. |
| 3.22-E | Plan-aware audit retention and hourly cleanup | **Complete** — retention/filter/cleanup gate | Verify the production scheduler runs and retention behavior is observable in the hosted environment. |
| 3.22-F | Team seats, pending invitations and atomic acceptance | **Complete** — seat reservation gate | Verify invite/acceptance flow with real users in the deployed environment. |
| 3.22-G | API keys and request limits, feature entitlements, enterprise provisioning and support tiers | **Complete** — API/enterprise/support gate | Verify configured production auth, API-key lifecycle, rate limits and authorized enterprise provisioning. |
| 3.22-H | Billing lifecycle, grace periods, downgrade preservation, idempotency and adversarial regressions | **Complete** — lifecycle gate and regression suite | Complete real Paystack checkout → signed webhook → entitlement transition tests, including renewal failure, recovery, cancellation and downgrade. |

## Remaining work after 3.22-A–H

These are external activation or separate product-readiness gates, not unfinished A–H repository acceptance gates:

1. **Paystack live activation:** verify account plan amounts and plan codes; configure production credentials and the webhook endpoint in the deployment secret store; perform a real payment round trip. Never place secret values in source control or chat.
2. **Production database rollout:** apply the migrations in order, confirm schema state, and run deployed smoke/rollback checks without destructively resetting customer data.
3. **Microsoft Entra SSO:** not end-to-end accepted yet. The repository has OIDC groundwork, but production app registration, the exact HTTPS callback, credentials, organization mapping and a real Entra sign-in test remain separate gates.
4. **Usage documentation:** finish `/docs/usage` as a practical guide with prerequisites, setup, first workspace, nodes/tenants/environments, verification, integrations, seats/invitations, billing, API use and troubleshooting—not just a placeholder page.
5. **Hosted-service readiness:** verify deployment automation, secret management, observability/alerts, backup and restore, load testing, and external SaaS acceptance in the actual target environment.

The public pricing and server catalogue are now aligned to **Free $0, Starter $149/month, Growth $499/month, Scale $1,199/month, Enterprise custom**. The annual figures in the proposal are a derived ten-month billing schedule and must not be treated as active Paystack plans unless separately configured and verified.
