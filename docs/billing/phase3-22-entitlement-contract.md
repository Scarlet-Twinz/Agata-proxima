# Phase 3.22 — Canonical Entitlement Contract

Status: repository implementation complete for workstreams A–H. All eight Phase 3.22 acceptance gates, the full Rust quality suite, PostgreSQL RLS verification, migration verification, OpenAPI generation, and the Phase 58–59 launch gate passed on the Phase 3.22-H pull request. This confirms repository-side acceptance, not live production billing acceptance: deployment still requires valid Paystack credentials and plan codes, the production webhook URL, and a successful real-environment payment round trip. Checkout now checks the provider-side plan code, USD currency, monthly interval and exact amount before redirecting; verified transactions and signed webhook events must match the canonical amount and currency before paid entitlements are granted.

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
| 3.22-A | Canonical plan catalogue, prices and entitlement contract | **Complete** — catalogue consistency gate | Confirm the actual Paystack Starter/Growth/Scale plan codes are correct and run the real account acceptance test. The backend rejects a wrong amount, currency or interval before checkout. |
| 3.22-B | Node, tenant and environment limits; concurrent-write safety | **Complete** — database capacity and concurrency gate | Apply/verify migrations in the production database and run acceptance checks against the deployed service. |
| 3.22-C | Active webhook integration quotas | **Complete** — enabled/disabled and capacity gate | Verify quota behavior through the deployed API and production database. |
| 3.22-D | UTC-calendar-month verification quotas | **Complete** — atomic usage and quota gate | Verify monthly usage accounting with a real deployed verification flow. |
| 3.22-E | Plan-aware audit retention and hourly cleanup | **Complete** — retention/filter/cleanup gate | Verify the production scheduler runs and retention behavior is observable in the hosted environment. |
| 3.22-F | Team seats, pending invitations and atomic acceptance | **Complete** — seat reservation gate | Verify invite/acceptance flow with real users in the deployed environment. |
| 3.22-G | API keys and request limits, feature entitlements, enterprise provisioning and support tiers | **Complete** — API/enterprise/support gate | Verify configured production auth, API-key lifecycle, rate limits and authorized enterprise provisioning. |
| 3.22-H | Billing lifecycle, grace periods, downgrade preservation, idempotency and adversarial regressions | **Complete** — lifecycle gate, exact price/currency checks and regression suite | Complete real Paystack checkout → signed webhook → entitlement transition tests, including renewal failure, recovery, cancellation and downgrade. |

## Remaining work after 3.22-A–H

These are production activation or separate product-readiness gates, not unfinished A–H repository acceptance gates.

### Repository work completed after the A–H gates

- The practical guide exists at `docs/usage.md` and is published at `/docs/usage`.
- The login page now has an organization-slug-based Microsoft Entra SSO start flow, and organization owners/admins can configure the expected Entra tenant ID in Settings.
- Paystack checkout preflights the configured provider plans for exact plan code, USD currency, monthly interval and amount. Transaction verification and signed success webhooks must match the expected plan and amount before paid entitlements are granted.
- Production runbooks, on-demand database backup/health scripts, a production readiness endpoint and a scheduled GitHub Actions liveness probe are in the repository.
- The repository's Rust and frontend workflows have passed for the usage guide, Paystack acceptance changes and SSO UI integration. The latest main-branch Phase 58–59 launch workflow should still be checked after its run completes.

### External tasks that remain

1. **Paystack live activation:** verify business approval, international payment enablement and (if USD settlement is required) the verified payout account; configure production credentials and the webhook endpoint in the deployment secret store; confirm the actual three plan codes; perform a real payment round trip, renewal failure/recovery and cancellation tests. Never place secret values in source control or chat.
2. **Production hosting and database rollout:** provision the actual public HTTPS frontend/Control Plane and a separate managed PostgreSQL database; confirm the deployed service is not using local Compose or the developer laptop; apply migrations 0001–0015 in order and run deployed smoke/rollback checks without destructively resetting customer data.
3. **Microsoft Entra SSO acceptance:** the repository UI start flow and organization tenant mapping form now exist, but production SSO is not yet accepted. Create the multitenant Entra app registration, add the exact public HTTPS callback, securely configure the client ID/secret and public base URL, then test organization mapping, session creation and audit events end to end.
4. **Production email:** verify the Agata-owned Resend sending domain, configure the API key and sender in the deployment secret store, and test verification, reset and invitation emails.
5. **Operational readiness:** configure the production URL secret for the scheduled GitHub Actions smoke probe; run the manual readiness workflow; enable managed database backups/PITR, restore to an isolated database and record measured RPO/RTO; configure database/API/payment/email/backup alerts and test rollback.
6. **Runtime security and launch acceptance:** run the external three-tenant SaaS acceptance harness against the deployed service, load/performance tests and an independent security assessment. Complete incident ownership and status-page readiness before launch.

The public pricing and server catalogue are aligned to **Free $0, Starter $149/month, Growth $499/month, Scale $1,199/month, Enterprise custom**. Annual figures in the proposal are a derived ten-month billing schedule and must not be treated as active Paystack plans unless separately configured and verified.
