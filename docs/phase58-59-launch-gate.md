# Phases 58–59 — Launch Hardening Gate

Phases 51–57 establish the implementation boundary. Phases 58–59 are the repository-side hardening and launch-readiness gates. The Phase 3.22-A–H gates add the canonical entitlement catalogue and enforceable plan limits.

## Phase 58 — Launch hardening

Completed in the repository:

- Billing checkout and customer billing response contracts are aligned with the customer UI.
- The canonical plan catalogue is Free $0, Starter $149/month, Growth $499/month, Scale $1,199/month and Enterprise custom.
- Paystack checkout uses Agata-specific environment-configured plan codes; production plan amounts and codes still require live verification.
- Plan capacity enforcement covers nodes, tenants and environments.
- Plan quotas cover active webhook integrations, monthly verifications, team seats/invitations, API keys and API requests.
- Plan feature enforcement covers policy management, fleet controls, advanced verification, priority support, Microsoft Entra OIDC and private deployment.
- Downgrades preserve existing resources and block new capacity above the destination plan.
- OIDC state, nonce and token-validation protections have repository coverage; real Microsoft Entra registration and end-to-end sign-in remain external acceptance gates.
- External SaaS acceptance scripts remain independent of the Control Plane's availability.
- Production environment contracts remain explicit and secrets are not committed.
- The Proxima Engine remains the enforcement authority when the Control Plane is unavailable.

## Phase 59 — Final repository launch gate

Repository-side acceptance requires:

1. `cargo fmt --all -- --check` passes.
2. `cargo check --workspace --all-targets` passes.
3. `cargo test --workspace --all-targets` passes.
4. `cargo clippy --workspace --all-targets --all-features -- -D warnings` passes.
5. PostgreSQL RLS verification passes.
6. Control Plane migration verification passes for the repository's current migrations (0001–0015).
7. OpenAPI JSON validates.
8. External SaaS fixture syntax validates.
9. Production environment contract validates.
10. The Phase 58–59 repository gate passes.
11. Phase 3.22-A, B, C, D, E, F, G and H acceptance gates pass.

## Deliberate external launch gates

These are **not** falsely marked complete by repository code:

- public HTTPS deployment;
- real Paystack plan amounts/codes, checkout and live webhook delivery;
- Agata-owned Resend domain and DNS verification;
- real Microsoft Entra application registration and end-to-end SSO;
- production secret rotation;
- backup/restore drill with measured RPO/RTO;
- centralized metrics and alerting;
- automated rollback;
- independent security assessment;
- runtime external SaaS acceptance against a deployed customer-like application;
- customer-facing status page.

The correct launch decision is therefore: **repository implementation and CI acceptance are complete for the listed gates; production launch confidence remains conditional on the external gates above.**
