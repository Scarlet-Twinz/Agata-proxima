# Phases 58–59 — Launch Hardening Gate

Phases 51–57 establish the implementation boundary. Phases 58–59 are the final repository-side hardening and launch-readiness gates.

## Phase 58 — Launch hardening

Completed in the repository:

- Billing checkout and Customer Portal response contracts are aligned with the customer UI.
- Plan capacity enforcement covers nodes, tenants and environments.
- Plan feature enforcement covers policy management, fleet controls, advanced verification, priority support, Microsoft Entra OIDC and private deployment.
- Downgrades preserve existing resources and block new capacity above the destination plan.
- Microsoft Entra OIDC validates state, nonce, issuer, audience, tenant identity, signature and expiry before session creation.
- External SaaS acceptance scripts remain independent of the Control Plane's availability.
- Production environment contracts remain explicit and secrets are not committed.
- The Proxima Engine remains the enforcement authority when the Control Plane is unavailable.

## Phase 59 — Final launch gate

Repository-side acceptance is complete when:

1. `cargo fmt --all -- --check` passes.
2. `cargo check --workspace --all-targets` passes.
3. `cargo test --workspace --all-targets` passes.
4. `cargo clippy --workspace --all-targets --all-features -- -D warnings` passes.
5. PostgreSQL RLS verification passes.
6. Control Plane migrations 0001–0004 apply cleanly.
7. OpenAPI JSON validates.
8. External SaaS fixture syntax validates.
9. Production environment contract validates.
10. The Phase 58–59 repository gate passes.

## Deliberate external launch gates

These are **not** falsely marked complete by repository code:

- public HTTPS deployment;
- real Stripe Products/Prices and live webhook delivery;
- Agata-owned Resend domain and DNS verification;
- real Microsoft Entra application registration and end-to-end SSO;
- production secret rotation;
- backup/restore drill with measured RPO/RTO;
- centralized metrics and alerting;
- automated rollback;
- independent security assessment;
- runtime external SaaS acceptance against a deployed customer-like application;
- customer-facing status page.

The correct launch decision is therefore: **high confidence in the repository implementation; production launch confidence remains conditional on the external gates above.**
