# Agata Proxima — Phases 25–40

This release moves Proxima from hardened engine + operator dashboard into a product-shaped control plane without weakening the data-plane boundary.

## Non-negotiable architecture

```
                     Proxima Control Plane
       identity · tenants · policy · fleet · audit
                              |
                     authenticated management
                              |
             +----------------+----------------+
             |                                 |
       Proxima Node A                    Proxima Node B
             |                                 |
       Proxima Engine                    Proxima Engine
             |                                 |
        PostgreSQL                       PostgreSQL
```

The control plane is **not** on the runtime security path. A running Engine continues local tenant enforcement if the control plane is unavailable.

## Phase gates

| Phase | Gate |
|---|---|
| 25 | Deployment topology, environment contract, non-root image |
| 26 | Authenticated durable control-plane API |
| 27 | Organization / project / tenant ownership model |
| 28 | Node identity + one-time enrollment secret |
| 29 | Versioned policy resources |
| 30 | Append-only audit + verification evidence |
| 31 | Versioned /api/v1 contract + CSRF/session protections |
| 32 | Command center consumes real API resources |
| 33 | Desired vs observed deployment lifecycle |
| 34 | External SaaS integration remains a separate acceptance gate |
| 35 | Failure behavior documented and exposed in the UI |
| 36 | Performance/load benchmark contract added before claiming capacity |
| 37 | Security red-team evidence remains separate from marketing status |
| 38 | Production readiness checklist |
| 39 | Developer/API documentation |
| 40 | Private-beta foundation: auth, orgs, tenants, fleet, policies, audit, verification, support |

## Security properties

1. Passwords use Argon2id-compatible password hashing.
2. Sessions use opaque random tokens; only a SHA-256 token digest is stored.
3. Session cookies are HttpOnly and SameSite=Strict; production enables Secure.
4. State-changing management calls require the session-bound CSRF token.
5. Writes require owner/admin/operator role.
6. Every management resource is scoped by organization.
7. Enrollment tokens are returned once and only their digest is stored.
8. Audit events are written with the organization scope.
9. Verification results are recorded as evidence; the control plane never fabricates a passing result.
10. The control plane never becomes the Proxima Engine enforcement authority.

## Current honest status

The control-plane foundation is implemented in-repository. A production hosted service still requires real infrastructure provisioning, secret management, external identity integration, observability, backup/restore, load testing, deployment automation and a real external SaaS acceptance environment. Those are operational gates, not claims to hide behind the UI.
